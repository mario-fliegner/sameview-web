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
// reuse beyond that file. The same reasoning applies here.

import { type ChangeEvent, useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import {
	applyBrandingImage,
	applyBrandingNone,
	applyBrandingSymbol,
	getBrandingBuiltinId,
	getBrandingType,
} from "../lib/branding";
import {
	BUILTIN_BRANDING_SYMBOLS,
	type BuiltinSymbolId,
	getSymbolViewBox,
} from "../lib/builtin-branding-symbols";
import { validateImageContent } from "../lib/import-image";
import { useObjectUrl } from "../lib/use-object-url";
import type { CurrentWorkingState } from "../lib/workspace-state";

interface BrandingSectionProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
}

type DisplayedOption = "none" | "symbol" | "custom";

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

	async function handleFileSelected(file: File) {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const result = await validateImageContent(bytes);
		if (!result.ok) {
			setHasImageError(true);
			return;
		}
		setHasImageError(false);
		setPendingCustomSelected(false);
		onCurrentWorkingStateChange(applyBrandingImage(currentWorkingState, bytes));
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
}

interface OptionGroupProps {
	readonly legend: string;
	readonly testIdPrefix: string;
	readonly options: readonly OptionGroupOption[];
	readonly selected: string;
	readonly onSelect: (value: string) => void;
}

// docs/APPLICATION_LAYOUT.md "Branding": "Single-row option group" — no
// color chips, so this is the plain variant of
// PresentationSection.tsx's own `OptionGroup` (its Corners options use the
// identical plain shape).
function OptionGroup({
	legend,
	testIdPrefix,
	options,
	selected,
	onSelect,
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
					onClick={() => onSelect(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
