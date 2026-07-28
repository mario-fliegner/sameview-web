// The interactive comparison (docs/FEATURE_SPECIFICATION.md F-002; the
// approved Viewer architecture analyses). Reveals the reference image over
// the capture image via a pointer/touch/keyboard-operable divider.
//
// Deliberately reusable and "dumb": every prop is a plain, already-resolved
// value (strings, a src) — this component never calls useLocale() itself
// (i18n resolution stays in the caller, docs/... this iteration's own
// requirement) and never reads Current Working State directly, so the exact
// same component can later render inside Fullscreen or a generated
// Standalone HTML artifact without modification.
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

import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	type SyntheticEvent,
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
}

const KEYBOARD_STEP = 5;

export default function ComparisonSlider({
	referenceSrc,
	captureSrc,
	referenceAlt,
	captureAlt,
	sliderLabel,
	loadingLabel,
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

	function updatePositionFromClientX(clientX: number) {
		const frame = frameRef.current;
		if (!frame) return;
		const rect = frame.getBoundingClientRect();
		if (rect.width === 0) return;
		const ratio = (clientX - rect.left) / rect.width;
		setPosition(Math.min(100, Math.max(0, ratio * 100)));
	}

	function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
		if (!bothLoaded) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		setIsDragging(true);
		updatePositionFromClientX(event.clientX);
	}

	function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
		if (!isDragging) return;
		updatePositionFromClientX(event.clientX);
	}

	function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
		setIsDragging(false);
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
				/>
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
