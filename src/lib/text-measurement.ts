// Canvas 2D `measureText()`-based text-width measurement — independent of
// DOM layout, so it never forces a layout read the way measuring a
// rendered element's own box would. Mirrors the technique already
// established in src/components/ComparisonSlider.tsx's `measureLabelWidth`
// (used there for the on-image slider labels), kept as its own module
// rather than extracted from that component, to avoid touching
// already-working, unrelated code for this feature.

let measurementCanvas: HTMLCanvasElement | null = null;

function getMeasurementContext(font: string): CanvasRenderingContext2D | null {
	if (typeof document === "undefined") return null;
	measurementCanvas ??= document.createElement("canvas");
	const context = measurementCanvas.getContext("2d");
	if (!context) return null;
	context.font = font;
	return context;
}

// Splits on whitespace runs — words only, matching this app's plain-text
// rendering (docs/COMPARISON_PRESENTATION.md "General Rules": "Rich text is
// not supported").
export function measureWordWidths(
	text: string,
	font: string,
): readonly number[] {
	const context = getMeasurementContext(font);
	if (!context) return [];
	return text
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.map((word) => context.measureText(word).width);
}

export function measureSpaceWidth(font: string): number {
	const context = getMeasurementContext(font);
	return context ? context.measureText(" ").width : 0;
}
