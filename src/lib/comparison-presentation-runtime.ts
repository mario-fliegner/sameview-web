// The vanilla-DOM binding layer that makes the markup
// src/lib/comparison-artifact-markup.ts produces interactive inside a
// generated Standalone HTML/Static Microsite document
// (docs/COMPARISON_PRESENTATION.md Part 1 "Interaction Parity": "Presentation
// interaction is defined once ... never redefined separately by an
// individual output type"). This module owns only DOM wiring — reading
// events, calling `getBoundingClientRect()`/`ResizeObserver`, writing
// styles/attributes back — never a second copy of any decision: every
// actual computation is imported unchanged from the same pure/DOM-only
// modules the live Workspace Preview (src/components/WorkspaceActive.tsx,
// ComparisonSlider.tsx, ComparisonPresentationInfo.tsx) already uses:
// - src/lib/canvas-geometry.ts (Stage/Canvas geometry convergence math)
// - src/lib/adaptive-text-size.ts + src/lib/text-measurement.ts (Adaptive
//   Sizing)
// - src/lib/comparison-slider-interaction.ts (drag/keyboard/label-visibility
//   math)
// - src/lib/comparison-handle-geometry.ts (ring radius/enlargement)
// - src/lib/overflow-tooltip.ts (already explicitly framework-independent
//   and designed for exactly this reuse — attached completely unchanged)
//
// Bundled into a single, dependency-free script via
// src/lib/comparison-presentation-runtime-entry.ts (Vite `?worker&url`,
// see that file's own header comment) and embedded by
// src/lib/generate-standalone-html.ts (inline `<script>`) and
// src/lib/generate-static-microsite.ts (`js/sameview-comparison.js`).
//
// docs/IMPLEMENTATION_PLAN_V1.md Phase 13 ("Shared Runtime Multiple-Instance
// Safety"); docs/COMPARISON_PRESENTATION.md "Multiple Instances and Host
// Isolation": this module discovers every `.presentation-canvas` root in the
// document and initializes each independently, resolving every descendant
// relative to that instance's own root — never via a global `document`
// lookup, and never by id (src/lib/comparison-artifact-markup.ts's
// `multi-instance` mode emits none; see that module's own header comment).
// Standalone HTML and Static Microsite still only ever render exactly one
// instance per document, so this is additive safety, not a behavior change
// for them.

import {
	type AdaptiveTextSize,
	computeWrappedLineCount,
	selectAdaptiveTextSize,
} from "./adaptive-text-size.ts";
import {
	CANVAS_CONTENT_GAP_PX,
	CANVAS_PADDING_PX,
	computeCanvasGeometry,
	deriveImageRatio,
	GEOMETRY_STABILITY_TOLERANCE_PX,
	initialMetadataWidth,
	MAX_GEOMETRY_MEASUREMENTS,
} from "./canvas-geometry.ts";
import {
	buildDescriptionFont,
	buildLocationFont,
	buildSliderLabelFont,
	buildTimeFont,
	buildTitleFont,
} from "./comparison-canvas-fonts.ts";
import {
	getEffectiveRingRadiusPx,
	getHandleVisualSizePx,
} from "./comparison-handle-geometry.ts";
import {
	clampPercent,
	computeLabelVisibility,
	dividerPositionPx,
	nextPositionForKey,
	positionFromClientX,
} from "./comparison-slider-interaction.ts";
import { attachPresentationOverflowTooltips } from "./overflow-tooltip.ts";
import {
	measureSpaceWidth,
	measureTextWidth,
	measureWordWidths,
} from "./text-measurement.ts";

const LABEL_GAP_PX = 8;

// Root-relative lookups only, by class or ARIA role — never by id
// (src/lib/comparison-artifact-markup.ts's `multi-instance` mode emits none)
// and never via the global `document`, so the same code is correct whether
// this root is alone in the document (Standalone HTML/Static Microsite) or
// one of several (a future multi-Comparison host page, e.g. Phase 16
// WordPress placement).
function queryDescendant<T extends Element>(
	root: ParentNode,
	selector: string,
): T | null {
	return root.querySelector<T>(selector);
}

// Same "always emitted unconditionally, a missing one is a genuine
// scaffold/runtime contract bug" reasoning as the module previously
// expressed via `requireElement("...")`; only the lookup mechanism (root-
// relative selector, not a global id) has changed.
function requireDescendant<T extends Element>(
	root: ParentNode,
	selector: string,
): T {
	const element = root.querySelector<T>(selector);
	if (!element) {
		throw new Error(
			`Comparison Presentation runtime: missing "${selector}" inside a .presentation-canvas root`,
		);
	}
	return element;
}

// The two comparison images share the same `.comparison-slider__image`
// class; only the reference (overlay) layer carries the distinguishing
// `--overlay` modifier already used for its clip-path stacking
// (src/lib/comparison-artifact-markup.ts) — capture is simply "the other
// one", never resolved by array order or by id.
function requireComparisonImages(canvas: HTMLElement): {
	readonly captureImage: HTMLImageElement;
	readonly referenceImage: HTMLImageElement;
} {
	const referenceImage = requireDescendant<HTMLImageElement>(
		canvas,
		".comparison-slider__image--overlay",
	);
	const images = canvas.querySelectorAll<HTMLImageElement>(
		".comparison-slider__image",
	);
	const captureImage = Array.from(images).find(
		(image) => image !== referenceImage,
	);
	if (!captureImage) {
		throw new Error(
			"Comparison Presentation runtime: missing capture image inside a .presentation-canvas root",
		);
	}
	return { captureImage, referenceImage };
}

// The on-image left/right slider date labels share one class
// (`.comparison-slider__label`) with no other distinguishing marker.
// src/lib/comparison-artifact-markup.ts's `buildComparisonArtifactMarkup`
// always emits the left label immediately before the right label,
// unconditionally — a fixed, structural property of the markup builder
// itself, never derived from script/runtime execution order or any counter.
function queryLabels(canvas: HTMLElement): {
	readonly labelLeft: HTMLElement | null;
	readonly labelRight: HTMLElement | null;
} {
	const labels = canvas.querySelectorAll<HTMLElement>(
		".comparison-slider__label",
	);
	return { labelLeft: labels[0] ?? null, labelRight: labels[1] ?? null };
}

// docs/COMPARISON_PRESENTATION.md Part 2: the Stage fits itself into an
// independent, externally measured "available space" budget — it cannot
// measure its own box for this (that would be circular: the Canvas's own
// size is exactly what `recomputeGeometry()` below computes). The live
// Workspace Preview establishes this same contract independently
// (src/components/WorkspaceActive.tsx `canvasAreaRef`/
// `.workspace-active__canvas-area`: "what the geometry ResizeObserver
// actually measures ... Presentation Canvas's own sub-region of the
// Presentation Preview" — deliberately a distinct element from
// `.presentation-canvas` itself); the generated artifact scaffold
// (src/lib/comparison-artifact-scaffold.ts `<main id="sameview-output-frame">`)
// already provides this exact same immediate-parent relationship for
// Standalone HTML/Static Microsite. A `.presentation-canvas` with no parent
// element violates this already-established Presentation-model invariant —
// a genuine markup-construction bug, not a legitimate embedding shape — and
// fails loudly here rather than silently falling back to the canvas's own
// box.
function requireInstanceFrame(canvas: HTMLElement): HTMLElement {
	const frame = canvas.parentElement;
	if (!frame) {
		throw new Error(
			"Comparison Presentation runtime: .presentation-canvas has no parent element to measure available space from",
		);
	}
	return frame;
}

function applyAdaptiveSize(
	element: HTMLElement | null,
	text: string,
	font: string,
	maxLines: number,
	availableWidthPx: number | null,
	compactClass: string,
): void {
	if (!element) return;
	let size: AdaptiveTextSize = "standard";
	if (text && availableWidthPx !== null) {
		const wordWidths = measureWordWidths(text, font);
		const spaceWidth = measureSpaceWidth(font);
		const lineCount = computeWrappedLineCount(
			wordWidths,
			spaceWidth,
			availableWidthPx,
		);
		size = selectAdaptiveTextSize(lineCount, maxLines);
	}
	element.classList.toggle(compactClass, size === "compact");
}

// A private, runtime-only bookkeeping marker — never emitted by
// src/lib/comparison-artifact-markup.ts, never part of any generated file's
// bytes, never read by any other module, never persisted, and set only
// after this view happens to run (long after Phase 11's Outcome
// Fingerprint is computed during SameView Web's own generation flow, in a
// completely disjoint browser context) — it cannot affect fingerprint
// semantics and needs no output-specific behavior. Set only once a root's
// required instance structure has been fully resolved (see `initInstance`
// below), immediately before listener/observer attachment, so a structural
// failure never leaves a root permanently marked as initialized.
const RUNTIME_INITIALIZED_ATTRIBUTE = "sameviewRuntimeInitialized";

// Initializes exactly one discovered `.presentation-canvas` root
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 13). All interaction/geometry/
// observer state below is declared inside this function's own closure, so
// two calls for two different roots never share anything — the same
// property that already made this module's original single-call body
// instance-local by construction; this refactor only changes *how* each
// call finds its own elements (root-relative, never global/never by id),
// never how its own state is scoped.
function initInstance(canvas: HTMLElement): void {
	if (canvas.dataset[RUNTIME_INITIALIZED_ATTRIBUTE] === "true") return;

	const outputFrame = requireInstanceFrame(canvas);
	const sliderFrame = requireDescendant<HTMLElement>(
		canvas,
		".comparison-slider__frame",
	);
	const { captureImage, referenceImage } = requireComparisonImages(canvas);
	const dividerLine = queryDescendant<HTMLElement>(
		canvas,
		".comparison-slider__divider-line",
	);
	const handle = queryDescendant<HTMLElement>(canvas, '[role="slider"]');
	const handleVisual = queryDescendant<SVGElement>(
		canvas,
		".comparison-slider__handle-visual",
	);
	const { labelLeft, labelRight } = queryLabels(canvas);
	const loading = queryDescendant<HTMLElement>(
		canvas,
		".comparison-slider__loading",
	);
	const infoWrapper = requireDescendant<HTMLElement>(
		canvas,
		".presentation-canvas__info-wrapper",
	);
	const titleEl = queryDescendant<HTMLElement>(
		canvas,
		".presentation-info__title",
	);
	const descriptionEl = queryDescendant<HTMLElement>(
		canvas,
		".presentation-info__description",
	);
	const timeEl = queryDescendant<HTMLElement>(
		canvas,
		".presentation-info__time",
	);
	const locationEl = queryDescendant<HTMLElement>(
		canvas,
		".presentation-info__location",
	);

	// Every required element/frame above resolved successfully — safe to mark
	// this root as initialized now, immediately before any listener/observer
	// attachment. If any lookup above had thrown instead, execution would
	// never reach this line, so the root remains unmarked and a later,
	// possibly-successful re-initialization attempt is not poisoned by this
	// one's failure.
	canvas.dataset[RUNTIME_INITIALIZED_ATTRIBUTE] = "true";

	const presentationFontFamily =
		getComputedStyle(canvas).getPropertyValue("--presentation-font-family") ||
		"sans-serif";
	const isBranded = handleVisual?.dataset.brandingKind !== "none";
	const showSliderDateLabels = canvas.dataset.showSliderDateLabels === "true";

	// --- Position state (mirrors src/components/ComparisonSlider.tsx's
	// local `position`/`isDragging`/pointer-ownership state). ---
	let position = clampPercent(
		Number.parseFloat(handle?.style.insetInlineStart || "50") || 50,
	);
	let isDragging = false;
	let activePointerId: number | null = null;
	let dragOriginLeftPx = 0;
	let frameWidthPx = 0;
	// The Handle's own currently rendered size (docs/COMPARISON_PRESENTATION.md
	// Part 2 "Handle", "Responsive Handle Size on a Small Presentation
	// Stage") — kept up to date by `recomputeGeometry()` below, from the
	// exact same src/lib/comparison-handle-geometry.ts `getHandleVisualSizePx`
	// the live Workspace Preview also calls. Initialized to the documented
	// base size (this call's `(0, 0, …)` is exactly `getHandleVisualSizePx`'s
	// own "not yet measured" fallback), matching the static bootstrap value
	// src/lib/comparison-artifact-markup.ts already renders into the markup
	// before this script ever runs — authoritative from the first real
	// geometry measurement onward.
	let handleVisualSizePx = getHandleVisualSizePx(0, 0, isBranded);

	function renderPosition(): void {
		referenceImage.style.clipPath = `inset(0 ${100 - position}% 0 0)`;
		if (dividerLine) dividerLine.style.insetInlineStart = `${position}%`;
		if (handle) {
			handle.style.insetInlineStart = `${position}%`;
			handle.setAttribute("aria-valuenow", String(Math.round(position)));
		}
		updateLabels();
	}

	function updateLabels(): void {
		if (!labelLeft || !labelRight) return;
		const dividerXPx = dividerPositionPx(position, frameWidthPx);
		const effectiveRingRadiusPx = getEffectiveRingRadiusPx(handleVisualSizePx);
		const labelFont = buildSliderLabelFont(presentationFontFamily);
		const leftWidthPx = measureTextWidth(
			labelLeft.textContent ?? "",
			labelFont,
		);
		const rightWidthPx = measureTextWidth(
			labelRight.textContent ?? "",
			labelFont,
		);
		const { showLeft, showRight } = computeLabelVisibility({
			showDateLabels: showSliderDateLabels,
			frameWidthPx,
			dividerXPx,
			effectiveRingRadiusPx,
			labelGapPx: LABEL_GAP_PX,
			leftLabelWidthPx: leftWidthPx,
			rightLabelWidthPx: rightWidthPx,
		});
		labelLeft.style.display = showLeft ? "" : "none";
		labelRight.style.display = showRight ? "" : "none";
		if (showLeft) {
			labelLeft.style.insetInlineStart = `${dividerXPx - effectiveRingRadiusPx - LABEL_GAP_PX}px`;
			labelLeft.style.transform = "translate(-100%, -50%)";
		}
		if (showRight) {
			labelRight.style.insetInlineStart = `${dividerXPx + effectiveRingRadiusPx + LABEL_GAP_PX}px`;
			labelRight.style.transform = "translateY(-50%)";
		}
	}

	function updatePositionFromClientX(
		clientX: number,
		leftPx: number,
		widthPx: number,
	): void {
		const next = positionFromClientX(clientX, leftPx, widthPx);
		if (next !== undefined) {
			position = next;
			renderPosition();
		}
	}

	sliderFrame.addEventListener("pointerdown", (event: PointerEvent) => {
		if (!readyTriggered) return;
		const rect = sliderFrame.getBoundingClientRect();
		dragOriginLeftPx = rect.left;
		activePointerId = event.pointerId;
		try {
			sliderFrame.setPointerCapture(event.pointerId);
		} catch {
			// Best-effort, mirrors src/components/ComparisonSlider.tsx.
		}
		isDragging = true;
		updatePositionFromClientX(event.clientX, rect.left, rect.width);
	});
	sliderFrame.addEventListener("pointermove", (event: PointerEvent) => {
		if (!isDragging || event.pointerId !== activePointerId) return;
		updatePositionFromClientX(event.clientX, dragOriginLeftPx, frameWidthPx);
	});
	function endDrag(event: PointerEvent): void {
		if (event.pointerId !== activePointerId) return;
		isDragging = false;
		activePointerId = null;
		if (sliderFrame.hasPointerCapture(event.pointerId)) {
			sliderFrame.releasePointerCapture(event.pointerId);
		}
	}
	sliderFrame.addEventListener("pointerup", endDrag);
	sliderFrame.addEventListener("pointercancel", endDrag);
	handle?.addEventListener("keydown", (event: KeyboardEvent) => {
		const next = nextPositionForKey(event.key, position);
		if (next === undefined) return;
		event.preventDefault();
		position = next;
		renderPosition();
	});

	new ResizeObserver((entries) => {
		const entry = entries[0];
		if (!entry) return;
		frameWidthPx = entry.contentRect.width;
		updateLabels();
	}).observe(sliderFrame);

	// --- Image load gating (mirrors ComparisonSlider.tsx's bothLoaded). ---
	let referenceLoaded =
		referenceImage.complete && referenceImage.naturalWidth > 0;
	let captureLoaded = captureImage.complete && captureImage.naturalWidth > 0;
	let ratio: number | null = null;
	// Separate from `referenceLoaded`/`captureLoaded` above on purpose: those
	// two can already both be `true` the instant this script runs (a `data:`
	// URI image, or any already-cached one, can report `.complete` before a
	// single `handleImageLoad` call has ever happened) — gating the one-time
	// ready sequence on "both loaded and not already loaded" would then never
	// fire at all, since "already loaded" is true from the very first check.
	// This flag exists solely to make the ready sequence run exactly once,
	// independent of whether that happens synchronously (both already
	// complete) or asynchronously (via one or two real `load` events).
	let readyTriggered = false;

	// Declared here, before `handleImageLoad` can possibly call
	// `startGeometryConvergence()` synchronously (a few lines below, when
	// both images are already `.complete` the instant this script runs) —
	// `startGeometryConvergence`/`recomputeGeometry` are function
	// declarations (hoisted in full), but the `let` bindings they close over
	// are not initialized until their own declaration actually runs; calling
	// either function before that point throws a `ReferenceError` for
	// accessing a `let` binding in its temporal dead zone. Confirmed by an
	// actual failing run, not a theoretical concern.
	let measuredWidthPx: number | null = null;
	let measurementCount = 0;
	let metadataHeightPx = 0;
	let frameWidthResolved = 0;
	let geometryStarted = false;

	function markReady(): void {
		sliderFrame.classList.remove("comparison-slider__frame--loading");
		sliderFrame.classList.add("comparison-slider__frame--ready");
		captureImage.style.visibility = "visible";
		referenceImage.style.visibility = "visible";
		if (loading) loading.style.display = "none";
		if (dividerLine) dividerLine.style.display = "";
		if (handle) handle.style.display = "";
		renderPosition();
	}

	function handleImageLoad(which: "reference" | "capture"): void {
		if (which === "reference") referenceLoaded = true;
		else captureLoaded = true;
		if (!readyTriggered && referenceLoaded && captureLoaded) {
			readyTriggered = true;
			const naturalWidth =
				which === "reference"
					? referenceImage.naturalWidth
					: captureImage.naturalWidth;
			const naturalHeight =
				which === "reference"
					? referenceImage.naturalHeight
					: captureImage.naturalHeight;
			ratio = deriveImageRatio({ width: naturalWidth, height: naturalHeight });
			markReady();
			startGeometryConvergence();
		}
	}
	if (referenceLoaded) handleImageLoad("reference");
	else
		referenceImage.addEventListener("load", () => handleImageLoad("reference"));
	if (captureLoaded) handleImageLoad("capture");
	else captureImage.addEventListener("load", () => handleImageLoad("capture"));

	// --- Canvas geometry convergence (mirrors WorkspaceActive.tsx's
	// `PresentationCanvas`: measure the info block, derive Stage/Canvas size
	// from src/lib/canvas-geometry.ts, re-measure at the new width until the
	// measured width matches the requested one within tolerance or the
	// safety cap is reached). State declared above, before this section. ---

	function applyCanvasWidth(widthPx: number): void {
		canvas.style.setProperty("--stage-width", `${widthPx}px`);
	}

	function recomputeGeometry(): void {
		if (ratio === null) return;
		const previewWidth = outputFrame.clientWidth;
		const previewHeight = outputFrame.clientHeight;
		if (previewWidth <= 0 || previewHeight <= 0) return;
		const geometry = computeCanvasGeometry({
			previewWidth,
			previewHeight,
			ratio,
			metadataHeight: metadataHeightPx,
			canvasPadding: CANVAS_PADDING_PX,
			contentGap: CANVAS_CONTENT_GAP_PX,
			frameWidth: frameWidthResolved,
		});
		canvas.style.setProperty("--stage-width", `${geometry.stageWidth}px`);
		canvas.style.setProperty("--stage-height", `${geometry.stageHeight}px`);
		canvas.style.setProperty("--canvas-width", `${geometry.canvasWidth}px`);
		canvas.style.setProperty("--canvas-height", `${geometry.canvasHeight}px`);
		canvas.style.setProperty("--canvas-padding", `${CANVAS_PADDING_PX}px`);
		canvas.style.setProperty(
			"--content-gap",
			metadataHeightPx > 0 ? `${CANVAS_CONTENT_GAP_PX}px` : "0px",
		);

		// docs/COMPARISON_PRESENTATION.md Part 2 "Handle", "Responsive Handle
		// Size on a Small Presentation Stage": recomputed on every geometry
		// pass (this function already runs on every relevant resize, via the
		// two ResizeObservers below) from the Stage's own just-computed size —
		// dynamic, resize-reactive, and never dependent on regenerating this
		// document. `handleVisualSizePx` (module-scoped) is updated before
		// this function returns, so `updateLabels()` — triggered next by the
		// `sliderFrame` ResizeObserver below reacting to this same
		// `--stage-width`/`--stage-height` change — always reads the current
		// value, never a stale one.
		handleVisualSizePx = getHandleVisualSizePx(
			geometry.stageWidth,
			geometry.stageHeight,
			isBranded,
		);
		if (handleVisual) {
			handleVisual.style.width = `${handleVisualSizePx}px`;
			handleVisual.style.height = `${handleVisualSizePx}px`;
		}

		const isStable =
			measurementCount >= MAX_GEOMETRY_MEASUREMENTS ||
			(measuredWidthPx !== null &&
				Math.abs(measuredWidthPx - geometry.stageWidth) <=
					GEOMETRY_STABILITY_TOLERANCE_PX);
		if (isStable) {
			canvas.classList.add("presentation-canvas--ready");
			applyAdaptiveSizing(geometry.stageWidth);
		}
	}

	function startGeometryConvergence(): void {
		if (geometryStarted) return;
		geometryStarted = true;
		frameWidthResolved = Number.parseFloat(
			getComputedStyle(canvas).getPropertyValue("--frame-width") || "0",
		);
		if (outputFrame.clientWidth > 0) {
			applyCanvasWidth(
				initialMetadataWidth(
					outputFrame.clientWidth,
					CANVAS_PADDING_PX,
					frameWidthResolved,
				),
			);
		}
		new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			measuredWidthPx = entry.contentRect.width;
			measurementCount += 1;
			metadataHeightPx = entry.contentRect.height;
			recomputeGeometry();
		}).observe(infoWrapper);
		new ResizeObserver(() => recomputeGeometry()).observe(outputFrame);
	}

	// --- Adaptive Sizing (mirrors ComparisonPresentationInfo.tsx's
	// per-item useAdaptiveTextSize, applied once the Stage width settles). ---
	function applyAdaptiveSizing(stableWidthPx: number): void {
		applyAdaptiveSize(
			titleEl,
			titleEl?.textContent ?? "",
			buildTitleFont(presentationFontFamily),
			1,
			stableWidthPx,
			"presentation-info__title--compact",
		);
		applyAdaptiveSize(
			descriptionEl,
			descriptionEl?.textContent ?? "",
			buildDescriptionFont(presentationFontFamily),
			2,
			stableWidthPx,
			"presentation-info__description--compact",
		);
		applyAdaptiveSize(
			timeEl,
			timeEl?.textContent ?? "",
			buildTimeFont(presentationFontFamily),
			1,
			stableWidthPx,
			"presentation-info__time--compact",
		);
		applyAdaptiveSize(
			locationEl,
			locationEl?.textContent ?? "",
			buildLocationFont(presentationFontFamily),
			1,
			stableWidthPx,
			"presentation-info__location--compact",
		);
	}

	// --- Overflow Tooltip: the exact same framework-independent module the
	// live Preview already uses, attached unchanged to this instance's own
	// root — its own trigger set, tooltip element and document/window-level
	// listeners are all closure-local to this one call
	// (src/lib/overflow-tooltip.ts), so a second instance's own call below
	// never shares anything with this one. No per-instance `testId`: nothing
	// about tooltip *content* or *visibility* independence depends on it. ---
	attachPresentationOverflowTooltips(canvas);
}

// docs/IMPLEMENTATION_PLAN_V1.md Phase 13: discovers every `.presentation-canvas`
// root currently in the document and initializes each independently — one
// root (Standalone HTML/Static Microsite, unchanged behavior) or several (a
// future multi-Comparison host page). Calling this function again (e.g. the
// bundled script accidentally included twice on one page) is a safe no-op
// for every already-initialized root, per `initInstance`'s own guard above.
export function initComparisonPresentation(): void {
	if (typeof document === "undefined") return;
	for (const canvas of document.querySelectorAll<HTMLElement>(
		".presentation-canvas",
	)) {
		initInstance(canvas);
	}
}
