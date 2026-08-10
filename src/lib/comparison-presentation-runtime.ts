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
// Reads only the fixed `id="sameview-*"` markup contract
// src/lib/comparison-artifact-markup.ts establishes — no data passed in
// via globals/config objects, so the same script works unmodified for
// either output type and needs no build-time templating of its own source.

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
import { getEffectiveRingRadiusPx } from "./comparison-handle-geometry.ts";
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

function byId<T extends Element>(id: string): T | null {
	return document.getElementById(id) as T | null;
}

// The markup contract src/lib/comparison-artifact-markup.ts always emits
// these elements unconditionally (unlike e.g. the Title/Description/Time/
// Location items, which are only rendered when actually visible) — a
// missing one here means the scaffold/runtime contract itself is out of
// sync, a genuine bug to fail loudly on, not a legitimate optional-content
// case. Returning a definite (non-null) type, rather than narrowing a
// nullable `const` via an early return, is also what lets every closure
// below (event handlers, ResizeObserver callbacks) use these directly
// without TypeScript's closure-narrowing limitation re-widening them back
// to `T | null` at each use site.
function requireElement<T extends Element>(id: string): T {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(
			`Comparison Presentation runtime: missing #${id} in markup`,
		);
	}
	return element as unknown as T;
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

export function initComparisonPresentation(): void {
	if (typeof document === "undefined") return;

	const outputFrame = requireElement<HTMLElement>("sameview-output-frame");
	const canvas = requireElement<HTMLElement>("sameview-canvas");
	const sliderFrame = requireElement<HTMLElement>("sameview-slider-frame");
	const captureImage = requireElement<HTMLImageElement>(
		"sameview-capture-image",
	);
	const referenceImage = requireElement<HTMLImageElement>(
		"sameview-reference-image",
	);
	const dividerLine = byId<HTMLElement>("sameview-divider-line");
	const handle = byId<HTMLElement>("sameview-handle");
	const handleVisual = byId<SVGElement>("sameview-handle-visual");
	const labelLeft = byId<HTMLElement>("sameview-label-left");
	const labelRight = byId<HTMLElement>("sameview-label-right");
	const loading = byId<HTMLElement>("sameview-loading");
	const infoWrapper = requireElement<HTMLElement>("sameview-info-wrapper");
	const titleEl = byId<HTMLElement>("sameview-title");
	const descriptionEl = byId<HTMLElement>("sameview-description");
	const timeEl = byId<HTMLElement>("sameview-time");
	const locationEl = byId<HTMLElement>("sameview-location");

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
		const effectiveRingRadiusPx = getEffectiveRingRadiusPx(isBranded);
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
	// live Preview already uses, attached unchanged to this document's own
	// root. ---
	attachPresentationOverflowTooltips(canvas);
}
