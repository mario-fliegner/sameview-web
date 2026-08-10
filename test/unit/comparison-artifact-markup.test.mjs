// Coverage for src/lib/comparison-artifact-markup.ts — the single shared
// Comparison Presentation markup builder consumed unchanged by
// src/lib/generate-standalone-html.ts and src/lib/generate-static-microsite.ts.
// Verifies escaping, static visibility gating (mirrors React's own
// conditional rendering) and that identical input always produces
// identical markup regardless of which output type will go on to package
// it — the actual guarantee behind "one shared scaffold, never two
// independent implementations".

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildComparisonArtifactMarkup } from "../../src/lib/comparison-artifact-markup.ts";
import { DEFAULT_PRESENTATION_CONFIGURATION } from "../../src/lib/workspace-state.ts";

const BASE_PRESENTATION = {
	title: "White wall portrait",
	description: "A description with <script>alert(1)</script>",
	referenceLabel: "May 2019",
	captureLabel: "June 12, 2023",
	durationLabel: "4 years",
	location: { displayName: "Marienplatz", city: "Munich", country: "Germany" },
	sliderLabels: { left: "2019", right: "2023" },
};

const FULL_VISIBILITY = {
	title: true,
	description: true,
	time: true,
	timeDifference: true,
	location: true,
};

const ASSETS = {
	referenceSrc: "images/reference.jpg",
	captureSrc: "images/capture.jpg",
	brandingSrc: undefined,
};

const COPY = {
	referenceAlt: "Reference photo",
	captureAlt: "New photo",
	sliderLabel: "Comparison position",
	loadingLabel: "Loading comparison…",
};

function build(overrides = {}) {
	return buildComparisonArtifactMarkup({
		presentation: BASE_PRESENTATION,
		visibility: FULL_VISIBILITY,
		configuration: DEFAULT_PRESENTATION_CONFIGURATION,
		branding: { kind: "none" },
		assets: ASSETS,
		copy: COPY,
		presentationFontFamily: '"Inter Variable", sans-serif',
		initialSliderPosition: 0.5,
		...overrides,
	});
}

describe("buildComparisonArtifactMarkup", () => {
	test("escapes user text so it can never execute as markup", () => {
		const markup = build();
		assert.ok(!markup.includes("<script>alert(1)</script>"));
		assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	});

	test("renders exactly one instance of every fixed id the runtime relies on", () => {
		const markup = build();
		for (const id of [
			"sameview-canvas",
			"sameview-slider-frame",
			"sameview-capture-image",
			"sameview-reference-image",
			"sameview-divider-line",
			"sameview-handle",
			"sameview-label-left",
			"sameview-label-right",
			"sameview-loading",
			"sameview-info-wrapper",
			"sameview-presentation-info",
		]) {
			const matches = markup.match(new RegExp(`id="${id}"`, "g")) ?? [];
			assert.equal(matches.length, 1, `expected exactly one #${id}`);
		}
	});

	test("a hidden item renders no element at all (mirrors React's conditional rendering)", () => {
		const markup = build({
			visibility: { ...FULL_VISIBILITY, description: false },
		});
		assert.ok(!markup.includes("sameview-description"));
	});

	test("Show Time Difference off omits the duration even though Show Time stays on", () => {
		const markup = build({
			visibility: { ...FULL_VISIBILITY, timeDifference: false },
		});
		assert.ok(!markup.includes("4 years"));
		assert.ok(markup.includes("comparison-time"));
	});

	test("only the selected output's own asset references appear, nothing else's", () => {
		const standaloneLike = build({
			assets: {
				referenceSrc: "data:image/jpeg;base64,AAA=",
				captureSrc: "data:image/jpeg;base64,BBB=",
				brandingSrc: undefined,
			},
		});
		assert.ok(standaloneLike.includes("data:image/jpeg;base64,AAA="));
		assert.ok(!standaloneLike.includes("images/reference.jpg"));

		const micrositeLike = build();
		assert.ok(micrositeLike.includes("images/reference.jpg"));
		assert.ok(!micrositeLike.includes("data:"));
	});

	test("identical input produces byte-identical markup (deterministic, no hidden randomness/timestamps)", () => {
		assert.equal(build(), build());
	});

	test("the initial slider position is reflected in the reference image's clip-path and the handle position", () => {
		const markup = build({ initialSliderPosition: 0.25 });
		assert.match(markup, /clip-path: inset\(0 75% 0 0\)/);
		assert.match(markup, /inset-inline-start: 25%/);
	});
});
