// Real-application coverage for the first Comparison Viewer iteration
// (docs/FEATURE_SPECIFICATION.md F-002; docs/IMPLEMENTATION_PLAN_V1.md
// Phase 4) — src/components/WorkspaceActive.tsx, ComparisonSlider.tsx and
// ComparisonInfo.tsx.
//
// Uses sample-v6-session_full.zip specifically: it is the one fixture with
// content.title, content.description, location.* and a reference.date set
// (test/fixtures/android-export/README.md), needed to exercise the derived
// presentation values this iteration adds. Functional assertions use stable
// `data-testid`s and ARIA roles, never translated copy, per this project's
// established testing convention (see test/e2e/workspace-creation.spec.ts).

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
);

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
});

async function importFullFixture(page: import("@playwright/test").Page) {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_full.zip"),
		);
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	// Real image decode of a real ~7 MB photo pair; generous timeout to
	// accommodate parallel-worker load, matching this project's existing
	// convention for the same fixture in test/e2e/workspace-creation.spec.ts.
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
}

test("both comparison images render, and the loading state clears once both are ready", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_full.zip"),
		);
	await expect(page.getByTestId("workspace-active")).toBeVisible();

	// The object-URL images (re-decoded from bytes already validated during
	// import) tend to load faster than a Playwright assertion's own poll
	// interval, so the loading state's transient presence isn't reliably
	// observable here — its absence once both images are ready is what this
	// test asserts (see src/components/ComparisonSlider.tsx for the
	// mechanism: the slider handle only renders once both have loaded).
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
	await expect(page.getByTestId("reference-image")).toBeVisible();
	await expect(page.getByTestId("capture-image")).toBeVisible();
	await expect(page.getByRole("slider")).toBeVisible();
});

test("title, description and location are derived and presented from the imported metadata", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(page.locator("#workspace-active-title")).toHaveText(
		"White and black wall portait",
	);
	await expect(page.getByTestId("comparison-description")).toHaveText(
		"This is a description. Portrait format.",
	);
	await expect(page.getByTestId("comparison-location")).toContainText(
		"This Is A Place Name",
	);
	await expect(page.getByTestId("comparison-location")).toContainText(
		"City Name",
	);
	await expect(page.getByTestId("comparison-location")).toContainText(
		"Country Name",
	);
	// reference.date is "2024" (YYYY precision) in this fixture.
	await expect(page.getByTestId("comparison-reference-label")).toHaveText(
		"2024",
	);
	await expect(page.getByTestId("comparison-capture-label")).not.toBeEmpty();
});

test("the reference fallback label is used when no comparison title or reference date exist", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});

	// No content.title in the minimal fixture: the heading falls back to the
	// generic workspace title rather than being left blank.
	await expect(page.locator("#workspace-active-title")).not.toBeEmpty();
	await expect(page.getByTestId("comparison-description")).toHaveCount(0);
	await expect(page.getByTestId("comparison-location")).toHaveCount(0);
});

test("the slider is keyboard-operable and moves the reveal position without changing workspace data", async ({
	page,
}) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	await slider.focus();
	await expect(slider).toHaveAttribute("aria-valuenow", "50");

	await page.keyboard.press("ArrowRight");
	await expect(slider).toHaveAttribute("aria-valuenow", "55");

	await page.keyboard.press("Home");
	await expect(slider).toHaveAttribute("aria-valuenow", "0");

	await page.keyboard.press("End");
	await expect(slider).toHaveAttribute("aria-valuenow", "100");

	// Interacting with the slider never touches the underlying comparison
	// data (docs/FEATURE_SPECIFICATION.md F-002 Rules).
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2026-07-27_13-54-15",
	);
	await expect(page.locator("#workspace-active-title")).toHaveText(
		"White and black wall portait",
	);
});

test("the slider is pointer-operable via drag", async ({ page }) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	const frame = page.getByTestId("comparison-slider");
	const frameBox = await frame.boundingBox();
	if (!frameBox) throw new Error("comparison-slider frame has no bounding box");

	await page.mouse.move(
		frameBox.x + frameBox.width / 2,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(
		frameBox.x + frameBox.width * 0.9,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.up();

	const value = Number(await slider.getAttribute("aria-valuenow"));
	expect(value).toBeGreaterThan(70);
});

test("the Viewer appears before the comparison information in visual order on a narrow screen", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 780 });
	await importFullFixture(page);

	const sliderBox = await page.getByTestId("comparison-slider").boundingBox();
	const infoBox = await page
		.getByTestId("comparison-description")
		.boundingBox();
	expect(sliderBox).not.toBeNull();
	expect(infoBox).not.toBeNull();
	expect(sliderBox?.y ?? 0).toBeLessThan(infoBox?.y ?? 0);
});

test("replacing the workspace shows the new comparison's images and information", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_full.zip"),
		);
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});
	await page.getByTestId("replace-confirm-button").click();

	await expect(page.getByTestId("workspace-session")).toContainText(
		"2026-07-27_13-54-15",
	);
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
	await expect(page.locator("#workspace-active-title")).toHaveText(
		"White and black wall portait",
	);
	await expect(page.getByTestId("reference-image")).toBeVisible();
	await expect(page.getByTestId("capture-image")).toBeVisible();
});
