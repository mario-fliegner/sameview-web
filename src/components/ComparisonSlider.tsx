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
// could. See the constants below for the exact Android values each figure
// come from.

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

interface ComparisonSliderProps {
	readonly referenceSrc: string | undefined;
	readonly captureSrc: string | undefined;
	readonly referenceAlt: string;
	readonly captureAlt: string;
	readonly sliderLabel: string;
	readonly loadingLabel: string;
	readonly leftLabel: string;
	readonly rightLabel: string;
}

const KEYBOARD_STEP = 5;

// Android CompareScreen.kt: CompareSliderHandleSize = 48.dp (the white
// circle), CompareSliderRingGap = 1.dp, CompareSliderRingThickness = 2.dp.
// The ring's own diameter is handle + 2*(gap + thickness) = 54, i.e. radius
// 27 — this is also the radius Android's own label-position formula
// (`handleRadiusPx`) measures from, not the smaller 24 handle radius.
const HANDLE_RADIUS_PX = 24;
const RING_RADIUS_PX = 27;
const RING_STROKE_WIDTH_PX = 2;
// Android CompareHandleLabelGap = 8.dp.
const LABEL_GAP_PX = 8;
// Android's accent color (SameViewAccent = 0xFF4F8CFF), already identical to
// this app's existing accent — reused as-is rather than introducing a
// second, slightly different blue.
const ACCENT_COLOR = "#4f8cff";
// Label font must match `.comparison-slider__label` in global.css exactly —
// canvas measureText() only reports the width the browser will actually
// render for this font, not an approximation.
const LABEL_FONT =
	'600 0.875rem ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

// Two broken ring arcs (viewBox 0 0 54 54, center 27,27, radius 26 — the
// stroke's own centerline so a 2px stroke spans radius 25–27, matching
// Android's ring canvas) with a 12° gap top and bottom for the divider line
// to visually pass through, transcribed from CompareSliderRingGapAngle = 12f
// and the two drawArc() calls in CompareDivider.
const RING_ARC_LEFT = "M 21.594 52.432 A 26 26 0 0 1 21.594 1.568";
const RING_ARC_RIGHT = "M 32.406 1.568 A 26 26 0 0 1 32.406 52.432";
// Chevron paths, transcribed from CompareDivider's Canvas: unit = 48/48 = 1,
// arrowCenterOffset = 9, halfDepth = 4, halfH = 7, centered on (27, 27).
const CHEVRON_LEFT = "M 22 20 L 14 27 L 22 34";
const CHEVRON_RIGHT = "M 32 20 L 40 27 L 32 34";

let measurementCanvas: HTMLCanvasElement | null = null;

// Mirrors Android's TextMeasurer role for the edge-hiding rule below: a pure
// text-shaping measurement, independent of DOM layout, so it never forces a
// layout read the way measuring a rendered element's own box would.
function measureLabelWidth(text: string): number {
	if (typeof document === "undefined") return 0;
	measurementCanvas ??= document.createElement("canvas");
	const context = measurementCanvas.getContext("2d");
	if (!context) return 0;
	context.font = LABEL_FONT;
	return context.measureText(text).width;
}

function clampPercent(value: number): number {
	return Math.min(100, Math.max(0, value));
}

export default function ComparisonSlider({
	referenceSrc,
	captureSrc,
	referenceAlt,
	captureAlt,
	sliderLabel,
	loadingLabel,
	leftLabel,
	rightLabel,
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

	// Tracks the frame's own rendered width without ever calling
	// getBoundingClientRect() from a pointermove handler: a forced layout
	// read on every pointer-move event is the main smoothness cost this
	// iteration removes (it forces the browser to flush any pending
	// style/layout work synchronously before it can answer, on every single
	// event of a high-frequency stream). ResizeObserver reports the same
	// number, but only when the box's size genuinely changes.
	const [frameWidthPx, setFrameWidthPx] = useState(0);
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
			if (entry) setFrameWidthPx(entry.contentRect.width);
		});
		observer.observe(frame);
		return () => observer.disconnect();
	}, []);

	// Measured only when the label text changes, never on every pointer
	// move — the priority-chain in src/lib/compare-slider-labels.ts only
	// re-derives these strings when the underlying dates/locale change, so
	// re-measuring on every render they're stable is itself already rare.
	const leftLabelWidthPx = useMemo(
		() => measureLabelWidth(leftLabel),
		[leftLabel],
	);
	const rightLabelWidthPx = useMemo(
		() => measureLabelWidth(rightLabel),
		[rightLabel],
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
		if (widthPx === 0) return;
		const ratio = (clientX - leftPx) / widthPx;
		setPosition(clampPercent(ratio * 100));
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
		if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
			event.preventDefault();
			setPosition((current) => Math.max(0, current - KEYBOARD_STEP));
		} else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
			event.preventDefault();
			setPosition((current) => Math.min(100, current + KEYBOARD_STEP));
		} else if (event.key === "Home") {
			event.preventDefault();
			setPosition(0);
		} else if (event.key === "End") {
			event.preventDefault();
			setPosition(100);
		}
	}

	const frameStyle: CSSProperties | undefined =
		bothLoaded && dimensions
			? ({
					"--comparison-ratio": dimensions.width / dimensions.height,
				} as CSSProperties)
			: undefined;

	// Android CompareDivider: showLeftLabel/showRightLabel — each label
	// independently disappears once its own measured bounds would reach or
	// cross the corresponding Viewer edge, not at an arbitrary percentage.
	const dividerXPx = (position / 100) * frameWidthPx;
	const showLeftLabel =
		frameWidthPx > 0 &&
		dividerXPx - RING_RADIUS_PX - LABEL_GAP_PX - leftLabelWidthPx >= 0;
	const showRightLabel =
		frameWidthPx > 0 &&
		dividerXPx + RING_RADIUS_PX + LABEL_GAP_PX + rightLabelWidthPx <=
			frameWidthPx;

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
						<svg
							className="comparison-slider__handle-visual"
							viewBox="0 0 54 54"
							aria-hidden="true"
							focusable="false"
						>
							<path
								d={RING_ARC_LEFT}
								fill="none"
								stroke="#ffffff"
								strokeWidth={RING_STROKE_WIDTH_PX}
							/>
							<path
								d={RING_ARC_RIGHT}
								fill="none"
								stroke="#ffffff"
								strokeWidth={RING_STROKE_WIDTH_PX}
							/>
							<circle cx="27" cy="27" r={HANDLE_RADIUS_PX} fill="#ffffff" />
							<path
								d={CHEVRON_LEFT}
								fill="none"
								stroke={ACCENT_COLOR}
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
							<path
								d={CHEVRON_RIGHT}
								fill="none"
								stroke={ACCENT_COLOR}
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
					<div
						className="comparison-slider__divider-line"
						data-testid="comparison-divider-line"
						style={{ insetInlineStart: `${position}%` }}
					/>
					{showLeftLabel && (
						<span
							className="comparison-slider__label"
							data-testid="comparison-slider-label-left"
							style={{
								insetInlineStart: `${dividerXPx - RING_RADIUS_PX - LABEL_GAP_PX}px`,
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
								insetInlineStart: `${dividerXPx + RING_RADIUS_PX + LABEL_GAP_PX}px`,
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
