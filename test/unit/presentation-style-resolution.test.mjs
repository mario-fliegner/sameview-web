// Coverage for src/lib/presentation-style-resolution.ts — the single shared
// Canvas Background/Frame/Text resolution source for
// src/components/WorkspaceActive.tsx's live Preview and the generated
// Standalone HTML/Static Microsite (src/lib/comparison-artifact-markup.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BRAND_ACCENT_COLOR,
	DARK_TEXT_COLOR,
	FRAME_WIDTH_PX,
	LIGHT_TEXT_COLOR,
	relativeLuminance,
	resolveCanvasBackground,
	resolveFrame,
	resolveTextColor,
} from "../../src/lib/presentation-style-resolution.ts";

describe("resolveCanvasBackground", () => {
	test("resolves each named option to its concrete color", () => {
		assert.equal(
			resolveCanvasBackground({ kind: "transparent" }),
			"transparent",
		);
		assert.equal(resolveCanvasBackground({ kind: "white" }), "#FFFFFF");
		assert.equal(resolveCanvasBackground({ kind: "black" }), "#000000");
		assert.equal(
			resolveCanvasBackground({ kind: "brand" }),
			BRAND_ACCENT_COLOR,
		);
	});

	test("Custom passes its own stored color through unchanged", () => {
		assert.equal(
			resolveCanvasBackground({ kind: "custom", color: "#123456" }),
			"#123456",
		);
	});
});

describe("resolveFrame", () => {
	test("None has zero width and a transparent color", () => {
		assert.deepEqual(resolveFrame({ kind: "none" }), {
			color: "transparent",
			widthPx: 0,
		});
	});

	test("White/Black/Custom all use the same fixed rendering width", () => {
		assert.equal(resolveFrame({ kind: "white" }).widthPx, FRAME_WIDTH_PX);
		assert.equal(resolveFrame({ kind: "black" }).widthPx, FRAME_WIDTH_PX);
		assert.equal(
			resolveFrame({ kind: "custom", color: "#abcdef" }).widthPx,
			FRAME_WIDTH_PX,
		);
		assert.equal(
			resolveFrame({ kind: "custom", color: "#abcdef" }).color,
			"#abcdef",
		);
	});
});

describe("relativeLuminance", () => {
	test("white is maximal, black is zero", () => {
		assert.ok(Math.abs(relativeLuminance("#FFFFFF") - 1) < 1e-9);
		assert.equal(relativeLuminance("#000000"), 0);
	});
});

describe("resolveTextColor", () => {
	test("Light/Dark/Custom resolve directly, independent of the background", () => {
		assert.equal(
			resolveTextColor({ kind: "light" }, "#000000"),
			LIGHT_TEXT_COLOR,
		);
		assert.equal(
			resolveTextColor({ kind: "dark" }, "#FFFFFF"),
			DARK_TEXT_COLOR,
		);
		assert.equal(
			resolveTextColor({ kind: "custom", color: "#ff00ff" }, "#000000"),
			"#ff00ff",
		);
	});

	test("Automatic picks dark text over a light background", () => {
		assert.equal(
			resolveTextColor({ kind: "automatic" }, "#FFFFFF"),
			DARK_TEXT_COLOR,
		);
	});

	test("Automatic picks light text over a dark background", () => {
		assert.equal(
			resolveTextColor({ kind: "automatic" }, "#000000"),
			LIGHT_TEXT_COLOR,
		);
	});

	test("Automatic treats a transparent background as dark (light text)", () => {
		assert.equal(
			resolveTextColor({ kind: "automatic" }, "transparent"),
			LIGHT_TEXT_COLOR,
		);
	});
});
