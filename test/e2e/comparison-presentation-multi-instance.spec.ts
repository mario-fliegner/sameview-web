// Real-browser coverage for docs/IMPLEMENTATION_PLAN_V1.md Phase 13 ("Shared
// Runtime Multiple-Instance Safety") — proves that
// src/lib/comparison-presentation-runtime.ts genuinely supports more than
// one simultaneous `.presentation-canvas` instance in one host document, per
// docs/COMPARISON_PRESENTATION.md "Multiple Instances and Host Isolation":
// independent interaction/tooltip/geometry state, no colliding identifiers,
// safe repeated initialization. Uses the real, exported `multi-instance`
// markup mode (src/lib/comparison-artifact-markup.ts) directly — the same
// API any real future caller (e.g. a later WordPress placement) would have
// to use — never a test-only markup convention.
//
// This file does not touch Standalone HTML/Static Microsite generation:
// their own single-instance regression coverage remains
// test/e2e/output-generation.spec.ts, run unmodified (aside from the two
// runtime-dependent byte-hash constants) alongside this one.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { buildComparisonArtifactMarkup } from "../../src/lib/comparison-artifact-markup.ts";
import { DEFAULT_PRESENTATION_CONFIGURATION } from "../../src/lib/workspace-state.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The same shared stylesheet the live Preview and every generated output
// already use (`?raw`-imported by generate-standalone-html.ts/
// generate-static-microsite.ts) — read directly here rather than through
// Vite, since this file assembles its own bespoke multi-instance test page
// rather than going through either generator. Deliberately not
// comparison-artifact-frame.css: that stylesheet's `position: fixed`
// full-viewport rules are single-instance-only (docs/APPLICATION_LAYOUT.md
// "Standalone HTML"/"Static Microsite") and would make two independently
// sized instances impossible to place side by side.
const presentationCssRaw = readFileSync(
	join(repoRoot, "src", "styles", "comparison-presentation.css"),
	"utf8",
);

// A minimal, always-valid decodable image — an inline SVG data URI rather
// than a hand-encoded JPEG, so `naturalWidth`/`naturalHeight` become
// reliably non-zero and the `load` event reliably fires, with zero risk of
// an accidentally-corrupt hand-rolled base64 payload.
const TEST_IMAGE_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#808080"/></svg>',
)}`;

const COPY = {
	referenceAlt: "Reference photo",
	captureAlt: "New photo",
	sliderLabel: "Comparison position",
	loadingLabel: "Loading comparison…",
};

interface InstanceSpec {
	readonly title: string;
	readonly initialSliderPosition: number;
}

// docs/EMBED_IN_WEBSITE.md "Independent Instance State": each rendered
// instance is deliberately given its own distinct title (long enough to be
// genuinely truncated at the fixed test width below, so its own Overflow
// Tooltip becomes available) and its own distinct initial slider position —
// both are what make cross-instance leakage observable at all; identical
// instances could pass every assertion below by coincidence even if state
// were actually shared.
const INSTANCE_A: InstanceSpec = {
	title:
		"Instance A carries a genuinely long title that cannot fit the available width and must be truncated",
	initialSliderPosition: 0.25,
};
const INSTANCE_B: InstanceSpec = {
	title:
		"Instance B carries an entirely different, equally long title that is truncated on its own",
	initialSliderPosition: 0.75,
};

function buildInstanceMarkup(spec: InstanceSpec): string {
	return buildComparisonArtifactMarkup({
		presentation: {
			title: spec.title,
			description: undefined,
			referenceLabel: "2019",
			captureLabel: "2023",
			durationLabel: undefined,
			location: undefined,
			sliderLabels: { left: "2019", right: "2023" },
		},
		visibility: {
			title: true,
			description: false,
			time: false,
			timeDifference: false,
			location: false,
		},
		configuration: DEFAULT_PRESENTATION_CONFIGURATION,
		branding: { kind: "none" },
		assets: {
			referenceSrc: TEST_IMAGE_DATA_URL,
			captureSrc: TEST_IMAGE_DATA_URL,
			brandingSrc: undefined,
		},
		copy: COPY,
		presentationFontFamily: "sans-serif",
		initialSliderPosition: spec.initialSliderPosition,
		instanceMode: { kind: "multi-instance" },
	});
}

// Each instance gets its own fixed-size wrapper `<div>` — exactly the role
// src/lib/comparison-presentation-runtime.ts's `requireInstanceFrame`
// documents (the Presentation Canvas's own immediate parent is its
// available-space frame), mirroring what
// src/lib/comparison-artifact-scaffold.ts's `<main id="sameview-output-frame">`
// already provides for the single-instance case.
function buildTestPage(
	specs: readonly InstanceSpec[],
	runtimeScriptTags: readonly string[],
): string {
	const instances = specs
		.map(
			(spec, index) =>
				`<div style="width: 280px; height: 280px;" data-test-instance="${index}">${buildInstanceMarkup(spec)}</div>`,
		)
		.join("\n");
	const scripts = runtimeScriptTags
		.map((script) => `<script>${script}</script>`)
		.join("\n");
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${presentationCssRaw}</style>
</head>
<body>
${instances}
${scripts}
</body>
</html>`;
}

function readyCanvases(page: import("@playwright/test").Page) {
	return page.locator(".presentation-canvas.presentation-canvas--ready");
}

test.describe("Comparison Presentation runtime: multiple instances in one document", () => {
	test("two instances coexist, both discovered and initialized, no colliding identifiers, each starting at its own initial slider position", async ({
		page,
		request,
	}) => {
		const runtimeScript = await (
			await request.get("/generated/comparison-presentation-runtime.js")
		).text();
		await page.setContent(
			buildTestPage([INSTANCE_A, INSTANCE_B], [runtimeScript]),
		);

		// Runtime discovery: both roots reach the ready state.
		await expect(readyCanvases(page)).toHaveCount(2);

		// docs/COMPARISON_PRESENTATION.md "Multiple Instances and Host
		// Isolation": "No instance's identifiers ... collide with another's" —
		// verified at the strongest level multi-instance mode provides: no
		// element inside either instance carries an `id` attribute at all.
		const idsInsideInstances = await page.evaluate(() => {
			const canvases = document.querySelectorAll(".presentation-canvas");
			return Array.from(canvases).flatMap((canvas) =>
				Array.from(canvas.querySelectorAll("[id]")).map((el) => el.id),
			);
		});
		expect(idsInsideInstances).toEqual([]);

		// Each instance starts at its own configured initial slider position —
		// never the other's, and never the 50/50 default.
		const sliders = page.getByRole("slider");
		await expect(sliders).toHaveCount(2);
		await expect(sliders.nth(0)).toHaveAttribute("aria-valuenow", "25");
		await expect(sliders.nth(1)).toHaveAttribute("aria-valuenow", "75");
	});

	test("pointer interaction with instance A never alters instance B's slider position", async ({
		page,
		request,
	}) => {
		const runtimeScript = await (
			await request.get("/generated/comparison-presentation-runtime.js")
		).text();
		await page.setContent(
			buildTestPage([INSTANCE_A, INSTANCE_B], [runtimeScript]),
		);
		await expect(readyCanvases(page)).toHaveCount(2);

		const sliders = page.getByRole("slider");
		const frameA = page
			.locator('[data-test-instance="0"] .comparison-slider__frame')
			.first();
		const box = await frameA.boundingBox();
		if (!box) throw new Error("instance A's slider frame has no bounding box");

		await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5);
		await page.mouse.up();

		const valueA = await sliders.nth(0).getAttribute("aria-valuenow");
		expect(Number(valueA)).toBeGreaterThan(25);
		// Instance B's own position, set independently at generation time,
		// must be completely unaffected by dragging instance A.
		await expect(sliders.nth(1)).toHaveAttribute("aria-valuenow", "75");
	});

	test("keyboard interaction with instance A never alters instance B's slider position", async ({
		page,
		request,
	}) => {
		const runtimeScript = await (
			await request.get("/generated/comparison-presentation-runtime.js")
		).text();
		await page.setContent(
			buildTestPage([INSTANCE_A, INSTANCE_B], [runtimeScript]),
		);
		await expect(readyCanvases(page)).toHaveCount(2);

		const sliders = page.getByRole("slider");
		await sliders.nth(0).focus();
		// SLIDER_KEYBOARD_STEP (src/lib/comparison-slider-interaction.ts) is 5
		// per press: 25 + 5*5 = 50.
		for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");

		await expect(sliders.nth(0)).toHaveAttribute("aria-valuenow", "50");
		await expect(sliders.nth(1)).toHaveAttribute("aria-valuenow", "75");
	});

	test("resizing instance A's own available-space frame updates its geometry independently of instance B", async ({
		page,
		request,
	}) => {
		const runtimeScript = await (
			await request.get("/generated/comparison-presentation-runtime.js")
		).text();
		await page.setContent(
			buildTestPage([INSTANCE_A, INSTANCE_B], [runtimeScript]),
		);
		await expect(readyCanvases(page)).toHaveCount(2);

		const canvasA = page.locator(
			'[data-test-instance="0"] .presentation-canvas',
		);
		const canvasB = page.locator(
			'[data-test-instance="1"] .presentation-canvas',
		);
		const widthBeforeA = (await canvasA.boundingBox())?.width ?? 0;
		const widthBeforeB = (await canvasB.boundingBox())?.width ?? 0;

		// Resizes only instance A's own frame — its ResizeObserver (declared
		// inside src/lib/comparison-presentation-runtime.ts's own per-instance
		// closure) must react; instance B's frame, and therefore its own
		// ResizeObserver, never fires.
		await page.locator('[data-test-instance="0"]').evaluate((element) => {
			(element as HTMLElement).style.width = "160px";
			(element as HTMLElement).style.height = "160px";
		});

		await expect
			.poll(async () => (await canvasA.boundingBox())?.width ?? 0)
			.toBeLessThan(widthBeforeA);
		const widthAfterB = (await canvasB.boundingBox())?.width ?? 0;
		expect(widthAfterB).toBeCloseTo(widthBeforeB, 0);
	});

	test("overflow-tooltip content and visibility stay independent between instances, using only the existing production markup", async ({
		page,
		request,
	}) => {
		const runtimeScript = await (
			await request.get("/generated/comparison-presentation-runtime.js")
		).text();
		await page.setContent(
			buildTestPage([INSTANCE_A, INSTANCE_B], [runtimeScript]),
		);
		await expect(readyCanvases(page)).toHaveCount(2);

		const titleA = page
			.locator('[data-test-instance="0"] .presentation-info__title')
			.first();
		const titleB = page
			.locator('[data-test-instance="1"] .presentation-info__title')
			.first();
		// Each instance's own `attachPresentationOverflowTooltips` call
		// (src/lib/overflow-tooltip.ts) keeps its own tooltip `<div>` in the
		// DOM permanently once first opened, only toggling its `hidden`
		// attribute — closing never clears its last text content. The
		// functional requirement is independent *visibility*, not mere
		// absence: exactly one tooltip is ever visible at a time, and its
		// content always matches whichever instance is currently open.
		const visibleTooltip = page.locator(".presentation-tooltip:not([hidden])");

		await titleA.focus();
		await expect(visibleTooltip).toHaveCount(1);
		await expect(visibleTooltip).toHaveText(INSTANCE_A.title);

		await titleB.focus();
		await expect(visibleTooltip).toHaveCount(1);
		await expect(visibleTooltip).toHaveText(INSTANCE_B.title);
	});

	test("including the compiled runtime script twice on the same page initializes each root only once, with no errors and no doubled drag response", async ({
		page,
		request,
	}) => {
		const runtimeScript = await (
			await request.get("/generated/comparison-presentation-runtime.js")
		).text();
		const pageErrors: Error[] = [];
		page.on("pageerror", (error) => pageErrors.push(error));

		await page.setContent(
			buildTestPage([INSTANCE_A, INSTANCE_B], [runtimeScript, runtimeScript]),
		);
		await expect(readyCanvases(page)).toHaveCount(2);

		const sliders = page.getByRole("slider");
		await sliders.nth(0).focus();
		await page.keyboard.press("ArrowRight");
		// A single ArrowRight press moves by exactly one
		// SLIDER_KEYBOARD_STEP (src/lib/comparison-slider-interaction.ts,
		// currently 5): 25 + 5 = 30. A doubled listener attachment from the
		// second, redundant script inclusion would move it by two steps
		// instead (35).
		await expect(sliders.nth(0)).toHaveAttribute("aria-valuenow", "30");

		expect(pageErrors).toEqual([]);
	});
});
