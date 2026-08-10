// The single, central Comparison Presentation markup builder
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 9: "one single, central HTML/
// Presentation document scaffold"; docs/COMPARISON_PRESENTATION.md Part 1
// "Interaction Parity"). Produces the exact same DOM shape/classes as the
// live Workspace Preview's React tree (src/components/WorkspaceActive.tsx's
// `PresentationCanvas`, src/components/ComparisonSlider.tsx,
// src/components/ComparisonSliderHandle.tsx,
// src/components/ComparisonPresentationInfo.tsx) so
// src/styles/comparison-presentation.css and
// src/lib/comparison-presentation-runtime.ts — both already shared —
// apply unchanged. Pure string building only: no DOM, no React. Consumed
// identically by src/lib/generate-standalone-html.ts (inlined) and
// src/lib/generate-static-microsite.ts (written into `index.html`) — never
// a second, independently written markup shape per output type.
//
// Static per-item visibility (docs/COMPARISON_PRESENTATION.md "General
// Rules": "Hidden or unavailable items reserve no space") is resolved once,
// here, at generation time, exactly like React's own conditional rendering
// — an Outcome Snapshot's configuration never changes after generation, so
// there is nothing for the runtime to react to on this axis. Only the
// genuinely dynamic parts (image-load gating, slider position, adaptive
// text size, on-image label visibility) are left for
// src/lib/comparison-presentation-runtime.ts to drive, via the same
// `id="sameview-..."` contract it reads.

import type { HandleBranding } from "./branding.ts";
import {
	getBuiltinBrandingSymbol,
	getSymbolViewBox,
} from "./builtin-branding-symbols.ts";
import {
	BRANDED_HANDLE_VISUAL_REM,
	getContentBox,
	HANDLE_RADIUS_PX,
	IMAGE_CONTENT_RATIO,
	RING_STROKE_WIDTH_PX,
	STANDARD_ARROW_COLOR,
	STANDARD_HANDLE_VISUAL_REM,
	SYMBOL_CONTENT_RATIO,
} from "./comparison-handle-geometry.ts";
import type { ComparisonPresentation } from "./comparison-presentation.ts";
import { escapeHtml } from "./html-escape.ts";
import {
	resolveCanvasBackground,
	resolveFrame,
	resolveTextColor,
} from "./presentation-style-resolution.ts";
import type {
	PresentationConfiguration,
	PresentationVisibility,
} from "./workspace-state.ts";

// Mirrors src/components/ComparisonSliderHandle.tsx's own literal path data
// exactly (Android CompareScreen.kt `CompareDivider` transcription) — see
// that component's own header comment for the source of each constant.
const RING_ARC_LEFT = "M 21.594 52.432 A 26 26 0 0 1 21.594 1.568";
const RING_ARC_RIGHT = "M 32.406 1.568 A 26 26 0 0 1 32.406 52.432";
const CHEVRON_LEFT = "M 22 20 L 14 27 L 22 34";
const CHEVRON_RIGHT = "M 32 20 L 40 27 L 32 34";

function buildHandleMarkup(
	branding: HandleBranding,
	brandingSrc: string | undefined,
): string {
	const symbol =
		branding.kind === "symbol"
			? getBuiltinBrandingSymbol(branding.builtinId)
			: undefined;
	const imageBox = getContentBox(IMAGE_CONTENT_RATIO);
	const symbolBox = getContentBox(SYMBOL_CONTENT_RATIO);
	// The rendered CSS box size — src/components/ComparisonSliderHandle.tsx's
	// own inline `style={{ width, height }}`, transcribed here from the same
	// shared constants (never redeclared): src/styles/comparison-presentation.css's
	// `.comparison-slider__handle-visual` rule intentionally sets no size of
	// its own (see that rule's own comment), so without this the SVG's
	// `viewBox`-only intrinsic sizing left it at the browser's own default
	// replaced-element size — confirmed empirically at 28px, neither the
	// standard 54px (3.375rem) nor the branding-enlarged 81px (5.0625rem)
	// docs/COMPARISON_PRESENTATION.md Part 2 "Handle" documents.
	const isBranded = branding.kind !== "none";
	const visualSizeRem = isBranded
		? BRANDED_HANDLE_VISUAL_REM
		: STANDARD_HANDLE_VISUAL_REM;

	const chevrons =
		branding.kind === "none"
			? `<path d="${CHEVRON_LEFT}" fill="none" stroke="${STANDARD_ARROW_COLOR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /><path d="${CHEVRON_RIGHT}" fill="none" stroke="${STANDARD_ARROW_COLOR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`
			: "";
	const assetImage =
		branding.kind === "asset" && brandingSrc
			? `<image href="${escapeHtml(brandingSrc)}" x="${imageBox.offset}" y="${imageBox.offset}" width="${imageBox.side}" height="${imageBox.side}" preserveAspectRatio="xMidYMid meet" />`
			: "";
	const symbolSvg =
		branding.kind === "symbol" && symbol
			? `<svg x="${symbolBox.offset}" y="${symbolBox.offset}" width="${symbolBox.side}" height="${symbolBox.side}" viewBox="${getSymbolViewBox(symbol)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><path d="${symbol.pathData}" fill="${branding.color}" /></svg>`
			: "";

	return `<svg class="comparison-slider__handle-visual" id="sameview-handle-visual" style="width: ${visualSizeRem}rem; height: ${visualSizeRem}rem" viewBox="0 0 54 54" aria-hidden="true" focusable="false" data-testid="comparison-slider-handle" data-branding-kind="${branding.kind}"><path d="${RING_ARC_LEFT}" fill="none" stroke="#ffffff" stroke-width="${RING_STROKE_WIDTH_PX}" /><path d="${RING_ARC_RIGHT}" fill="none" stroke="#ffffff" stroke-width="${RING_STROKE_WIDTH_PX}" /><circle cx="27" cy="27" r="${HANDLE_RADIUS_PX}" fill="#ffffff" />${chevrons}${assetImage}${symbolSvg}</svg>`;
}

export interface ComparisonInfoLabels {
	readonly showDuration: boolean;
}

function formatLocation(location: {
	readonly displayName: string | undefined;
	readonly city: string | undefined;
	readonly country: string | undefined;
}): string {
	const cityCountry = [location.city, location.country]
		.filter((part): part is string => Boolean(part))
		.join(", ");
	return [location.displayName, cityCountry]
		.filter((part): part is string => Boolean(part))
		.join(" · ");
}

function buildInfoMarkup(
	presentation: ComparisonPresentation,
	visibility: PresentationVisibility,
): string {
	const locationText = presentation.location
		? formatLocation(presentation.location)
		: undefined;
	const showDuration =
		visibility.time &&
		visibility.timeDifference &&
		Boolean(presentation.durationLabel);
	const showTitle = visibility.title && Boolean(presentation.title);
	const showDescription =
		visibility.description && Boolean(presentation.description);
	const showTime = visibility.time;
	const showLocation = visibility.location && Boolean(locationText);

	const titleHtml = showTitle
		? `<p class="presentation-info__title" id="sameview-title" data-testid="comparison-title" data-overflow-tooltip>${escapeHtml(presentation.title ?? "")}</p>`
		: "";
	const descriptionHtml = showDescription
		? `<p class="presentation-info__description" id="sameview-description" data-testid="comparison-description" data-overflow-tooltip>${escapeHtml(presentation.description ?? "")}</p>`
		: "";
	const primaryCluster =
		showTitle || showDescription
			? `<div class="presentation-info__primary">${titleHtml}${descriptionHtml}</div>`
			: "";

	const durationHtml = showDuration
		? ` · <span data-testid="comparison-duration-label">${escapeHtml(presentation.durationLabel ?? "")}</span>`
		: "";
	const timeHtml = showTime
		? `<p class="presentation-info__time" id="sameview-time" data-testid="comparison-time"><span data-testid="comparison-reference-label">${escapeHtml(presentation.referenceLabel)}</span> → <span data-testid="comparison-capture-label">${escapeHtml(presentation.captureLabel)}</span>${durationHtml}</p>`
		: "";
	const locationHtml = showLocation
		? `<p class="presentation-info__location" id="sameview-location" data-testid="comparison-location" data-overflow-tooltip>${escapeHtml(locationText ?? "")}</p>`
		: "";
	const contextCluster =
		showTime || showLocation
			? `<div class="presentation-info__context">${timeHtml}${locationHtml}</div>`
			: "";

	return `<div class="presentation-info" id="sameview-presentation-info" data-testid="comparison-presentation-info">${primaryCluster}${contextCluster}</div>`;
}

export interface ComparisonArtifactAssetUrls {
	readonly referenceSrc: string;
	readonly captureSrc: string;
	readonly brandingSrc: string | undefined;
}

export interface ComparisonArtifactCopy {
	readonly referenceAlt: string;
	readonly captureAlt: string;
	readonly sliderLabel: string;
	readonly loadingLabel: string;
}

export interface BuildComparisonArtifactMarkupInput {
	readonly presentation: ComparisonPresentation;
	readonly visibility: PresentationVisibility;
	readonly configuration: PresentationConfiguration;
	readonly branding: HandleBranding;
	readonly assets: ComparisonArtifactAssetUrls;
	readonly copy: ComparisonArtifactCopy;
	readonly presentationFontFamily: string;
	// A fraction in [0, 1] (docs/COMPARISON_PRESENTATION.md Part 2 "Initial
	// Slider Position") — converted to the same 0-100 percent scale
	// src/components/ComparisonSlider.tsx's own local state already uses.
	readonly initialSliderPosition: number;
}

// The complete `.presentation-canvas` markup — the one piece both
// src/lib/generate-standalone-html.ts and src/lib/generate-static-microsite.ts
// embed into their own document shell, via src/lib/comparison-artifact-scaffold.ts.
export function buildComparisonArtifactMarkup(
	input: BuildComparisonArtifactMarkupInput,
): string {
	const {
		presentation,
		visibility,
		configuration,
		branding,
		assets,
		copy,
		presentationFontFamily,
		initialSliderPosition,
	} = input;

	const resolvedBackground = resolveCanvasBackground(
		configuration.canvasBackground,
	);
	const frame = resolveFrame(configuration.frame);
	const textColor = resolveTextColor(
		configuration.textColor,
		resolvedBackground,
	);
	const cornerRadius =
		configuration.cornerRadius === "rounded" ? "0.75rem" : "0";
	const positionPercent = Math.min(
		100,
		Math.max(0, initialSliderPosition * 100),
	);

	const canvasStyle = [
		`--canvas-background: ${resolvedBackground}`,
		`--frame-color: ${frame.color}`,
		`--frame-width: ${frame.widthPx}px`,
		`--corner-radius: ${cornerRadius}`,
		`--text-color: ${textColor}`,
		`--presentation-font-family: ${presentationFontFamily}`,
	].join("; ");

	const handleMarkup = buildHandleMarkup(branding, assets.brandingSrc);
	const infoMarkup = buildInfoMarkup(presentation, visibility);

	const brandingSrcAttr = assets.brandingSrc
		? ` data-branding-src="${escapeHtml(assets.brandingSrc)}"`
		: "";

	return `<div class="presentation-canvas" id="sameview-canvas" style="${escapeHtml(canvasStyle)}" data-show-slider-date-labels="${configuration.showSliderDateLabels}"${brandingSrcAttr}>
	<div class="comparison-slider__frame comparison-slider__frame--loading" id="sameview-slider-frame" data-testid="comparison-slider">
		<img src="${escapeHtml(assets.captureSrc)}" alt="${escapeHtml(copy.captureAlt)}" class="comparison-slider__image" draggable="false" id="sameview-capture-image" data-testid="capture-image" style="visibility: hidden" />
		<img src="${escapeHtml(assets.referenceSrc)}" alt="${escapeHtml(copy.referenceAlt)}" class="comparison-slider__image comparison-slider__image--overlay" draggable="false" id="sameview-reference-image" data-testid="reference-image" style="visibility: hidden; clip-path: inset(0 ${100 - positionPercent}% 0 0)" />
		<div class="comparison-slider__divider-line" id="sameview-divider-line" data-testid="comparison-divider-line" style="inset-inline-start: ${positionPercent}%; display: none"></div>
		<div class="comparison-slider__handle" id="sameview-handle" role="slider" aria-label="${escapeHtml(copy.sliderLabel)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(positionPercent)}" tabindex="0" style="inset-inline-start: ${positionPercent}%; display: none">
			${handleMarkup}
		</div>
		<span class="comparison-slider__label" id="sameview-label-left" data-testid="comparison-slider-label-left" style="display: none">${escapeHtml(presentation.sliderLabels.left)}</span>
		<span class="comparison-slider__label" id="sameview-label-right" data-testid="comparison-slider-label-right" style="display: none">${escapeHtml(presentation.sliderLabels.right)}</span>
		<p class="comparison-slider__loading" id="sameview-loading" data-testid="comparison-loading" aria-live="polite">${escapeHtml(copy.loadingLabel)}</p>
	</div>
	<div class="presentation-canvas__info-wrapper" id="sameview-info-wrapper">
		${infoMarkup}
	</div>
</div>`;
}
