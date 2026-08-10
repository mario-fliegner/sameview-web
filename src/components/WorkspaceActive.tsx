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
// - The focus-the-heading-on-replace effect: fires when `sessionDirectory`
//   changes while already mounted, which only ever happens via a Replace
//   Export commit — deliberately keyed on the session identity rather than
//   on Current Working State object identity, since every F-003 edit now
//   also produces a new Current Working State object without a replacement
//   having happened (see src/lib/comparison-edit.ts) and must not steal
//   focus back to the heading on every keystroke. This component only ever
//   mounts on the `no-workspace` -> `active` transition
//   (src/components/ImportSection.tsx renders either the no-workspace stage
//   or this component, never both) and never remounts across a Replace
//   Export commit, so this session-directory comparison only ever fires for
//   an actual replacement, never for the initial import.
//
// docs/APPLICATION_LAYOUT.md "Import Succeeded": "The transition is
// performed within the application layout. The document itself does not
// scroll." — deliberately no scroll-into-view (or any other scroll) is
// performed on the initial `no-workspace` -> `active` mount. The workspace
// already renders at its normal in-flow document position, directly below
// the header, which is already within the viewport for any supported
// viewport height, so no programmatic scroll is needed to satisfy
// APPLICATION_LAYOUT.md's "the workspace becomes the new visual focus
// automatically" for this transition either.
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
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useLocale } from "../i18n/LocaleContext";
import { type HandleBranding, resolveHandleBranding } from "../lib/branding";
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
import { attachPresentationOverflowTooltips } from "../lib/overflow-tooltip";
import { resolvePresentationFontFamily } from "../lib/presentation-fonts";
import {
	CORNER_RADIUS_ROUNDED_PX,
	CORNER_RADIUS_SHARP_PX,
	resolveCanvasBackground,
	resolveFrame,
	resolveTextColor,
} from "../lib/presentation-style-resolution";
import { useObjectUrl } from "../lib/use-object-url";
import type {
	CurrentWorkingState,
	PresentationConfiguration,
	PresentationVisibility,
} from "../lib/workspace-state";
import ComparisonPresentationInfo from "./ComparisonPresentationInfo";
import ComparisonSlider from "./ComparisonSlider";
import EditInspector, { type OpenSection } from "./EditInspector";
import OutputInspector from "./OutputInspector";

// The desktop Presentation Preview's own height, in pixels, derived by
// src/components/App.tsx from the actually rendered header, footer and
// `main` chrome plus the live viewport height — never from a guessed
// constant and never from the Context Inspector's own content height (see
// that component's own header comment for the full measurement). Provided
// via context, not a prop threaded through src/components/ImportSection.tsx,
// specifically so that intermediate component never needs to know about a
// concern that is entirely about Preview/Fullscreen geometry.
//
// Fixes a confirmed regression: `.workspace-active__preview` used to reach
// its own height purely via CSS (`align-self: stretch` into
// `.workspace-active__layout`'s single `minmax(0, 1fr)` grid row). That
// grid row only has a genuinely definite height while the whole page still
// fits within one viewport — `body`'s own `min-height: 100vh`
// (src/styles/global.css) is the sole source of definiteness in that
// chain. The moment the Context Inspector's own content (e.g. the
// Presentation section, now taller with its Typography group) makes the
// page taller than one viewport and the page starts scrolling, `body`'s
// height becomes content-derived instead, and a `fr` row inside an
// indefinite-height grid container resolves to the *tallest item's own
// content size* rather than a real fraction of available space — so the
// Preview column's stretched height silently inherited the Inspector
// column's own (now taller) content height, visibly enlarging the
// Comparison Stage. Feeding this externally measured, Inspector-independent
// height in as an explicit `height` (see `.workspace-active__preview` in
// src/styles/global.css) instead of `align-self: stretch` removes that
// coupling entirely — the Inspector remains free to grow past the Preview
// and scroll the page exactly as before, but the Preview itself can no
// longer inherit that growth.
export const WorkspaceAvailableHeightContext = createContext<number | null>(
	null,
);

// Fullscreen Mode's own icon-only buttons (docs/APPLICATION_LAYOUT.md
// "Fullscreen Mode"). Plain inline SVG, no icon library — the same technique
// already used for src/components/ComparisonSlider.tsx's handle and
// src/components/ImportSection.tsx's StageIcon. `currentColor` lets the
// button's own CSS `color` decide the icon color instead of a second,
// separately maintained value.
function FullscreenIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path
				d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path
				d="M6 6l12 12M18 6L6 18"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

interface WorkspaceActiveProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly errorMessage: string | null;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
	// Fullscreen Mode (docs/APPLICATION_LAYOUT.md "Fullscreen Mode") — owned
	// by the app shell (src/components/App.tsx), not here, because the header
	// and footer also need it to become inert; see that component's own
	// comment. This component only reads it to toggle the Presentation
	// Preview's own fullscreen presentation and to make the Context Inspector
	// inert while it is open.
	readonly isFullscreen: boolean;
	readonly onFullscreenChange: (next: boolean) => void;
}

export default function WorkspaceActive({
	currentWorkingState,
	errorMessage,
	onCurrentWorkingStateChange,
	isFullscreen,
	onFullscreenChange,
}: WorkspaceActiveProps) {
	const { locale, t } = useLocale();
	const availableHeightPx = useContext(WorkspaceAvailableHeightContext);
	// docs/APPLICATION_LAYOUT.md "Output Inspector": "The Output Inspector
	// replaces the Edit Inspector after the user selects Create Output" — a
	// workspace-scoped UI choice. Unlike EditInspector/ComparisonSlider's own
	// local state, this one lives in WorkspaceActive itself (both inspectors
	// occupy the same grid slot here), so it needs its own explicit reset
	// effect below, keyed on `sessionDirectory` exactly like the existing
	// heading-focus effect, to return to "edit" on an actual Replace Export
	// without resetting on every ordinary content edit.
	const [contextInspectorMode, setContextInspectorMode] = useState<
		"edit" | "output"
	>("edit");
	// EditInspector's own accordion section (docs/APPLICATION_LAYOUT.md
	// "Structure": "the expanded/collapsed state should be preserved while
	// the workspace remains open"). Owned here, not by EditInspector's own
	// local state, for the same reason `contextInspectorMode` above already
	// is: EditInspector and OutputInspector occupy the same grid slot as
	// alternatives, so React unmounts EditInspector whenever OutputInspector
	// is shown instead — a component's local `useState` cannot survive that,
	// only a value owned by the ancestor that stays mounted through the
	// switch can (see EditInspector.tsx's own header comment for the
	// confirmed regression this fixes). Reset alongside
	// `contextInspectorMode` in the same sessionDirectory effect below, on
	// an actual Replace Export only — never on an ordinary Edit/Output
	// switch.
	const [editInspectorOpenSection, setEditInspectorOpenSection] =
		useState<OpenSection>("comparison-information");
	const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
	const previousSessionDirectoryRef = useRef(
		currentWorkingState.sessionDirectory,
	);
	// The Presentation Preview's live Comparison Stage divider position
	// (docs/COMPARISON_PRESENTATION.md "Initial Slider Position": Use Current
	// Slider Position), mirrored here only for OutputInspector to read on
	// demand at Generate — never rendered from, never written back into
	// Current Working State. A plain ref, not state: every drag/keyboard
	// frame updates it (via `handleSliderPositionChange` below), which would
	// otherwise re-render this whole component on every pixel of a drag.
	// Reset to ComparisonSlider's own initial value alongside
	// `contextInspectorMode`/`editInspectorOpenSection` in the
	// sessionDirectory effect below, on an actual Replace Export only — a
	// fresh ComparisonSlider mount always starts back at 50.
	const currentSliderPositionRef = useRef(50);
	const previewRef = useRef<HTMLDivElement>(null);
	// The Presentation Canvas's own sub-region of the Presentation Preview —
	// everything below the Reserved Control Area (docs/APPLICATION_LAYOUT.md
	// "Fullscreen Mode"). Deliberately a second, separate ref from `previewRef`
	// above, not a repurposed one: `previewRef` keeps meaning "the whole
	// Presentation Preview" for the Fullscreen class and the exit effect's own
	// width check further below, exactly as before this Reserved Control Area
	// existed, so neither of those needs to change at all. This ref exists
	// specifically so the ResizeObserver two effects down measures only the
	// space actually available to the canvas, permanently excluding the
	// Control Area's own real, currently-rendered height — no pixel constant
	// is subtracted in JS anywhere; the browser's own flexbox layout already
	// resolves it (see `.workspace-active__canvas-area` in global.css).
	const canvasAreaRef = useRef<HTMLDivElement>(null);
	const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
	const closeFullscreenButtonRef = useRef<HTMLButtonElement>(null);
	// A plain, non-rendering (`display: contents`) wrapper around the two
	// Fullscreen/Close buttons below, purely so `attachPresentationOverflowTooltips`
	// (src/lib/overflow-tooltip.ts) has a root to scan that does not also
	// contain ComparisonPresentationInfo's own Title/Description/Location
	// triggers (a descendant of `previewRef`, via PresentationCanvas) — that
	// component already attaches the same function to its own root; scanning
	// an overlapping root here would register those same trigger elements a
	// second time, under a second, independent trigger set.
	const fullscreenToggleContainerRef = useRef<HTMLDivElement>(null);
	// Mirrors the sessionDirectory-focus effect below: compares the previous
	// render's value against the current one, rather than tracking a second
	// "just opened"/"just closed" boolean, for the same reason documented
	// there (this component itself never unmounts around a Fullscreen toggle,
	// so a plain ref comparison is sufficient and cannot desync).
	const previousIsFullscreenRef = useRef(isFullscreen);
	// The canvas area's own rendered size — the Presentation Preview *minus*
	// the Reserved Control Area (see `canvasAreaRef` above). Deliberately
	// owned here, not by PresentationCanvas below: it describes available
	// layout space, not session content, so — unlike ratio/metadata-height/
	// stability — it must NOT reset on a workspace replace.
	const [previewSize, setPreviewSize] = useState<{
		readonly width: number;
		readonly height: number;
	} | null>(null);
	// Remembers `previewSize` as it was the instant before Fullscreen made
	// `.workspace-active__preview` viewport-sized — a snapshot for restoring
	// that exact same state variable on exit, not a second, independently
	// updated copy of it (the same "remember the previous value" shape
	// already used above for `previousSessionDirectoryRef`/
	// `previousIsFullscreenRef`).
	const preFullscreenPreviewSizeRef = useRef<typeof previewSize>(null);

	useEffect(() => {
		if (
			previousSessionDirectoryRef.current !==
			currentWorkingState.sessionDirectory
		) {
			workspaceHeadingRef.current?.focus();
			setContextInspectorMode("edit");
			setEditInspectorOpenSection("comparison-information");
			currentSliderPositionRef.current = 50;
		}
		previousSessionDirectoryRef.current = currentWorkingState.sessionDirectory;
	}, [currentWorkingState.sessionDirectory]);

	// Mirrors PresentationCanvas's own `handleDimensionsChange` below: a
	// stable callback (never causes ComparisonSlider to re-render on its
	// account) that only mutates the plain ref above, never triggers a
	// WorkspaceActive re-render itself — deliberately, since every drag frame
	// would otherwise re-render everything else in this component.
	const handleSliderPositionChange = useCallback((position: number) => {
		currentSliderPositionRef.current = position;
	}, []);
	const getCurrentSliderPosition = useCallback(
		() => currentSliderPositionRef.current,
		[],
	);

	// Fullscreen Mode focus management (docs/APPLICATION_LAYOUT.md "Fullscreen
	// Mode": "Keyboard focus returns to the Fullscreen button" on close, and —
	// by the same "moves focus into new interactive content" reasoning
	// src/components/ReplacementModeOverlay.tsx already documents for its own
	// heading — the Close button on open).
	useEffect(() => {
		if (isFullscreen && !previousIsFullscreenRef.current) {
			closeFullscreenButtonRef.current?.focus();
		} else if (!isFullscreen && previousIsFullscreenRef.current) {
			fullscreenButtonRef.current?.focus();
		}
		previousIsFullscreenRef.current = isFullscreen;
	}, [isFullscreen]);

	// The Fullscreen/Close buttons' own hover/keyboard-focus tooltips — the
	// same framework-independent module and `.presentation-tooltip` styling
	// as the Overflow Tooltip above ComparisonPresentationInfo.tsx already
	// attaches on its own root, reused here rather than duplicated (see that
	// module's own header comment on its "static" trigger kind for why a
	// second `attachPresentationOverflowTooltips` call, on a deliberately
	// disjoint root, is the correct way to reuse it for a second, unrelated
	// subtree instead of widening either root to cover both). Attached once,
	// like that other call site, and for the same reason: the module reacts
	// to real DOM mutations (e.g. this container's child swapping between
	// the two buttons below as `isFullscreen` changes) on its own, not to
	// this component's re-renders. A distinct `testId` (confirmed necessary,
	// not speculative: Tab order can carry keyboard focus straight from a
	// Comparison Information item into the Fullscreen button, which — before
	// this — opened this tooltip while the Overflow Tooltip's own same-named
	// element was still mid-close, making the two indistinguishable to
	// anything querying by the shared default id) — no visible or behavioral
	// difference, this module's own single shared `.presentation-tooltip`
	// element/class/positioning is otherwise identical either way.
	useEffect(() => {
		if (!fullscreenToggleContainerRef.current) return;
		return attachPresentationOverflowTooltips(
			fullscreenToggleContainerRef.current,
			{ testId: "fullscreen-toggle-tooltip" },
		);
	}, []);

	// A `document`-level listener rather than a React `onKeyDown` on
	// `.workspace-active__preview` itself: Escape must close Fullscreen
	// regardless of which descendant currently holds focus (the Close
	// button, the slider handle, or a focused Overflow Tooltip trigger), and
	// only ever needs to exist while Fullscreen is actually open — the same
	// "attach only while active, detach otherwise" pattern already used by
	// src/lib/overflow-tooltip.ts's own reposition listeners.
	useEffect(() => {
		if (!isFullscreen) return;
		function handleKeyDown(event: globalThis.KeyboardEvent) {
			if (event.key !== "Escape") return;
			// "Escape … ends Fullscreen" — never moves focus itself; the effect
			// above already returns it to the Fullscreen button once
			// `isFullscreen` actually becomes false.
			event.preventDefault();
			onFullscreenChange(false);
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isFullscreen, onFullscreenChange]);

	// Fixes a confirmed bug: `.workspace-active__preview` becoming
	// `position: fixed` for Fullscreen (global.css
	// `.workspace-active__preview--fullscreen`) removes it from
	// `.workspace-active__layout`'s grid flow entirely. The moment that class
	// is removed again, this element is back in the grid, but
	// PresentationCanvas below still renders `.presentation-canvas` at its
	// previous, viewport-sized `--canvas-height` for this one commit — nothing
	// has told it otherwise yet, since that only ever happens once `previewSize`
	// itself updates. Because this whole layout is height-driven by its own
	// content (confirmed empirically: `.workspace-active__layout`'s row is not
	// a definite `1fr` share of a definite container height here, it sizes
	// from its tallest child), that stale, still-huge explicit height becomes
	// this element's own real, measured height for that commit — and the
	// ResizeObserver below then reports exactly that self-inflated size back
	// into `previewSize`, which produces an equally large geometry again,
	// forever (confirmed empirically: it never settles back down on its own,
	// not a one-frame flicker but a stable, incorrect fixed point).
	//
	// Restoring the pre-Fullscreen snapshot verbatim only breaks that loop
	// correctly when the viewport never actually changed size while
	// Fullscreen was open: the snapshot is a *pixel* value, not a live
	// measurement, so it goes stale the moment a real resize (or orientation
	// change) crosses `.workspace-active__layout`'s own 48rem column
	// breakpoint before Fullscreen closes. `.workspace-active__preview`'s own
	// live width right after the fullscreen class is removed is always
	// trustworthy, though, with no snapshot involved: it is a normal grid
	// item again by the time this layout effect runs (class changes are
	// already committed to the DOM before layout effects fire), and its
	// column track is sized by `.workspace-active__layout`'s own
	// `grid-template-columns` — a plain fraction of the layout's width,
	// entirely independent of `.presentation-canvas`'s still-stale content
	// (unlike its *height*, which — at the single-column, sub-48rem layout
	// specifically — has no such independent source and is exactly the
	// content-driven quantity this whole effect exists to correct). So: if
	// that live width still matches the snapshot, nothing about the layout
	// actually changed and the cheap, already-correct snapshot restore below
	// is kept as is. If it does not, the snapshot cannot be trusted for
	// either axis any more (a changed column width can itself come with a
	// changed available height, e.g. at the desktop breakpoint's own
	// viewport-stretched row), so `previewSize` is cleared to `null` instead
	// — the exact state PresentationCanvas already starts every session in,
	// before its first-ever measurement. That re-opens the same
	// invisible-until-stable bootstrap gap `canvasReady`/`isStable` already
	// use for a first mount (global.css `.comparison-slider__frame--ready`'s
	// own `16rem` floor keeps that gap from collapsing to a self-reinforcing
	// zero the way `.presentation-canvas`'s stale explicit height otherwise
	// would), so the canvas area's own ResizeObserver below ends up
	// measuring a real, freshly-rendered box for the *current* viewport —
	// never a pixel value carried over from one that no longer applies —
	// while nothing in that gap is visible (the same
	// `visibility: hidden`/loading-state gating a first mount already relies
	// on). No new geometry logic either way — src/lib/canvas-geometry.ts's
	// own `computeCanvasGeometry` is untouched; only which `previewSize`
	// value reaches it changes for this one transition.
	const previousIsFullscreenForPreviewRef = useRef(isFullscreen);
	useLayoutEffect(() => {
		const wasFullscreen = previousIsFullscreenForPreviewRef.current;
		// Guarded by `!wasFullscreen`/`wasFullscreen`, not merely by this
		// effect running: `previewSize` legitimately changes many times while
		// Fullscreen is open (the real, growing viewport size) or while it is
		// closed (an ordinary resize) — this must only act on the one render
		// where `isFullscreen` itself actually flipped, on either edge, never
		// on those other, unrelated reruns.
		if (isFullscreen && !wasFullscreen) {
			preFullscreenPreviewSizeRef.current = previewSize;
		} else if (!isFullscreen && wasFullscreen) {
			const snapshot = preFullscreenPreviewSizeRef.current;
			const liveWidth = previewRef.current?.getBoundingClientRect().width;
			const viewportUnchanged =
				snapshot !== null &&
				liveWidth !== undefined &&
				Math.abs(liveWidth - snapshot.width) <= GEOMETRY_STABILITY_TOLERANCE_PX;
			setPreviewSize(viewportUnchanged ? snapshot : null);
		}
		previousIsFullscreenForPreviewRef.current = isFullscreen;
	}, [isFullscreen, previewSize]);

	useEffect(() => {
		const container = canvasAreaRef.current;
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
				durationLabelFallbacks: {
					year: t.workspace.durationYearLabel,
					years: t.workspace.durationYearsLabel,
					month: t.workspace.durationMonthLabel,
					months: t.workspace.durationMonthsLabel,
					sameYear: t.workspace.durationSameYearLabel,
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
			t.workspace.durationYearLabel,
			t.workspace.durationYearsLabel,
			t.workspace.durationMonthLabel,
			t.workspace.durationMonthsLabel,
			t.workspace.durationSameYearLabel,
		],
	);

	const referenceSrc = useObjectUrl(currentWorkingState.files.referenceBytes);
	const captureSrc = useObjectUrl(currentWorkingState.files.captureBytes);
	// Session Branding (docs/FEATURE_SPECIFICATION.md F-004): which of
	// None/Built-in Symbol/Custom Image is active, and — for an imported
	// built-in branding or a Custom Image — the object URL for its asset.
	// `resolveHandleBranding` never needs this URL itself (it only reasons
	// about *whether* `brandingHandleBytes` is present, not its contents),
	// so it stays a pure function while this remains the one place the
	// bytes are actually turned into a displayable `src`, exactly like
	// `referenceSrc`/`captureSrc` above.
	const handleBranding = resolveHandleBranding(currentWorkingState);
	const brandingSrc = useObjectUrl(
		currentWorkingState.files.brandingHandleBytes,
	);

	return (
		<section
			className="workspace-active"
			aria-labelledby="workspace-active-title"
			data-testid="workspace-active"
			style={
				availableHeightPx !== null
					? ({
							"--workspace-available-height": `${availableHeightPx}px`,
						} as CSSProperties)
					: undefined
			}
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
				<div
					className={`workspace-active__preview${
						isFullscreen ? " workspace-active__preview--fullscreen" : ""
					}`}
					ref={previewRef}
				>
					{/* Reserved Control Area (docs/APPLICATION_LAYOUT.md "Fullscreen
					    Mode"): belongs to the Presentation Preview and to the
					    application UI, explicitly not to the Presentation Canvas below
					    — a sibling of `.workspace-active__canvas-area`, never inside
					    it, so it can never appear in a generated output that only
					    reproduces that element. Always rendered, in both normal and
					    Fullscreen layout, at the same structural position — never a
					    format- or breakpoint-conditional variant of it. It permanently
					    occupies real layout space (global.css
					    `.workspace-active__control-area`), so
					    `.workspace-active__canvas-area` below is sized around it, not
					    underneath it — the Presentation Canvas can therefore never grow
					    into it, and the button can never overlay canvas content,
					    regardless of the comparison's orientation. Exactly one of the
					    two buttons below is ever rendered. `display: contents` (inline,
					    not a class: purely structural, not a design decision — see
					    `fullscreenToggleContainerRef` above) so that wrapper
					    contributes no box of its own beyond the button itself. Each
					    branch carries its own `key`: both render a `<button>` at the same
					    tree position, so without distinct keys React reconciles them
					    as the *same* DOM node (only its attributes/children change) —
					    confirmed empirically to desync src/lib/overflow-tooltip.ts's
					    own per-trigger state from it, since that module's `Map` keys
					    by element identity: a tooltip already open at the moment of
					    this swap (hover, then click) kept showing the stale label and
					    position for the *other* button, because as far as that Map is
					    concerned nothing about "the trigger" ever changed. Distinct
					    keys make this swap a real unmount/remount, exactly like any
					    other trigger appearing/disappearing (`scan()`'s own doc
					    comment below) — the one behavior that module already handles
					    correctly. */}
					<div className="workspace-active__control-area">
						<div
							ref={fullscreenToggleContainerRef}
							style={{ display: "contents" }}
						>
							{isFullscreen ? (
								<button
									key="fullscreen-close"
									type="button"
									ref={closeFullscreenButtonRef}
									className="workspace-active__fullscreen-toggle"
									aria-label={t.workspace.fullscreenCloseButton}
									data-testid="fullscreen-close-button"
									data-tooltip=""
									onClick={() => onFullscreenChange(false)}
								>
									<CloseIcon />
								</button>
							) : (
								<button
									key="fullscreen-open"
									type="button"
									ref={fullscreenButtonRef}
									className="workspace-active__fullscreen-toggle"
									aria-label={t.workspace.fullscreenOpenButton}
									data-testid="fullscreen-open-button"
									data-tooltip=""
									onClick={() => onFullscreenChange(true)}
								>
									<FullscreenIcon />
								</button>
							)}
						</div>
					</div>
					{/* Presentation Canvas's own sub-region of the Presentation
					    Preview — everything below the Reserved Control Area above.
					    `ref={canvasAreaRef}` (not `previewRef`, which stays on the
					    outer Presentation Preview) is what the geometry
					    ResizeObserver actually measures, so the space the Reserved
					    Control Area occupies is permanently excluded from
					    `previewSize`/`computeCanvasGeometry`'s own inputs without
					    either of them needing to know a pixel value for it — the
					    browser's own flexbox layout already resolves that (see
					    `.workspace-active__canvas-area` in global.css). */}
					<div className="workspace-active__canvas-area" ref={canvasAreaRef}>
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
							branding={handleBranding}
							brandingSrc={brandingSrc}
							onPositionChange={handleSliderPositionChange}
						/>
					</div>
				</div>
				{/* Inert while Fullscreen is open (docs/APPLICATION_LAYOUT.md
				    "Fullscreen Mode": header/footer/"context inspector" disappear) —
				    a dedicated wrapper because src/components/EditInspector.tsx
				    itself never reads or writes Fullscreen state, exactly like the
				    inert wrappers around the header/footer in App.tsx; `.inert-region`
				    (global.css) keeps it `display: contents` so EditInspector remains
				    exactly the same direct `.workspace-active__layout` grid item it
				    already was. It stays visually unaffected on purpose: it is fully
				    covered by the fullscreen Presentation Preview above it in the
				    same stacking context regardless. */}
				<div className="inert-region" inert={isFullscreen ? true : undefined}>
					{contextInspectorMode === "edit" ? (
						<EditInspector
							key={currentWorkingState.sessionDirectory}
							currentWorkingState={currentWorkingState}
							captureDateLabel={presentation.captureLabel}
							onCurrentWorkingStateChange={onCurrentWorkingStateChange}
							onCreateOutput={() => setContextInspectorMode("output")}
							openSection={editInspectorOpenSection}
							onOpenSectionChange={setEditInspectorOpenSection}
						/>
					) : (
						<OutputInspector
							key={currentWorkingState.sessionDirectory}
							currentWorkingState={currentWorkingState}
							presentation={presentation}
							onBackToEdit={() => setContextInspectorMode("edit")}
							getCurrentSliderPosition={getCurrentSliderPosition}
						/>
					)}
				</div>
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
	readonly branding: HandleBranding;
	readonly brandingSrc: string | undefined;
	// Pure passthrough to ComparisonSlider's own identically-named optional
	// prop — see that component's own header comment. Owned by
	// WorkspaceActive, not here: it describes OutputInspector's needs, not
	// canvas rendering. Required (not optional) here since WorkspaceActive,
	// this component's only caller, always provides a stable callback.
	readonly onPositionChange: (position: number) => void;
}

// Canvas Background/Frame/Text semantic-to-concrete resolution
// (resolveCanvasBackground/resolveFrame/resolveTextColor and their shared
// constants) now live in src/lib/presentation-style-resolution.ts — the
// single source also used by the generated Standalone HTML/Static Microsite
// (src/lib/comparison-artifact-markup.ts), imported above.

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
	branding,
	brandingSrc,
	onPositionChange,
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
	// docs/COMPARISON_PRESENTATION.md Part 3 "Typography": resolved once here
	// (mirroring `frame`/`resolvedBackground` above) and reused both for the
	// CSS custom property below (DOM-rendered Comparison Information / Slider
	// Date Labels) and, passed down as a plain string prop, for the Canvas
	// `measureText()` calls in ComparisonPresentationInfo.tsx and
	// ComparisonSlider.tsx — a single resolved value, never two independently
	// derived font strings that could drift apart.
	const presentationFontFamily = useMemo(
		() => resolvePresentationFontFamily(configuration.presentationFont),
		[configuration.presentationFont],
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

	// Adaptive Sizing's width input (docs/COMPARISON_PRESENTATION.md "Adaptive
	// Sizing"; ComparisonPresentationInfo.tsx's `stableWidthPx` prop). `null`
	// throughout the geometry convergence above (every item renders at its
	// standard size unconditionally until `canvasReady`), so that existing,
	// already-proven convergence loop is never touched or influenced by
	// Adaptive Sizing.
	//
	// Once ready, this ratchets *downward only* within a given
	// (previewSize, presentation) episode — mirroring canvas-geometry.ts's
	// own monotonicity argument ("a narrower width can only make text wrap
	// onto equal-or-more lines, never fewer") applied to a second,
	// independent value. This specifically rules out a real oscillation
	// Adaptive Sizing could otherwise cause: switching an item to its
	// smaller "compact" size can only ever make it shorter-or-equal, never
	// taller (Compact's own line-clamp cap is strictly smaller than
	// Standard's); a shorter item frees vertical space, which — in the
	// height-bound geometry branch — can *widen* `stageWidth`; feeding that
	// wider width straight back into the same item's own decision could
	// flip it back to Standard, regrowing it, renarrowing `stageWidth`, and
	// so on indefinitely. Ratcheting the fed-in width to never exceed what
	// it already was for this exact (size, content) episode makes that
	// specific cycle impossible: once an item has stepped down to Compact,
	// it can never see a wider input again within the same episode, so it
	// can never step back up. A genuine change in `previewSize` (a real
	// resize) or in `presentation` (edited text) starts a fresh episode and
	// is never blocked.
	const adaptiveWidthEpisodeRef = useRef<{
		readonly previewWidth: number;
		readonly previewHeight: number;
		readonly presentation: ComparisonPresentation;
	} | null>(null);
	const [stableWidthPx, setStableWidthPx] = useState<number | null>(null);
	useEffect(() => {
		if (!canvasReady || !geometry || !previewSize) {
			adaptiveWidthEpisodeRef.current = null;
			setStableWidthPx(null);
			return;
		}
		const previousEpisode = adaptiveWidthEpisodeRef.current;
		const sameEpisode =
			previousEpisode !== null &&
			previousEpisode.previewWidth === previewSize.width &&
			previousEpisode.previewHeight === previewSize.height &&
			previousEpisode.presentation === presentation;
		adaptiveWidthEpisodeRef.current = {
			previewWidth: previewSize.width,
			previewHeight: previewSize.height,
			presentation,
		};
		const nextStageWidth = geometry.stageWidth;
		setStableWidthPx((previous) =>
			sameEpisode && previous !== null
				? Math.min(previous, nextStageWidth)
				: nextStageWidth,
		);
	}, [canvasReady, geometry, previewSize, presentation]);

	// docs/COMPARISON_PRESENTATION.md Part 3 "Canvas"/"Corner Radius"/"Text":
	// independent of Stage geometry, so computed once and merged into
	// whichever geometry branch below applies — these are Current Working
	// State values, never guessed or defaulted differently across branches.
	const presentationStyle = useMemo<CSSProperties>(() => {
		const resolvedBackground = resolveCanvasBackground(
			configuration.canvasBackground,
		);
		return {
			"--canvas-background": resolvedBackground,
			"--frame-color": frame.color,
			"--frame-width": `${frame.widthPx}px`,
			"--corner-radius":
				configuration.cornerRadius === "rounded"
					? CORNER_RADIUS_ROUNDED_PX
					: CORNER_RADIUS_SHARP_PX,
			"--text-color": resolveTextColor(
				configuration.textColor,
				resolvedBackground,
			),
			"--presentation-font-family": presentationFontFamily,
		} as CSSProperties;
	}, [configuration, frame, presentationFontFamily]);

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
					branding={branding}
					brandingSrc={brandingSrc}
					presentationFontFamily={presentationFontFamily}
					onDimensionsChange={handleDimensionsChange}
					onPositionChange={onPositionChange}
				/>
				<div ref={infoRef} className="presentation-canvas__info-wrapper">
					<ComparisonPresentationInfo
						presentation={presentation}
						visibility={visibility}
						stableWidthPx={stableWidthPx}
						presentationFontFamily={presentationFontFamily}
					/>
				</div>
			</div>
		</>
	);
}
