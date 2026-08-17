// The Edit Inspector's "Branding" section (docs/APPLICATION_LAYOUT.md "Edit
// Inspector" > "Branding"; docs/FEATURE_SPECIFICATION.md F-004 "Configure
// Comparison Branding"). Single-row None/Symbol/Custom option group; Symbol
// reveals the six-symbol grid, Custom reveals the image picker — mirrors
// the same "option group, optional area appears inline below it" structure
// src/components/PresentationSection.tsx already established, reusing that
// pattern's `.presentation-option-group`/`.presentation-options` styling
// rather than duplicating an equivalent set of CSS classes.
//
// Pure editing controls only, exactly like PresentationSection: this
// component never renders the comparison's live branding for display, only
// controls that write to the Current Working State via src/lib/branding.ts.
// The corresponding live rendering lives in
// src/components/ComparisonSliderHandle.tsx.
//
// `OptionGroup` below is a local, unexported duplicate of
// PresentationSection.tsx's own — that component's header comment already
// explains why: Background/Frame/Text/Corners each need the identical
// segmented-option-group behavior and are deliberately not exported for
// reuse beyond that file. The same reasoning applies here. `CustomColorFields`
// (docs/APPLICATION_LAYOUT.md "Branding" → "Color") is different: unlike
// `OptionGroup`, it carries real validation/error-state logic, so it is
// imported from src/components/CustomColorFields.tsx — the same component
// PresentationSection.tsx's own Background/Frame/Text Custom color areas use
// — rather than duplicated.

import { type ChangeEvent, useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import {
	applyBrandingImage,
	applyBrandingNone,
	applyBrandingSymbol,
	applyBrandingSymbolColor,
	getBrandingBuiltinId,
	getBrandingSymbolColor,
	getBrandingType,
	resolveHandleBranding,
} from "../lib/branding";
import { normalizeBrandingImage } from "../lib/branding-image-normalize";
import {
	BUILTIN_BRANDING_SYMBOLS,
	type BuiltinSymbolId,
	getSymbolViewBox,
} from "../lib/builtin-branding-symbols";
import {
	SYMBOL_COLOR,
	SYMBOL_COLOR_BRAND,
} from "../lib/comparison-handle-geometry";
import { useObjectUrl } from "../lib/use-object-url";
import type { CurrentWorkingState } from "../lib/workspace-state";
import CustomColorFields from "./CustomColorFields";

interface BrandingSectionProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
}

type DisplayedOption = "none" | "symbol" | "custom";

// Same starting value as PresentationSection.tsx's own
// INITIAL_CUSTOM_COLOR, for the identical reason (a concrete `color` is
// required the instant "custom" is first selected) — declared locally
// rather than imported: it is a trivial, self-evident literal, not shared
// logic, so importing it would only add a cross-file coupling for a single
// hex constant.
const INITIAL_CUSTOM_COLOR = "#FFFFFF";

export default function BrandingSection({
	currentWorkingState,
	onCurrentWorkingStateChange,
}: BrandingSectionProps) {
	const { t } = useLocale();
	const fileInputRef = useRef<HTMLInputElement>(null);
	// Neither "Symbol" nor "Custom" activates anything the instant it is
	// merely opened (docs/FEATURE_SPECIFICATION.md F-004: "Opening the
	// Built-in Symbol selection does not itself activate a symbol"; "without
	// an existing valid custom branding image, selecting Custom Image only
	// presents the image selection"). These two local flags are what let
	// each option's grid/picker render while the Current Working State's
	// effective branding stays untouched — Custom additionally short-circuits
	// this by immediately activating a remembered image when one exists (see
	// `handleTopLevelSelect` below), so `pendingCustomSelected` in practice
	// only matters the first time a workspace has no remembered image yet.
	// Reset on every session replace via EditInspector's `key={sessionDirectory}`,
	// the same reset boundary every other workspace-scoped local UI state in
	// this app already uses.
	const [pendingSymbolSelected, setPendingSymbolSelected] = useState(false);
	const [pendingCustomSelected, setPendingCustomSelected] = useState(false);
	const [hasImageError, setHasImageError] = useState(false);

	const brandingType = getBrandingType(currentWorkingState);
	// The pending flags are checked *before* the effective type: opening
	// Symbol while Custom (or an imported Built-in Symbol) is currently
	// effective must still switch the displayed panel to Symbol — otherwise
	// clicking "Symbol" while Custom is active would appear to do nothing,
	// since `brandingType` alone does not change until a tile is actually
	// clicked (docs/FEATURE_SPECIFICATION.md F-004: "Opening the Built-in
	// Symbol selection does not itself activate a symbol"). Exactly one of
	// the two pending flags is ever true at a time (every branch below that
	// sets one clears the other), so the order between them here never
	// matters — only that both are checked ahead of the effective type.
	const displayedOption: DisplayedOption = pendingSymbolSelected
		? "symbol"
		: pendingCustomSelected
			? "custom"
			: brandingType === "image"
				? "custom"
				: brandingType === "builtin"
					? "symbol"
					: "none";
	// Driven exclusively by the *effective* branding, never by
	// `brandingDraft` (docs/FEATURE_SPECIFICATION.md F-004: "the Built-in
	// Symbol selection shows a symbol as selected only while that symbol is
	// the currently active branding") — so the grid correctly shows nothing
	// selected while Symbol is merely open (pendingSymbolSelected) even if a
	// built-in was chosen earlier in the session.
	const selectedBuiltinId = getBrandingBuiltinId(currentWorkingState);
	const customPreviewSrc = useObjectUrl(
		brandingType === "image"
			? currentWorkingState.files.brandingHandleBytes
			: undefined,
	);
	// The single source of truth for Raster-vs-Vektor-vs-none (the same
	// function src/components/WorkspaceActive.tsx uses for the live Handle) —
	// reused here, not re-derived, specifically to decide whether the Color
	// group's controls are interactive: fully enabled only once a Web vector
	// symbol is genuinely active (`kind === "symbol"`), fully disabled while
	// an imported raster asset is still the active display (`kind ===
	// "asset"`, docs/IMPORTED_COMPARISON_V1.md "Session Branding": the
	// imported PNG "remains the asset used for display" until an explicit
	// tile click replaces it). Deliberately does not gate the Color group's
	// *presence* — see that group's own comment below for why visibility and
	// interactivity are kept independent.
	const handleBranding = resolveHandleBranding(currentWorkingState);
	const symbolColor = getBrandingSymbolColor(currentWorkingState);

	function handleTopLevelSelect(value: DisplayedOption) {
		setHasImageError(false);
		if (value === "none") {
			setPendingSymbolSelected(false);
			setPendingCustomSelected(false);
			onCurrentWorkingStateChange(applyBrandingNone(currentWorkingState));
		} else if (value === "symbol") {
			setPendingCustomSelected(false);
			// Opening Symbol never activates one on its own — the grid is
			// revealed, but the Current Working State is untouched until an
			// explicit tile click (`handleSymbolSelect` below).
			setPendingSymbolSelected(true);
		} else {
			setPendingSymbolSelected(false);
			const lastCustomImageBytes =
				currentWorkingState.brandingDraft.lastCustomImageBytes;
			if (lastCustomImageBytes) {
				// docs/FEATURE_SPECIFICATION.md F-004: "Selecting Custom Image
				// reactivates the most recently valid custom branding image
				// immediately... whenever one exists" — no re-upload required.
				setPendingCustomSelected(false);
				onCurrentWorkingStateChange(
					applyBrandingImage(currentWorkingState, lastCustomImageBytes),
				);
			} else {
				setPendingCustomSelected(true);
			}
		}
	}

	function handleSymbolSelect(id: BuiltinSymbolId) {
		setPendingSymbolSelected(false);
		onCurrentWorkingStateChange(applyBrandingSymbol(currentWorkingState, id));
	}

	function handleColorSelect(value: string) {
		if (value === "custom") {
			// Keeps the already-configured custom hex if there is one, exactly
			// like PresentationSection.tsx's own Background/Frame/Text "custom"
			// selection — a fresh starting value is only needed the first time.
			const hex =
				symbolColor.kind === "custom"
					? symbolColor.color
					: INITIAL_CUSTOM_COLOR;
			onCurrentWorkingStateChange(
				applyBrandingSymbolColor(currentWorkingState, {
					kind: "custom",
					color: hex,
				}),
			);
		} else {
			onCurrentWorkingStateChange(
				applyBrandingSymbolColor(currentWorkingState, {
					kind: value as "dark" | "brand",
				}),
			);
		}
	}

	// Normalizes the upload before it ever reaches applyBrandingImage — see
	// src/lib/branding-image-normalize.ts's own header comment for why this
	// is the one and only decode of `bytes` (the original upload) anywhere
	// in the pipeline. `bytes` itself is a local binding that goes out of
	// scope once this function returns; nothing here or in applyBrandingImage
	// retains it, so it becomes eligible for ordinary garbage collection
	// like any other local value — no explicit disposal is needed or
	// meaningful in JavaScript.
	async function handleFileSelected(file: File) {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const result = await normalizeBrandingImage(bytes);
		if (!result.ok) {
			setHasImageError(true);
			return;
		}
		setHasImageError(false);
		setPendingCustomSelected(false);
		onCurrentWorkingStateChange(
			applyBrandingImage(currentWorkingState, result.bytes),
		);
	}

	function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		// Allows choosing the same file again later (e.g. after an unrelated
		// change) to still fire a change event.
		event.target.value = "";
		if (file) void handleFileSelected(file);
	}

	return (
		<div className="presentation-section">
			{/* No visible legend here, unlike PresentationSection.tsx's own
			    top-level groups: those need one because Colors/Shape/Slider are
			    three distinct groups inside one accordion section. Branding has
			    exactly one group, and its label would be identical to the
			    accordion's own "Branding" title immediately above it
			    (docs/APPLICATION_LAYOUT.md "Branding" itself defines no inner
			    heading). The accessible name for the radiogroup below is still
			    supplied via `OptionGroup`'s own `legend` prop (`aria-label`). */}
			<div className="presentation-option-group">
				<OptionGroup
					legend={t.editInspector.branding.heading}
					testIdPrefix="edit-branding-option"
					selected={displayedOption}
					options={[
						{ value: "none", label: t.editInspector.branding.options.none },
						{
							value: "symbol",
							label: t.editInspector.branding.options.symbol,
						},
						{
							value: "custom",
							label: t.editInspector.branding.options.custom,
						},
					]}
					onSelect={(value) => handleTopLevelSelect(value as DisplayedOption)}
				/>

				{displayedOption === "symbol" && (
					<div
						className="branding-symbol-grid"
						role="radiogroup"
						aria-label={t.editInspector.branding.symbolsLegend}
					>
						{BUILTIN_BRANDING_SYMBOLS.map((symbol) => (
							// A native radio input cannot host this button's icon + label
							// content — see PresentationSection.tsx's OptionGroup for the
							// same rationale.
							// biome-ignore lint/a11y/useSemanticElements: see comment above
							<button
								key={symbol.id}
								type="button"
								role="radio"
								aria-checked={symbol.id === selectedBuiltinId}
								data-testid={`edit-branding-symbol-${symbol.id}`}
								className={`branding-symbol-grid__button${
									symbol.id === selectedBuiltinId
										? " branding-symbol-grid__button--selected"
										: ""
								}`}
								onClick={() => handleSymbolSelect(symbol.id)}
							>
								<svg
									className="branding-symbol-grid__icon"
									viewBox={getSymbolViewBox(symbol)}
									aria-hidden="true"
									focusable="false"
								>
									<path d={symbol.pathData} fill="currentColor" />
								</svg>
								<span>{t.editInspector.branding.symbols[symbol.id]}</span>
							</button>
						))}
					</div>
				)}

				{/* docs/APPLICATION_LAYOUT.md "Branding" → "Color": visibility and
				    interactivity are two independent conditions. Visible whenever the
				    Symbol panel itself is displayed (`displayedOption === "symbol"`) —
				    including while an imported raster asset (`handleBranding.kind ===
				    "asset"`) is still the active display, so the group never
				    appears/disappears around the moment a symbol tile is clicked; only
				    its controls' `disabled` state changes then, never its presence.
				    Fully interactive only once a Web vector symbol is genuinely active
				    (`handleBranding.kind === "symbol"`) — the same source of truth the
				    Handle itself renders from, so this can never disagree with what is
				    actually on screen. */}
				{displayedOption === "symbol" && (
					<div className="presentation-option-group">
						<span className="presentation-option-group__legend">
							{t.editInspector.branding.colorLegend}
						</span>
						<OptionGroup
							legend={t.editInspector.branding.colorLegend}
							testIdPrefix="edit-branding-color"
							selected={symbolColor.kind}
							disabled={handleBranding.kind !== "symbol"}
							options={[
								{
									value: "dark",
									label: t.editInspector.branding.colorOptions.dark,
									chipColor: SYMBOL_COLOR,
								},
								{
									value: "brand",
									label: t.editInspector.branding.colorOptions.brand,
									chipColor: SYMBOL_COLOR_BRAND,
								},
								{
									value: "custom",
									label: t.editInspector.branding.colorOptions.custom,
								},
							]}
							onSelect={handleColorSelect}
						/>
						{symbolColor.kind === "custom" && (
							<CustomColorFields
								idPrefix="edit-branding-color-custom"
								value={symbolColor.color}
								onChange={(color) =>
									onCurrentWorkingStateChange(
										applyBrandingSymbolColor(currentWorkingState, {
											kind: "custom",
											color,
										}),
									)
								}
								heading={t.editInspector.presentation.customColorHeading}
								swatchLabel={
									t.editInspector.presentation.customColorSwatchLabel
								}
								hexLabel={t.editInspector.presentation.customColorHexLabel}
								disabled={handleBranding.kind !== "symbol"}
							/>
						)}
					</div>
				)}

				{displayedOption === "custom" && (
					<div className="branding-custom-image">
						{customPreviewSrc && (
							<img
								src={customPreviewSrc}
								alt=""
								className="branding-custom-image__preview"
								data-testid="edit-branding-custom-preview"
							/>
						)}
						<input
							ref={fileInputRef}
							id="edit-branding-custom-input"
							type="file"
							accept="image/*"
							className="visually-hidden"
							data-testid="edit-branding-custom-input"
							onChange={handleFileInputChange}
						/>
						<button
							type="button"
							className="branding-custom-image__button"
							data-testid="edit-branding-custom-choose-button"
							onClick={() => fileInputRef.current?.click()}
						>
							{brandingType === "image"
								? t.editInspector.branding.replaceImageButton
								: t.editInspector.branding.chooseImageButton}
						</button>
						{hasImageError && (
							<p
								className="branding-custom-image__error"
								role="alert"
								data-testid="edit-branding-custom-error"
							>
								{t.editInspector.branding.invalidImageError}
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

interface OptionGroupOption {
	readonly value: string;
	readonly label: string;
	readonly chipColor?: string;
}

interface OptionGroupProps {
	readonly legend: string;
	readonly testIdPrefix: string;
	readonly options: readonly OptionGroupOption[];
	readonly selected: string;
	readonly onSelect: (value: string) => void;
	// Native `disabled` on every option button (docs/APPLICATION_LAYOUT.md
	// "Branding" → "Color"): not merely non-interactive styling — this is
	// what removes each button from the tab order and blocks click/keyboard
	// activation at the browser level, without any separate JS guard in
	// `onSelect` being needed. Only the Color group ever sets this; the
	// top-level None/Symbol/Custom group above never does.
	readonly disabled?: boolean;
}

// docs/APPLICATION_LAYOUT.md "Branding": the top-level None/Symbol/Custom
// group is a plain "Single-row option group" — no color chips, so its own
// call site below never sets `chipColor`. The Color group (Dark/Brand/
// Custom) reuses this same local component but does set `chipColor` for
// Dark/Brand, mirroring PresentationSection.tsx's own `OptionGroup` chip
// rendering exactly (including the identical accessibility treatment —
// `aria-hidden`, decorative only, the label already conveys the option's
// meaning). Custom carries no `chipColor` here either, exactly like
// Background/Frame/Text's own Custom options: the actual current custom
// color is represented by CustomColorFields' swatch instead.
function OptionGroup({
	legend,
	testIdPrefix,
	options,
	selected,
	onSelect,
	disabled,
}: OptionGroupProps) {
	return (
		<div className="presentation-options" role="radiogroup" aria-label={legend}>
			{options.map((option) => (
				// See PresentationSection.tsx's OptionGroup for the identical
				// rationale.
				// biome-ignore lint/a11y/useSemanticElements: see comment above
				<button
					key={option.value}
					type="button"
					role="radio"
					aria-checked={option.value === selected}
					data-testid={`${testIdPrefix}-${option.value}`}
					className={`presentation-options__button${
						option.value === selected
							? " presentation-options__button--selected"
							: ""
					}`}
					disabled={disabled}
					onClick={() => onSelect(option.value)}
				>
					{option.chipColor && (
						<span
							className="presentation-options__chip"
							style={{ background: option.chipColor }}
							aria-hidden="true"
						/>
					)}
					{option.label}
				</button>
			))}
		</div>
	);
}
