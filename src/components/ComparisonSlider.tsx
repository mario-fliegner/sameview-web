// The interactive comparison (docs/FEATURE_SPECIFICATION.md F-002; the
// approved Viewer architecture analyses). Reveals the reference image over
// the capture image via a pointer/touch/keyboard-operable divider.
//
// Deliberately reusable and "dumb": every prop is a plain, already-resolved
// value (strings, a src) — this component never calls useLocale() itself
// (i18n resolution stays in the caller, docs/... this iteration's own
// requirement) and never reads Current Working State directly, so the exact
// same component can later render inside Fullscreen or a generated
// Standalone HTML artifact without modification. `leftLabel`/`rightLabel`
// arrive as plain, already-derived strings for the same reason — the Android
// priority-chain logic that produces them lives in
// src/lib/compare-slider-labels.ts, never in this component.
//
// The reference and capture images are guaranteed by the SameView Android
// export contract to share identical dimensions, aspect ratio, crop and
// alignment (confirmed product decision) — this component does not
// reconcile, crop or independently scale them; it reads the shared aspect
// ratio once, from whichever image's `onLoad` fires first.
//
// Position is uncontrolled local state: nothing outside this component
// needs to read or set it in this iteration (no synchronization, no
// persistence, no external reset control). It is isolated behind local
// `useState` specifically so that promoting it to an optional controlled
// prop later — if Fullscreen or synchronization ever need it — is a small,
// local change, not a rewrite.
//
// Handle geometry (ring, chevrons, divider line) is the SameView Android
// production Compare screen's own geometry
// (sameview/app/src/main/java/com/isardomains/sameview/ui/compare/CompareScreen.kt
// `CompareDivider`), transcribed 1:1 from its dp constants and Canvas/Path
// drawing into an inline SVG — an SVG reproduces the two gapped ring arcs
// and the chevron paths far more faithfully than a CSS-only approximation
// could. See src/components/ComparisonSliderHandle.tsx for the exact
// Android values each figure comes from: that component now owns the
// handle's full visual (ring, circle and its Standard/Symbol/Custom-Image
// inner content, docs/FEATURE_SPECIFICATION.md F-004), so this component
// only positions/drags a plain wrapper around it and never needs to know
// which of the three Session Branding states is currently active.

import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	type SyntheticEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { HandleBranding } from "../lib/branding";
import { buildSliderLabelFont } from "../lib/comparison-canvas-fonts";
import {
	getEffectiveRingRadiusPx,
	getHandleVisualSizePx,
} from "../lib/comparison-handle-geometry";
import {
	computeLabelVisibility,
	dividerPositionPx,
	nextPositionForKey,
	positionFromClientX,
} from "../lib/comparison-slider-interaction";
import { measureTextWidth } from "../lib/text-measurement";
import ComparisonSliderHandle from "./ComparisonSliderHandle";

interface ComparisonSliderProps {
	readonly referenceSrc: string | undefined;
	readonly captureSrc: string | undefined;
	readonly referenceAlt: string;
	readonly captureAlt: string;
	readonly sliderLabel: string;
	readonly loadingLabel: string;
	readonly leftLabel: string;
	readonly rightLabel: string;
	// Session Branding (docs/FEATURE_SPECIFICATION.md F-004) — an
	// already-resolved value; this component never reads Current Working
	// State or decides which branding state is active, exactly like every
	// other prop here (see the module comment above).
	readonly branding: HandleBranding;
	readonly brandingSrc: string | undefined;
	// docs/COMPARISON_PRESENTATION.md Part 3 "Comparison Stage": "Show Slider
	// Date Labels", default On. Gates the same auto-hide-at-edge labels below
	// as one additional condition — it never changes the edge-collision math
	// itself, only whether a label already eligible to show is actually
	// rendered.
	readonly showDateLabels: boolean;
	// The resolved Presentation Font's CSS `font-family` stack
	// (docs/COMPARISON_PRESENTATION.md Part 3 "Typography"), already
	// resolved by src/lib/presentation-fonts.ts — this component never reads
	// `PresentationConfiguration` itself, exactly like every other
	// already-resolved value here (see module comment above).
	readonly presentationFontFamily: string;
	// Additive and optional. Reports the natural pixel dimensions already
	// held in this component's own `dimensions` state below (the same value
	// `--comparison-ratio` is derived from) — fires exactly once both images
	// have loaded, never earlier, so a parent never has to separately track
	// or reconcile its own "images ready" signal against this one.
	readonly onDimensionsChange?: (dimensions: {
		readonly width: number;
		readonly height: number;
	}) => void;
}

// Android CompareHandleLabelGap = 8.dp. Unlike the ring radius below, this
// gap has no Android precedent for scaling with branding enlargement
// (Android's own interactive divider never shows branding at all — see
// src/lib/comparison-handle-geometry.ts's own header comment) and is kept
// as a fixed addend for that reason, not scaled.
const LABEL_GAP_PX = 8;

export default function ComparisonSlider({
	referenceSrc,
	captureSrc,
	referenceAlt,
	captureAlt,
	sliderLabel,
	loadingLabel,
	leftLabel,
	rightLabel,
	showDateLabels,
	branding,
	brandingSrc,
	presentationFontFamily,
	onDimensionsChange,
}: ComparisonSliderProps) {
	const frameRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState(50);
	const [isDragging, setIsDragging] = useState(false);
	const [referenceLoaded, setReferenceLoaded] = useState(false);
	const [captureLoaded, setCaptureLoaded] = useState(false);
	// Read once, from whichever image loads first — both are guaranteed
	// identical, so it does not matter which one supplies it.
	const [dimensions, setDimensions] = useState<{
		readonly width: number;
		readonly height: number;
	} | null>(null);
	const bothLoaded = referenceLoaded && captureLoaded;

	// Reports the natural dimensions outward once both images have loaded —
	// deliberately not earlier: `dimensions` alone already settles after just
	// the first of the two images loads (see `handleImageLoad` below), which
	// is not yet the same thing as this component actually being ready.
	useEffect(() => {
		if (bothLoaded && dimensions) {
			onDimensionsChange?.(dimensions);
		}
	}, [bothLoaded, dimensions, onDimensionsChange]);

	// Tracks the frame's own rendered width without ever calling
	// getBoundingClientRect() from a pointermove handler: a forced layout
	// read on every pointer-move event is the main smoothness cost this
	// iteration removes (it forces the browser to flush any pending
	// style/layout work synchronously before it can answer, on every single
	// event of a high-frequency stream). ResizeObserver reports the same
	// number, but only when the box's size genuinely changes.
	const [frameWidthPx, setFrameWidthPx] = useState(0);
	// The frame's own rendered height — read from the exact same
	// ResizeObserver entry as `frameWidthPx` above (never a second
	// observer), needed alongside it for src/lib/comparison-handle-geometry.ts
	// `getHandleVisualSizePx`, which scales the Handle down against the
	// Presentation Stage's own *shorter* side (docs/COMPARISON_PRESENTATION.md
	// Part 2 "Handle", "Responsive Handle Size on a Small Presentation
	// Stage") — this frame's rendered box already *is* the Stage's own size
	// (`.comparison-slider__frame--ready`'s `width`/`height` come directly
	// from `--stage-width`/`--stage-height`, src/styles/comparison-presentation.css),
	// so no second measurement of "the Stage" is needed anywhere else.
	const [frameHeightPx, setFrameHeightPx] = useState(0);
	// The one remaining read per drag *gesture* (not per move): the frame's
	// viewport-relative left edge, needed to convert an absolute clientX into
	// a fraction of the frame. Captured once at pointerdown and reused for
	// every subsequent pointermove in that same gesture — this layout does
	// not scroll horizontally, so the value cannot change mid-drag.
	const dragOriginLeftRef = useRef(0);
	// Identifies which pointer owns the active drag so an unrelated
	// concurrent pointer (a second touch, a stylus while a finger is still
	// down) can neither move nor terminate it.
	const activePointerIdRef = useRef<number | null>(null);

	useEffect(() => {
		const frame = frameRef.current;
		if (!frame) return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			setFrameWidthPx(entry.contentRect.width);
			setFrameHeightPx(entry.contentRect.height);
		});
		observer.observe(frame);
		return () => observer.disconnect();
	}, []);

	// docs/COMPARISON_PRESENTATION.md Part 3 "Typography": the font-family
	// portion of the measured label font, not a fixed constant — see
	// src/lib/comparison-canvas-fonts.ts `buildSliderLabelFont`.
	const labelFont = useMemo(
		() => buildSliderLabelFont(presentationFontFamily),
		[presentationFontFamily],
	);

	// Forces the two label-width measurements below to re-run once the
	// selected Presentation Font's actual webfont file has finished loading
	// — the same reasoning and mechanism as
	// src/components/ComparisonPresentationInfo.tsx's own `fontsReadyTick`
	// (see that component's header comment for the full argument): without
	// this, a measurement taken before the real file has finished loading
	// would silently use the fallback font's metrics until some unrelated
	// re-render happened to measure again.
	const [fontsReadyTick, setFontsReadyTick] = useState(0);
	useEffect(() => {
		let cancelled = false;
		void document.fonts.load(labelFont).then(() => {
			if (!cancelled) setFontsReadyTick((tick) => tick + 1);
		});
		return () => {
			cancelled = true;
		};
	}, [labelFont]);

	// Measured only when the label text or font changes, never on every
	// pointer move — the priority-chain in src/lib/compare-slider-labels.ts
	// only re-derives these strings when the underlying dates/locale change,
	// so re-measuring on every render they're stable is itself already rare.
	// biome-ignore lint/correctness/useExhaustiveDependencies: fontsReadyTick is a deliberate recompute trigger, intentionally unused inside — see the comment above.
	const leftLabelWidthPx = useMemo(
		() => measureTextWidth(leftLabel, labelFont),
		[leftLabel, labelFont, fontsReadyTick],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: fontsReadyTick is a deliberate recompute trigger, intentionally unused inside — see the comment above.
	const rightLabelWidthPx = useMemo(
		() => measureTextWidth(rightLabel, labelFont),
		[rightLabel, labelFont, fontsReadyTick],
	);

	function handleImageLoad(
		which: "reference" | "capture",
		event: SyntheticEvent<HTMLImageElement>,
	) {
		if (which === "reference") setReferenceLoaded(true);
		else setCaptureLoaded(true);
		// Captured synchronously into locals: `event.currentTarget` is only
		// valid for the duration of this handler, not inside the setState
		// updater below, which React may invoke later.
		const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
		setDimensions((previous) => previous ?? { width, height });
	}

	function updatePositionFromClientX(
		clientX: number,
		leftPx: number,
		widthPx: number,
	) {
		const next = positionFromClientX(clientX, leftPx, widthPx);
		if (next !== undefined) setPosition(next);
	}

	function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
		if (!bothLoaded) return;
		const frame = event.currentTarget;
		const rect = frame.getBoundingClientRect();
		dragOriginLeftRef.current = rect.left;
		activePointerIdRef.current = event.pointerId;
		// Best-effort: some pointer sequences (already-released, or otherwise
		// not eligible for capture in a given browser) can make this throw —
		// the drag itself only actually depends on capture once the pointer
		// leaves the frame's own bounds, so a failed capture here should not
		// abort the interaction.
		try {
			frame.setPointerCapture(event.pointerId);
		} catch {
			// Deliberately ignored — see comment above.
		}
		setIsDragging(true);
		// Uses the just-measured rect.width rather than waiting on the next
		// ResizeObserver callback, so the initial click-to-position jump is
		// correct even on the very first interaction.
		updatePositionFromClientX(event.clientX, rect.left, rect.width);
	}

	function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
		if (!isDragging) return;
		if (event.pointerId !== activePointerIdRef.current) return;
		updatePositionFromClientX(
			event.clientX,
			dragOriginLeftRef.current,
			frameWidthPx,
		);
	}

	function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
		if (event.pointerId !== activePointerIdRef.current) return;
		setIsDragging(false);
		activePointerIdRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	}

	function handleHandleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		const next = nextPositionForKey(event.key, position);
		if (next === undefined) return;
		event.preventDefault();
		setPosition(next);
	}

	const frameStyle: CSSProperties | undefined =
		bothLoaded && dimensions
			? ({
					"--comparison-ratio": dimensions.width / dimensions.height,
				} as CSSProperties)
			: undefined;

	// The Handle's own rendered size (docs/COMPARISON_PRESENTATION.md Part 2
	// "Handle", "Responsive Handle Size on a Small Presentation Stage") —
	// the single shared computation src/lib/comparison-handle-geometry.ts
	// `getHandleVisualSizePx` also drives for the generated Standalone
	// HTML/Static Microsite runtime, from the exact same two inputs
	// (`frameWidthPx`/`frameHeightPx` above *are* the Presentation Stage's
	// own rendered size — see that state's own comment).
	const handleVisualSizePx = getHandleVisualSizePx(
		frameWidthPx,
		frameHeightPx,
		branding.kind !== "none",
	);

	// Android CompareDivider: showLeftLabel/showRightLabel — each label
	// independently disappears once its own measured bounds would reach or
	// cross the corresponding Viewer edge, not at an arbitrary percentage.
	// The ring radius used here must reflect the handle as it is actually
	// rendered (src/components/ComparisonSliderHandle.tsx) — a fixed,
	// always-standard radius let labels overlap an enlarged branded handle,
	// and later, before responsive scaling existed, would have let them
	// overlap a Handle now rendered smaller on a shrunk Stage too (see
	// src/lib/comparison-handle-geometry.ts's own header comment).
	const dividerXPx = dividerPositionPx(position, frameWidthPx);
	const effectiveRingRadiusPx = getEffectiveRingRadiusPx(handleVisualSizePx);
	const { showLeft: showLeftLabel, showRight: showRightLabel } =
		computeLabelVisibility({
			showDateLabels,
			frameWidthPx,
			dividerXPx,
			effectiveRingRadiusPx,
			labelGapPx: LABEL_GAP_PX,
			leftLabelWidthPx,
			rightLabelWidthPx,
		});

	return (
		<div
			ref={frameRef}
			className={`comparison-slider__frame ${
				bothLoaded
					? "comparison-slider__frame--ready"
					: "comparison-slider__frame--loading"
			}`}
			style={frameStyle}
			data-testid="comparison-slider"
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
		>
			<img
				src={captureSrc}
				alt={captureAlt}
				data-testid="capture-image"
				className="comparison-slider__image"
				draggable={false}
				style={{ visibility: bothLoaded ? "visible" : "hidden" }}
				onLoad={(event) => handleImageLoad("capture", event)}
			/>
			<img
				src={referenceSrc}
				alt={referenceAlt}
				data-testid="reference-image"
				className="comparison-slider__image comparison-slider__image--overlay"
				draggable={false}
				style={{
					visibility: bothLoaded ? "visible" : "hidden",
					clipPath: `inset(0 ${100 - position}% 0 0)`,
				}}
				onLoad={(event) => handleImageLoad("reference", event)}
			/>
			{bothLoaded && (
				<>
					{/* Rendered before the handle, not after: this <div> must sit
					    *underneath* the opaque ring/circle/branding-content SVG in
					    paint order so that SVG genuinely occludes it wherever they
					    overlap, leaving it visible only through the ring's own 12°
					    gaps — the same visual result Android's CompareDivider relies
					    on, but achieved here by real stacking rather than by the
					    coincidence (white-on-white, arrows with a center gap) that
					    made stacking order irrelevant for Android's own always-
					    unbranded live handle. Drawing this after the handle (the
					    previous order) let the line visibly cut across non-white
					    branding content (a Built-in Symbol or Custom Image) — see
					    src/lib/comparison-handle-geometry.ts's own header comment. */}
					<div
						className="comparison-slider__divider-line"
						data-testid="comparison-divider-line"
						style={{ insetInlineStart: `${position}%` }}
					/>
					<div
						className="comparison-slider__handle"
						role="slider"
						aria-label={sliderLabel}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(position)}
						tabIndex={0}
						style={{ insetInlineStart: `${position}%` }}
						onKeyDown={handleHandleKeyDown}
					>
						<ComparisonSliderHandle
							branding={branding}
							brandingSrc={brandingSrc}
							visualSizePx={handleVisualSizePx}
						/>
					</div>
					{showLeftLabel && (
						<span
							className="comparison-slider__label"
							data-testid="comparison-slider-label-left"
							style={{
								insetInlineStart: `${dividerXPx - effectiveRingRadiusPx - LABEL_GAP_PX}px`,
								transform: "translate(-100%, -50%)",
							}}
						>
							{leftLabel}
						</span>
					)}
					{showRightLabel && (
						<span
							className="comparison-slider__label"
							data-testid="comparison-slider-label-right"
							style={{
								insetInlineStart: `${dividerXPx + effectiveRingRadiusPx + LABEL_GAP_PX}px`,
								transform: "translateY(-50%)",
							}}
						>
							{rightLabel}
						</span>
					)}
				</>
			)}
			{!bothLoaded && (
				<p
					className="comparison-slider__loading"
					data-testid="comparison-loading"
					aria-live="polite"
				>
					{loadingLabel}
				</p>
			)}
		</div>
	);
}
