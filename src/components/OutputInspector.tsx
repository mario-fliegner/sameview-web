// The Context Inspector's Output Inspector (docs/APPLICATION_LAYOUT.md
// "Output Inspector"), replacing the Edit Inspector once the user selects
// "Create Output" (src/components/EditInspector.tsx). The Presentation
// Preview stays mounted and unchanged behind it — this component never
// touches Current Working State, only reads it once per generation
// (src/lib/generate-comparison-output.ts).
//
// Snapshot only at Generate (docs/IMPORTED_COMPARISON_V1.md "Outcome
// Snapshot"): nothing here is computed until the primary action is
// pressed. Download behavior is the approved "Variante A": generation
// completes fully first, then the browser download is triggered exactly
// once automatically with no success/failure detection (no reliable
// browser signal exists — see docs/IMPLEMENTATION_PLAN_V1.md Phase 9's own
// Risks entry), and the Completion state never claims the file was
// actually saved. `Download again` re-triggers the same already-generated
// bytes, never a new generation cycle. A generation failure never triggers
// any download and always shows the error state instead.

import { useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import type { ComparisonPresentation } from "../lib/comparison-presentation";
import {
	type GenerateComparisonOutputPhase,
	generateComparisonOutput,
	type OutputType,
} from "../lib/generate-comparison-output";
import {
	type GeneratedArtifact,
	triggerDownload,
} from "../lib/trigger-download";
import type { CurrentWorkingState } from "../lib/workspace-state";

interface OutputInspectorProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly presentation: ComparisonPresentation;
	readonly onBackToEdit: () => void;
}

type Phase = "idle" | "generating" | "ready" | "error";

// docs/BRAND_GUIDE.md Brand Identity Color — the same dark background used
// throughout this application; the generated artifact's own `theme-color`.
const THEME_COLOR = "#0D1424";

export default function OutputInspector({
	currentWorkingState,
	presentation,
	onBackToEdit,
}: OutputInspectorProps) {
	const { locale, t } = useLocale();
	const [outputType, setOutputType] = useState<OutputType>("standalone-html");
	const [removeEmbeddedLocationData, setRemoveEmbeddedLocationData] =
		useState(true);
	const [phase, setPhase] = useState<Phase>("idle");
	const [progressPhase, setProgressPhase] = useState<
		GenerateComparisonOutputPhase | "starting-download" | null
	>(null);
	const artifactRef = useRef<GeneratedArtifact | null>(null);

	const showLocationVisible =
		currentWorkingState.presentationVisibility.location;

	async function runGeneration() {
		setPhase("generating");
		setProgressPhase("preparing-comparison");
		const result = await generateComparisonOutput({
			currentWorkingState,
			locale,
			presentationOptions: {
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
			},
			outputType,
			removeEmbeddedLocationData,
			copy: {
				referenceAlt: t.workspace.referenceImageAlt,
				captureAlt: t.workspace.captureImageAlt,
				sliderLabel: t.workspace.sliderLabel,
				loadingLabel: t.workspace.loadingLabel,
			},
			titleText: presentation.title || t.outputInspector.artifactTitleFallback,
			metaDescriptionText: t.outputInspector.artifactMetaDescription,
			themeColor: THEME_COLOR,
			noscriptText: t.outputInspector.artifactNoscriptHint,
			onPhase: (nextPhase) => setProgressPhase(nextPhase),
		});

		if (!result.ok) {
			artifactRef.current = null;
			setPhase("error");
			setProgressPhase(null);
			return;
		}

		setProgressPhase("starting-download");
		artifactRef.current = result.value;
		triggerDownload(result.value);
		setPhase("ready");
		setProgressPhase(null);
	}

	function handleDownloadAgain() {
		if (artifactRef.current) triggerDownload(artifactRef.current);
	}

	const isGenerating = phase === "generating";
	const primaryLabel =
		outputType === "standalone-html"
			? t.outputInspector.downloadHtmlButton
			: t.outputInspector.downloadZipButton;

	const progressLabel =
		progressPhase === "preparing-comparison"
			? t.outputInspector.progressPreparingComparison
			: progressPhase === "processing-images"
				? t.outputInspector.progressProcessingImages
				: progressPhase === "building-output"
					? t.outputInspector.progressBuildingOutput
					: progressPhase === "starting-download"
						? t.outputInspector.progressStartingDownload
						: "";

	return (
		<aside
			className="output-inspector"
			aria-label={t.outputInspector.heading}
			data-testid="output-inspector"
		>
			<button
				type="button"
				className="output-inspector__back-button"
				data-testid="output-inspector-back-button"
				onClick={onBackToEdit}
				disabled={isGenerating}
			>
				{t.outputInspector.backToEditButton}
			</button>

			<h2 className="output-inspector__heading">{t.outputInspector.heading}</h2>

			<div
				className="output-inspector__cards"
				role="radiogroup"
				aria-label={t.outputInspector.heading}
			>
				{/* A native <input type="radio"> cannot host the name+description
				    content each card needs — mirrors src/components/PresentationSection.tsx's
				    own OptionGroup, which documents the identical reason. */}
				{/* biome-ignore lint/a11y/useSemanticElements: see comment above */}
				<button
					type="button"
					role="radio"
					aria-checked={outputType === "standalone-html"}
					className={`output-inspector__card${
						outputType === "standalone-html"
							? " output-inspector__card--selected"
							: ""
					}`}
					data-testid="output-card-standalone-html"
					onClick={() => setOutputType("standalone-html")}
					disabled={isGenerating}
				>
					<span className="output-inspector__card-name">
						{t.outputInspector.standaloneName}
					</span>
					<span className="output-inspector__card-description">
						{t.outputInspector.standaloneDescription}
					</span>
				</button>
				{/* biome-ignore lint/a11y/useSemanticElements: see comment above */}
				<button
					type="button"
					role="radio"
					aria-checked={outputType === "static-microsite"}
					className={`output-inspector__card${
						outputType === "static-microsite"
							? " output-inspector__card--selected"
							: ""
					}`}
					data-testid="output-card-static-microsite"
					onClick={() => setOutputType("static-microsite")}
					disabled={isGenerating}
				>
					<span className="output-inspector__card-name">
						{t.outputInspector.micrositeName}
					</span>
					<span className="output-inspector__card-description">
						{t.outputInspector.micrositeDescription}
					</span>
				</button>
				<div
					className="output-inspector__card output-inspector__card--disabled"
					data-testid="output-card-cms-package"
					aria-disabled="true"
				>
					<span className="output-inspector__card-name">
						{t.outputInspector.cmsName}
						<span className="output-inspector__card-badge">
							{t.outputInspector.comingSoonBadge}
						</span>
					</span>
					<span className="output-inspector__card-description">
						{t.outputInspector.cmsDescription}
					</span>
				</div>
			</div>

			<div className="output-inspector__field-row">
				<span className="output-inspector__toggle-label">
					{t.outputInspector.removeLocationDataLabel}
				</span>
				<button
					type="button"
					role="switch"
					aria-checked={removeEmbeddedLocationData}
					data-testid="output-remove-location-data-switch"
					className={`switch${removeEmbeddedLocationData ? " switch--on" : ""}`}
					onClick={() => setRemoveEmbeddedLocationData((current) => !current)}
					disabled={isGenerating}
				>
					<span className="switch__track">
						<span className="switch__thumb" />
					</span>
				</button>
			</div>
			{removeEmbeddedLocationData && showLocationVisible && (
				<p
					className="output-inspector__hint"
					data-testid="output-remove-location-data-hint"
				>
					{t.outputInspector.removeLocationDataHint}
				</p>
			)}

			{phase === "generating" && (
				<div
					className="output-inspector__progress"
					data-testid="output-progress"
					aria-live="polite"
				>
					<span className="output-inspector__progress-bar" aria-hidden="true" />
					<span data-testid="output-progress-label">{progressLabel}</span>
				</div>
			)}

			{phase === "error" && (
				<div
					className="output-inspector__error"
					data-testid="output-error"
					role="alert"
				>
					<p className="output-inspector__error-heading">
						{t.outputInspector.errorHeading}
					</p>
					<p>{t.outputInspector.errorMessage}</p>
				</div>
			)}

			{phase === "ready" && (
				<div className="output-inspector__ready" data-testid="output-ready">
					<p className="output-inspector__ready-heading">
						{t.outputInspector.readyHeading}
					</p>
					<p>{t.outputInspector.readyMessage}</p>
				</div>
			)}

			<button
				type="button"
				className="output-inspector__primary-button"
				data-testid="output-primary-action"
				onClick={phase === "ready" ? handleDownloadAgain : runGeneration}
				disabled={isGenerating}
			>
				{phase === "ready"
					? t.outputInspector.downloadAgainButton
					: primaryLabel}
			</button>
		</aside>
	);
}
