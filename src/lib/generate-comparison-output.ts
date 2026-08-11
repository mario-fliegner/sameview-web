// Top-level Output generation orchestration (docs/FEATURE_SPECIFICATION.md
// F-005; docs/APPLICATION_LAYOUT.md "Output Inspector"). The one place that
// combines an Outcome Snapshot (Phase 7), Phase 8's image processing and a
// Phase 9 packaging generator into one atomic result for
// src/components/OutputInspector.tsx: either a complete, ready-to-download
// artifact, or an error with no artifact at all — "no partial download on
// a generation failure" (the approved Download-behavior decision) is
// enforced structurally here, not by convention at the call site.

import type { Locale } from "../i18n/translations";
import type { ComparisonArtifactCopy } from "./comparison-artifact-markup.ts";
import type { DeriveComparisonPresentationOptions } from "./comparison-presentation.ts";
import {
	generateStandaloneHtml,
	STANDALONE_HTML_FILENAME,
} from "./generate-standalone-html.ts";
import {
	generateStaticMicrosite,
	STATIC_MICROSITE_FILENAME,
} from "./generate-static-microsite.ts";
import {
	createOutcomeSnapshot,
	type OutcomeSnapshot,
} from "./outcome-snapshot.ts";
import {
	type ProcessComparisonImagesError,
	processComparisonImages,
} from "./process-comparison-images.ts";
import type { GeneratedArtifact } from "./trigger-download.ts";
import type { CurrentWorkingState } from "./workspace-state.ts";

export type OutputType = "standalone-html" | "static-microsite";

// The Output Inspector's progress phases (docs/APPLICATION_LAYOUT.md
// "Progress": "Preparing comparison / Processing images / Building output /
// Starting download") — reported as this function's own work actually
// reaches each step, never simulated with an artificial delay.
export type GenerateComparisonOutputPhase =
	| "preparing-comparison"
	| "processing-images"
	| "building-output";

export interface GenerateComparisonOutputOptions {
	readonly currentWorkingState: CurrentWorkingState;
	readonly locale: Locale;
	readonly presentationOptions: DeriveComparisonPresentationOptions;
	readonly outputType: OutputType;
	readonly removeEmbeddedLocationData: boolean;
	readonly copy: ComparisonArtifactCopy;
	readonly titleText: string;
	readonly metaDescriptionText: string;
	readonly themeColor: string;
	readonly noscriptText: string;
	// docs/COMPARISON_PRESENTATION.md "Initial Slider Position", "Use Current
	// Slider Position": a [0, 1] fraction, already resolved by the caller —
	// either the fixed V1 default or a live Workspace Preview slider position
	// read at the moment Generate was pressed. Forwarded to
	// createOutcomeSnapshot() unchanged; this module makes no decision of its
	// own about which value to use.
	readonly initialSliderPosition: number;
	readonly onPhase?: (phase: GenerateComparisonOutputPhase) => void;
}

export type GenerateComparisonOutputError =
	| {
			readonly code: "image-processing-failed";
			readonly error: ProcessComparisonImagesError;
	  }
	| { readonly code: "packaging-failed"; readonly error: unknown };

export type GenerateComparisonOutputResult =
	| { readonly ok: true; readonly value: GeneratedArtifact }
	| { readonly ok: false; readonly error: GenerateComparisonOutputError };

function withProcessedImages(
	snapshot: OutcomeSnapshot,
	referenceImageBytes: Uint8Array,
	captureImageBytes: Uint8Array,
): OutcomeSnapshot {
	return { ...snapshot, referenceImageBytes, captureImageBytes };
}

export async function generateComparisonOutput(
	options: GenerateComparisonOutputOptions,
): Promise<GenerateComparisonOutputResult> {
	options.onPhase?.("preparing-comparison");
	const snapshot = createOutcomeSnapshot(
		options.currentWorkingState,
		options.locale,
		options.presentationOptions,
		options.initialSliderPosition,
	);

	options.onPhase?.("processing-images");
	const processedImages = processComparisonImages(snapshot, {
		removeEmbeddedLocationData: options.removeEmbeddedLocationData,
	});
	if (!processedImages.ok) {
		return {
			ok: false,
			error: { code: "image-processing-failed", error: processedImages.error },
		};
	}

	const processedSnapshot = withProcessedImages(
		snapshot,
		processedImages.value.referenceImageBytes,
		processedImages.value.captureImageBytes,
	);

	const generatorOptions = {
		snapshot: processedSnapshot,
		locale: options.locale,
		copy: options.copy,
		titleText: options.titleText,
		metaDescriptionText: options.metaDescriptionText,
		themeColor: options.themeColor,
		noscriptText: options.noscriptText,
	};

	options.onPhase?.("building-output");
	try {
		if (options.outputType === "standalone-html") {
			const bytes = await generateStandaloneHtml(generatorOptions);
			return {
				ok: true,
				value: {
					filename: STANDALONE_HTML_FILENAME,
					mimeType: "text/html",
					bytes,
				},
			};
		}
		const bytes = await generateStaticMicrosite(generatorOptions);
		return {
			ok: true,
			value: {
				filename: STATIC_MICROSITE_FILENAME,
				mimeType: "application/zip",
				bytes,
			},
		};
	} catch (error) {
		return { ok: false, error: { code: "packaging-failed", error } };
	}
}
