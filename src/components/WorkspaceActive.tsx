// The real Workspace Active content (docs/APPLICATION_LAYOUT.md "State B —
// Workspace Active", "Viewer", "Context Inspector"; docs/FEATURE_SPECIFICATION.md
// F-002, F-003). This is the workspace integration/adapter layer: the one
// component that reads Current Working State directly, derives the
// presentation model, manages the reference/capture object-URL lifecycle,
// and lays out the two permanent workspace regions
// (docs/APPLICATION_LAYOUT.md "Global Layout"):
// - Presentation Preview (left, `.workspace-active__preview`): hosts the
//   Presentation Canvas (`PresentationCanvas` below) — the Comparison Stage
//   (ComparisonSlider) with the rendered Comparison Information stacked
//   directly beneath it (ComparisonPresentationInfo), sized as one unit
//   (docs/COMPARISON_PRESENTATION.md Part 2) by src/lib/canvas-geometry.ts,
//   not by CSS `fit-content` (empirically proven unreliable for this DOM
//   shape during this feature's design — see that module's own header
//   comment) and not by copying an already-rendered sibling's size.
// - Context Inspector (right): the Edit Inspector (EditInspector), which
//   only ever writes to the Current Working State, never renders it for
//   display — see those two components' own headers for why they stay
//   separate.
// Stacked with the Presentation Preview first on narrow screens
// (docs/APPLICATION_LAYOUT.md "Responsive Layout").
//
// Owns the exact ref/testid/focus contract this replaces from
// src/components/ImportSection.tsx's former placeholder branch, unchanged:
// - `data-testid="workspace-active"` / `#workspace-active-title`: relied on
//   by the existing Replacement Mode and import-transition E2E tests.
// - `data-testid="workspace-session"`: a diagnostic, spec-independent
//   session-identity readout relied on by the existing Phase 3/4 E2E suite
//   (test/e2e/workspace-creation.spec.ts and others) to confirm which
//   comparison is currently active; kept here directly now that its former
//   home (the deleted ComparisonInfo.tsx) no longer exists.
// - The scroll-into-view-on-mount effect: this component only ever mounts on
//   the `no-workspace` -> `active` transition (src/components/ImportSection.tsx
//   renders either the no-workspace stage or this component, never both, and
//   never remounts this component across a Replace Export commit — the
//   *initial* import's "scroll to orientation" and a *replacement*'s "move
//   focus" are different transitions with different rules, see below), so
//   "on mount" is exactly the signal docs/APPLICATION_LAYOUT.md's "Import
//   Succeeded" describes.
// - The focus-the-heading-on-replace effect: fires when `sessionDirectory`
//   changes while already mounted, which only ever happens via a Replace
//   Export commit — deliberately keyed on the session identity rather than
//   on Current Working State object identity, since every F-003 edit now
//   also produces a new Current Working State object without a replacement
//   having happened (see src/lib/comparison-edit.ts) and must not steal
//   focus back to the heading on every keystroke.
//
// Viewing never mutates Source Data or the Current Working State
// (docs/FEATURE_SPECIFICATION.md F-002 Rules): nothing in the Presentation
// Preview writes back to `currentWorkingState`, and the interactive
// slider's own position is local, uncontrolled state inside ComparisonSlider.
// Editing (F-003) only ever flows up through `onCurrentWorkingStateChange`,
// supplied by src/components/App.tsx, which is the sole place that commits a
// new Current Working State into the active workspace.

import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useLocale } from "../i18n/LocaleContext";
import {
	CANVAS_CONTENT_GAP_PX,
	CANVAS_PADDING_PX,
	computeCanvasGeometry,
	deriveImageRatio,
	GEOMETRY_STABILITY_TOLERANCE_PX,
	type ImageDimensions,
	initialMetadataWidth,
	MAX_GEOMETRY_MEASUREMENTS,
} from "../lib/canvas-geometry";
import {
	type ComparisonPresentation,
	deriveComparisonPresentation,
} from "../lib/comparison-presentation";
import { useObjectUrl } from "../lib/use-object-url";
import type {
	CurrentWorkingState,
	PresentationConfiguration,
	PresentationVisibility,
} from "../lib/workspace-state";
import ComparisonPresentationInfo from "./ComparisonPresentationInfo";
import ComparisonSlider from "./ComparisonSlider";
import EditInspector from "./EditInspector";

interface WorkspaceActiveProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly errorMessage: string | null;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
}

export default function WorkspaceActive({
	currentWorkingState,
	errorMessage,
	onCurrentWorkingStateChange,
}: WorkspaceActiveProps) {
	const { locale, t } = useLocale();
	const activeSectionRef = useRef<HTMLElement>(null);
	const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
	const previousSessionDirectoryRef = useRef(
		currentWorkingState.sessionDirectory,
	);
	const previewRef = useRef<HTMLDivElement>(null);
	// The Preview Area's own rendered size. Deliberately owned here, not by
	// PresentationCanvas below: it describes available layout space, not
	// session content, so — unlike ratio/metadata-height/stability — it must
	// NOT reset on a workspace replace.
	const [previewSize, setPreviewSize] = useState<{
		readonly width: number;
		readonly height: number;
	} | null>(null);

	// Deliberately empty deps — must run exactly once, on mount (see the
	// module comment above for why this is the correct signal here).
	useEffect(() => {
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		activeSectionRef.current?.scrollIntoView({
			behavior: prefersReducedMotion ? "auto" : "smooth",
			block: "start",
		});
	}, []);

	useEffect(() => {
		if (
			previousSessionDirectoryRef.current !==
			currentWorkingState.sessionDirectory
		) {
			workspaceHeadingRef.current?.focus();
		}
		previousSessionDirectoryRef.current = currentWorkingState.sessionDirectory;
	}, [currentWorkingState.sessionDirectory]);

	useEffect(() => {
		const container = previewRef.current;
		if (!container) return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			setPreviewSize({
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			});
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	const presentation = useMemo(
		() =>
			deriveComparisonPresentation(currentWorkingState.metadata, locale, {
				referenceFallbackLabel: t.workspace.referenceFallbackLabel,
				sliderLabelFallbacks: {
					past: t.workspace.sliderPastLabel,
					present: t.workspace.sliderPresentLabel,
					reference: t.workspace.sliderReferenceLabel,
					current: t.workspace.sliderCurrentLabel,
				},
			}),
		[
			currentWorkingState.metadata,
			locale,
			t.workspace.referenceFallbackLabel,
			t.workspace.sliderPastLabel,
			t.workspace.sliderPresentLabel,
			t.workspace.sliderReferenceLabel,
			t.workspace.sliderCurrentLabel,
		],
	);

	const referenceSrc = useObjectUrl(currentWorkingState.files.referenceBytes);
	const captureSrc = useObjectUrl(currentWorkingState.files.captureBytes);

	return (
		<section
			className="workspace-active"
			aria-labelledby="workspace-active-title"
			data-testid="workspace-active"
			ref={activeSectionRef}
		>
			{/* Not part of the visible Workspace Active layout
			(docs/APPLICATION_LAYOUT.md "State B — Workspace Active" shows only
			Header / Presentation Preview+Context Inspector / Footer — the
			Title itself already renders inside the Presentation Canvas per
			docs/COMPARISON_PRESENTATION.md Part 2 "Presentation Layout").
			Visually hidden rather than deleted: still supplies the section's
			accessible name, the focus target on Replace Export, and the
			session-identity readout the existing E2E suite relies on —
			none of that is layout the two docs describe, so it must occupy no
			layout space. */}
			<h1
				id="workspace-active-title"
				className="visually-hidden"
				ref={workspaceHeadingRef}
				tabIndex={-1}
			>
				{presentation.title ?? t.workspace.title}
			</h1>
			{errorMessage && (
				<p
					className="import-section__alert"
					data-testid="import-error"
					role="alert"
				>
					{errorMessage}
				</p>
			)}
			<p className="visually-hidden" data-testid="workspace-session">
				{t.workspace.sessionLabel} {currentWorkingState.sessionDirectory}
			</p>
			<div className="workspace-active__layout">
				<div className="workspace-active__preview" ref={previewRef}>
					<PresentationCanvas
						key={currentWorkingState.sessionDirectory}
						previewSize={previewSize}
						referenceSrc={referenceSrc}
						captureSrc={captureSrc}
						referenceAlt={t.workspace.referenceImageAlt}
						captureAlt={t.workspace.captureImageAlt}
						sliderLabel={t.workspace.sliderLabel}
						loadingLabel={t.workspace.loadingLabel}
						leftLabel={presentation.sliderLabels.left}
						rightLabel={presentation.sliderLabels.right}
						presentation={presentation}
						visibility={currentWorkingState.presentationVisibility}
						configuration={currentWorkingState.presentationConfiguration}
					/>
				</div>
				<EditInspector
					key={currentWorkingState.sessionDirectory}
					currentWorkingState={currentWorkingState}
					captureDateLabel={presentation.captureLabel}
					onCurrentWorkingStateChange={onCurrentWorkingStateChange}
				/>
			</div>
		</section>
	);
}

interface PresentationCanvasProps {
	readonly previewSize: {
		readonly width: number;
		readonly height: number;
	} | null;
	readonly referenceSrc: string | undefined;
	readonly captureSrc: string | undefined;
	readonly referenceAlt: string;
	readonly captureAlt: string;
	readonly sliderLabel: string;
	readonly loadingLabel: string;
	readonly leftLabel: string;
	readonly rightLabel: string;
	readonly presentation: ComparisonPresentation;
	readonly visibility: PresentationVisibility;
	readonly configuration: PresentationConfiguration;
}

// docs/BRAND_GUIDE.md "Brand Accent Color" (#4F8CFF) — already reused as-is
// elsewhere in this codebase (src/components/ComparisonSlider.tsx's
// `ACCENT_COLOR`) rather than introducing a second, slightly different
// blue; the one existing brand-specific color token, and the only sensible
// reading of Canvas Background's "Brand" option next to the literal
// "White"/"Black"/"Transparent" options beside it.
const BRAND_ACCENT_COLOR = "#4F8CFF";

// docs/COMPARISON_PRESENTATION.md Part 3 "Frame": "Frame width is not a user
// setting … concrete frame width is a rendering concern" — this is that
// rendering decision, a fixed value applied whenever Frame is not "none".
const FRAME_WIDTH_PX = 8;

// docs/COMPARISON_PRESENTATION.md Part 3 "Corner Radius": "Sharp"/"Rounded".
// 0.75rem matches the corner radius this canvas already used unconditionally
// before this option existed, kept as the concrete "Rounded" value so the
// documented default reproduces today's existing appearance unchanged.
const CORNER_RADIUS_ROUNDED_PX = "0.75rem";
const CORNER_RADIUS_SHARP_PX = "0";

function resolveCanvasBackground(
	background: PresentationConfiguration["canvasBackground"],
): string {
	switch (background.kind) {
		case "transparent":
			return "transparent";
		case "white":
			return "#FFFFFF";
		case "black":
			return "#000000";
		case "brand":
			return BRAND_ACCENT_COLOR;
		case "custom":
			return background.color;
	}
}

function resolveFrame(frame: PresentationConfiguration["frame"]): {
	readonly color: string;
	readonly widthPx: number;
} {
	switch (frame.kind) {
		case "none":
			return { color: "transparent", widthPx: 0 };
		case "white":
			return { color: "#FFFFFF", widthPx: FRAME_WIDTH_PX };
		case "black":
			return { color: "#000000", widthPx: FRAME_WIDTH_PX };
		case "custom":
			return { color: frame.color, widthPx: FRAME_WIDTH_PX };
	}
}

// The Presentation Canvas itself (docs/COMPARISON_PRESENTATION.md Part 2).
// Deliberately a separate component, always rendered with
// `key={sessionDirectory}` by WorkspaceActive above: it owns exactly the
// geometry state that must reset on a workspace replace (image ratio,
// measured metadata height, stability), the same reset mechanism already
// used for ComparisonSlider and EditInspector — `previewSize` itself stays
// with the parent because it describes layout, not session content.
function PresentationCanvas({
	previewSize,
	referenceSrc,
	captureSrc,
	referenceAlt,
	captureAlt,
	sliderLabel,
	loadingLabel,
	leftLabel,
	rightLabel,
	presentation,
	visibility,
	configuration,
}: PresentationCanvasProps) {
	const infoRef = useRef<HTMLDivElement>(null);
	const [ratio, setRatio] = useState<number | null>(null);
	const [metadataHeight, setMetadataHeight] = useState(0);
	// Resolved once per Frame change and shared between the geometry
	// calculation below and `presentationStyle` further down, so the exact
	// same `widthPx` value that shrinks the available Stage area also drives
	// the rendered border — the two can never drift apart into two different
	// numbers.
	const frame = useMemo(
		() => resolveFrame(configuration.frame),
		[configuration.frame],
	);
	// Forces a render after every measurement (see the effect below for why
	// this is otherwise not guaranteed): if a measurement reports the exact
	// same height as before (common — most width changes during the
	// bootstrap/settle sequence do not actually change how many lines the
	// Description wraps onto), `setMetadataHeight` is a no-op as far as React
	// is concerned and skips rendering entirely — which would mean
	// `isStable` below, computed inline during render from the refs the
	// same measurement also updated, is never re-evaluated with their new
	// values. This state exists purely to guarantee a render happens, not to
	// carry any value read anywhere.
	const [, forceRenderAfterMeasurement] = useState(0);
	// The width the *last real measurement* of the Comparison Information
	// block was taken at, and how many measurements have happened in total.
	// Mutated only inside the ResizeObserver callback below and read only
	// during render (the same render the state update above guarantees) —
	// never read-and-written within the same render pass, so this stays
	// within React's supported ref usage.
	const measuredWidthRef = useRef<number | null>(null);
	const measurementCountRef = useRef(0);

	const handleDimensionsChange = useCallback((dimensions: ImageDimensions) => {
		setRatio(deriveImageRatio(dimensions));
	}, []);

	// Measures the Comparison Information block at whatever width it is
	// currently rendered at (driven by the CSS custom property this component
	// applies below, see `canvasStyle`). Records the measured height
	// unconditionally — "is this stable" is derived below, every render, by
	// comparing the width this measurement was taken at against the width
	// currently being requested, rather than by a second, independently
	// managed boolean: two `useEffect`s each allowed to set the same boolean
	// (one on every measurement, one whenever `ratio` changes) can run in
	// either order relative to each other and to the browser's own
	// ResizeObserver delivery, and a "reset to false" arriving just after a
	// "confirmed stable" would permanently wedge the canvas hidden — this
	// was caught by this feature's own E2E suite, not just reasoned about in
	// the abstract. A narrower width can only make text wrap onto
	// equal-or-more lines, never fewer, so the sequence of widths this
	// converges through is monotonically non-increasing — it cannot
	// oscillate, only settle (see src/lib/canvas-geometry.ts's own header
	// comment for the full argument). `MAX_GEOMETRY_MEASUREMENTS` is a safety
	// cap only, not expected to be reached in practice, and never leaves the
	// canvas permanently hidden on a measurement that will not settle.
	useEffect(() => {
		const element = infoRef.current;
		if (!element) return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			measuredWidthRef.current = entry.contentRect.width;
			measurementCountRef.current += 1;
			setMetadataHeight(entry.contentRect.height);
			forceRenderAfterMeasurement((tick) => tick + 1);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const geometry = useMemo(() => {
		if (!previewSize || ratio === null) return null;
		return computeCanvasGeometry({
			previewWidth: previewSize.width,
			previewHeight: previewSize.height,
			ratio,
			metadataHeight,
			canvasPadding: CANVAS_PADDING_PX,
			contentGap: CANVAS_CONTENT_GAP_PX,
			frameWidth: frame.widthPx,
		});
	}, [previewSize, ratio, metadataHeight, frame.widthPx]);

	const currentTargetWidth = geometry
		? geometry.stageWidth
		: previewSize
			? initialMetadataWidth(
					previewSize.width,
					CANVAS_PADDING_PX,
					frame.widthPx,
				)
			: null;

	// docs/COMPARISON_PRESENTATION.md "Complete Presentation": the canvas must
	// never visibly resize once shown — it only becomes visible once the
	// Stage geometry is known and the Comparison Information block has
	// actually been measured at the width that geometry currently requests
	// (or the safety cap has been reached).
	const isStable =
		measurementCountRef.current >= MAX_GEOMETRY_MEASUREMENTS ||
		(currentTargetWidth !== null &&
			measuredWidthRef.current !== null &&
			Math.abs(measuredWidthRef.current - currentTargetWidth) <=
				GEOMETRY_STABILITY_TOLERANCE_PX);
	const canvasReady = geometry !== null && isStable;

	// docs/COMPARISON_PRESENTATION.md Part 3 "Canvas"/"Corner Radius":
	// independent of Stage geometry, so computed once and merged into
	// whichever geometry branch below applies — these are Current Working
	// State values, never guessed or defaulted differently across branches.
	const presentationStyle = useMemo<CSSProperties>(
		() =>
			({
				"--canvas-background": resolveCanvasBackground(
					configuration.canvasBackground,
				),
				"--frame-color": frame.color,
				"--frame-width": `${frame.widthPx}px`,
				"--corner-radius":
					configuration.cornerRadius === "rounded"
						? CORNER_RADIUS_ROUNDED_PX
						: CORNER_RADIUS_SHARP_PX,
			}) as CSSProperties,
		[configuration, frame],
	);

	const canvasStyle = useMemo<CSSProperties | undefined>(() => {
		if (geometry) {
			return {
				...presentationStyle,
				"--stage-width": `${geometry.stageWidth}px`,
				"--stage-height": `${geometry.stageHeight}px`,
				"--canvas-width": `${geometry.canvasWidth}px`,
				"--canvas-height": `${geometry.canvasHeight}px`,
				"--canvas-padding": `${CANVAS_PADDING_PX}px`,
				// docs/COMPARISON_PRESENTATION.md "Hidden or unavailable items
				// reserve no space" — mirrors the same condition
				// computeCanvasGeometry itself applies internally, reusing the
				// already-measured metadataHeight rather than re-deriving
				// "is anything visible" from `visibility`/`presentation` a
				// second time.
				"--content-gap":
					metadataHeight > 0 ? `${CANVAS_CONTENT_GAP_PX}px` : "0px",
			} as CSSProperties;
		}
		if (previewSize) {
			const width = initialMetadataWidth(
				previewSize.width,
				CANVAS_PADDING_PX,
				frame.widthPx,
			);
			return {
				...presentationStyle,
				"--stage-width": `${width}px`,
				"--canvas-padding": `${CANVAS_PADDING_PX}px`,
			} as CSSProperties;
		}
		return presentationStyle;
	}, [geometry, previewSize, metadataHeight, presentationStyle, frame]);

	return (
		<>
			{!canvasReady && (
				<p
					className="workspace-active__preview-loading comparison-slider__loading"
					data-testid="comparison-loading"
					aria-live="polite"
				>
					{loadingLabel}
				</p>
			)}
			<div
				className={`presentation-canvas${
					canvasReady ? " presentation-canvas--ready" : ""
				}`}
				style={canvasStyle}
			>
				<ComparisonSlider
					referenceSrc={referenceSrc}
					captureSrc={captureSrc}
					referenceAlt={referenceAlt}
					captureAlt={captureAlt}
					sliderLabel={sliderLabel}
					loadingLabel={loadingLabel}
					leftLabel={leftLabel}
					rightLabel={rightLabel}
					showDateLabels={configuration.showSliderDateLabels}
					onDimensionsChange={handleDimensionsChange}
				/>
				<div ref={infoRef} className="presentation-canvas__info-wrapper">
					<ComparisonPresentationInfo
						presentation={presentation}
						visibility={visibility}
					/>
				</div>
			</div>
		</>
	);
}
