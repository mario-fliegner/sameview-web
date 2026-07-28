// The real Workspace Active content (docs/APPLICATION_LAYOUT.md "State B —
// Workspace Active", "Viewer", "Comparison Section"; docs/FEATURE_SPECIFICATION.md
// F-002), replacing the earlier minimal placeholder. This is the workspace
// integration/adapter layer: the one component that reads Current Working
// State directly. It derives the presentation model, manages the reference
// and capture object-URL lifecycle, and lays out the Viewer (ComparisonSlider)
// and the Comparison Section (ComparisonInfo) — two-column on wider screens,
// stacked with the Viewer first on narrow ones (docs/APPLICATION_LAYOUT.md
// "Responsive Layout").
//
// Owns the exact ref/testid/focus contract this replaces from
// src/components/ImportSection.tsx's former placeholder branch, unchanged:
// - `data-testid="workspace-active"` / `#workspace-active-title`: relied on
//   by the existing Replacement Mode and import-transition E2E tests.
// - The scroll-into-view-on-mount effect: this component only ever mounts on
//   the `no-workspace` -> `active` transition (src/components/ImportSection.tsx
//   renders either the no-workspace stage or this component, never both, and
//   never remounts this component across a Replace Export commit — the
//   *initial* import's "scroll to orientation" and a *replacement*'s "move
//   focus" are different transitions with different rules, see below), so
//   "on mount" is exactly the signal docs/APPLICATION_LAYOUT.md's "Import
//   Succeeded" describes.
// - The focus-the-heading-on-replace effect: fires when `currentWorkingState`
//   changes reference while already mounted (every commit produces a new
//   object, see cloneAsCurrentWorkingState in src/lib/workspace-state.ts),
//   which only ever happens via a Replace Export commit.
//
// Viewing never mutates Source Data or the Current Working State
// (docs/FEATURE_SPECIFICATION.md F-002 Rules): nothing here writes back to
// `currentWorkingState`, and the interactive slider's own position is local,
// uncontrolled state inside ComparisonSlider.

import { useEffect, useMemo, useRef } from "react";
import { useLocale } from "../i18n/LocaleContext";
import { deriveComparisonPresentation } from "../lib/comparison-presentation";
import { useObjectUrl } from "../lib/use-object-url";
import type { CurrentWorkingState } from "../lib/workspace-state";
import ComparisonInfo from "./ComparisonInfo";
import ComparisonSlider from "./ComparisonSlider";

interface WorkspaceActiveProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly errorMessage: string | null;
}

export default function WorkspaceActive({
	currentWorkingState,
	errorMessage,
}: WorkspaceActiveProps) {
	const { locale, t } = useLocale();
	const activeSectionRef = useRef<HTMLElement>(null);
	const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
	const previousCurrentWorkingStateRef = useRef(currentWorkingState);

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
		if (previousCurrentWorkingStateRef.current !== currentWorkingState) {
			workspaceHeadingRef.current?.focus();
		}
		previousCurrentWorkingStateRef.current = currentWorkingState;
	}, [currentWorkingState]);

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
			<h1
				id="workspace-active-title"
				className="workspace-active__title"
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
			<div className="workspace-active__layout">
				<ComparisonSlider
					key={currentWorkingState.sessionDirectory}
					referenceSrc={referenceSrc}
					captureSrc={captureSrc}
					referenceAlt={t.workspace.referenceImageAlt}
					captureAlt={t.workspace.captureImageAlt}
					sliderLabel={t.workspace.sliderLabel}
					loadingLabel={t.workspace.loadingLabel}
					leftLabel={presentation.sliderLabels.left}
					rightLabel={presentation.sliderLabels.right}
				/>
				<ComparisonInfo
					description={presentation.description}
					referenceLabel={presentation.referenceLabel}
					captureLabel={presentation.captureLabel}
					location={presentation.location}
					sessionDirectory={currentWorkingState.sessionDirectory}
				/>
			</div>
		</section>
	);
}
