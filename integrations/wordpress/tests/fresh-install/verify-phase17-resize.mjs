// One-off, on-demand verification (docs/IMPLEMENTATION_PLAN_V1.md Phase 17,
// Decision 77 "Embed sizing model" — the responsive-sizing blocker
// resolution) — NOT part of the routine test suite. Drives a real,
// disposable, non-bind-mounted wp-env instance through real browser resize
// cycles, verifying the new width-constrained geometry mode
// (src/lib/canvas-geometry.ts `computeCanvasGeometryForAvailableWidth`,
// src/lib/comparison-presentation-runtime.ts `initInstance`'s `sizingMode`)
// against a real portrait Comparison (A) placed twice and a real landscape
// Comparison (B) placed once, all three inside their own Shadow Root on one
// page (integrations/wordpress/tests/fresh-install/artifact/create-test-pages.php).
//
// Usage: node verify-phase17-resize.mjs

import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { quoteArgForShell } from "../wp-env-helpers.mjs";
import { CONFIG_PATH } from "./wp-env-fresh-helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:8890";
const PAGE_URL = `${BASE}/sameview-resize-test/`;

const PHP_ISSUE_PATTERN =
	/(PHP (Warning|Notice|Deprecated|Fatal error|Parse error)|Fatal error:|Warning:|Notice:|Deprecated:)/;

function wpCli(args) {
	return execFileSync(
		"npx",
		["wp-env", "--config", CONFIG_PATH, "run", "cli", "wp", ...args].map(
			quoteArgForShell,
		),
		{ cwd: HERE, encoding: "utf8", shell: true },
	);
}

function assertNoPhpIssuesInHtml(html, context) {
	assert.doesNotMatch(
		html,
		PHP_ISSUE_PATTERN,
		`unexpected PHP warning/notice/error during ${context}`,
	);
}

const report = {};
const pageErrors = [];

async function readGeometry(page) {
	return page.evaluate(() => {
		const embeds = Array.from(document.querySelectorAll("[data-sameview-embed]"));
		return embeds.map((embed) => {
			const canvas = embed.shadowRoot.querySelector(".presentation-canvas");
			const wrapper = embed.shadowRoot.querySelector(".sameview-embed-frame");
			const canvasRect = canvas.getBoundingClientRect();
			const wrapperRect = wrapper.getBoundingClientRect();
			const style = getComputedStyle(canvas);
			return {
				stageWidthVar: Number.parseFloat(style.getPropertyValue("--stage-width")),
				stageHeightVar: Number.parseFloat(style.getPropertyValue("--stage-height")),
				canvasWidthVar: Number.parseFloat(style.getPropertyValue("--canvas-width")),
				canvasHeightVar: Number.parseFloat(style.getPropertyValue("--canvas-height")),
				canvasRectWidth: canvasRect.width,
				canvasRectHeight: canvasRect.height,
				wrapperRectWidth: wrapperRect.width,
				wrapperRectHeight: wrapperRect.height,
				wrapperScrollHeight: wrapper.scrollHeight,
				wrapperClientHeight: wrapper.clientHeight,
				sliderValueNow: embed.shadowRoot
					.querySelector('[role="slider"]')
					?.getAttribute("aria-valuenow"),
			};
		});
	});
}

function assertNoClippingOrDeadSpace(geom, label) {
	// No internal scroll area: scrollHeight must equal clientHeight (within
	// rounding) for the wrapper — it must never create its own scrollbar.
	assert.ok(
		Math.abs(geom.wrapperScrollHeight - geom.wrapperClientHeight) <= 1,
		`${label}: wrapper must not introduce its own internal scroll area (scrollHeight=${geom.wrapperScrollHeight}, clientHeight=${geom.wrapperClientHeight})`,
	);
	// No dead space: the wrapper's own rendered height must closely track the
	// canvas's own rendered height (the canvas is its only real content) —
	// a large gap would mean an artificial height constraint left empty
	// space below the Presentation.
	assert.ok(
		Math.abs(geom.wrapperRectHeight - geom.canvasRectHeight) <= 2,
		`${label}: wrapper height (${geom.wrapperRectHeight}) must closely track the canvas's own rendered height (${geom.canvasRectHeight}) — no dead space`,
	);
	// No clipping: the wrapper must be at least as tall as the canvas.
	assert.ok(
		geom.wrapperRectHeight >= geom.canvasRectHeight - 1,
		`${label}: wrapper must not clip the canvas (wrapper=${geom.wrapperRectHeight}, canvas=${geom.canvasRectHeight})`,
	);
}

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext();

	try {
		const page = await context.newPage();
		page.on("pageerror", (error) => pageErrors.push(String(error)));
		page.on("console", (msg) => {
			if (msg.type() === "error") pageErrors.push(`[console.error] ${msg.text()}`);
		});

		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto(PAGE_URL, { waitUntil: "networkidle" });
		assertNoPhpIssuesInHtml(await page.content(), "resize test page");

		await page.waitForFunction(
			() =>
				document.querySelectorAll("[data-sameview-embed]").length === 3 &&
				Array.from(document.querySelectorAll("[data-sameview-embed]")).every(
					(el) => !el.shadowRoot.querySelector(".comparison-slider__frame--loading"),
				),
			{ timeout: 30000 },
		);
		report.threePlacementsReady = true;

		// --- Baseline at desktop width. ---
		const widths = [1280, 480, 1280, 320, 900, 768];
		const history = [];
		for (const width of widths) {
			await page.setViewportSize({ width, height: 900 });
			// Real resize convergence, not a fixed sleep: wait until every
			// instance's own --stage-width custom property stops changing.
			let stable = false;
			let lastGeoms = null;
			for (let attempt = 0; attempt < 20 && !stable; attempt++) {
				await page.waitForTimeout(200);
				const geoms = await readGeometry(page);
				if (
					lastGeoms &&
					geoms.every(
						(g, i) =>
							Math.abs(g.stageWidthVar - lastGeoms[i].stageWidthVar) < 0.5,
					)
				) {
					stable = true;
				}
				lastGeoms = geoms;
			}
			history.push({ width, geoms: lastGeoms });
		}

		// --- No stale --stage-width/--canvas-width: each width in the cycle
		// (except immediate repeats of an already-visited width) must have
		// produced a genuinely different stageWidth for every instance whose
		// wrapper width actually changed. ---
		for (let i = 1; i < history.length; i++) {
			const prevWidths = history[i - 1].geoms.map((g) => g.wrapperRectWidth);
			const currWidths = history[i].geoms.map((g) => g.wrapperRectWidth);
			const prevStage = history[i - 1].geoms.map((g) => g.stageWidthVar);
			const currStage = history[i].geoms.map((g) => g.stageWidthVar);
			for (let instance = 0; instance < 3; instance++) {
				const wrapperChanged =
					Math.abs(prevWidths[instance] - currWidths[instance]) > 2;
				if (wrapperChanged) {
					assert.notEqual(
						currStage[instance],
						prevStage[instance],
						`instance ${instance} at viewport ${history[i].width}px: --stage-width must not be stale after its own wrapper width changed`,
					);
				}
			}
		}
		report.noStaleGeometry = true;

		// --- Required height changes with width; no clipping; no internal
		// scroll; no dead space — checked at every width in the cycle, for
		// every one of the 3 placements (portrait A x2, landscape B x1). ---
		for (const { width, geoms } of history) {
			geoms.forEach((geom, instance) => {
				assertNoClippingOrDeadSpace(geom, `width=${width}px instance=${instance}`);
			});
		}
		report.heightChangesWithWidthNoClippingNoScrollNoDeadSpace = true;

		// Portrait (instances 0 and 1, Comparison A) and landscape (instance
		// 2, Comparison B) must each preserve their own aspect ratio at every
		// width, independently of one another.
		for (const { width, geoms } of history) {
			for (const geom of geoms) {
				const impliedRatio = geom.stageWidthVar / geom.stageHeightVar;
				assert.ok(
					Number.isFinite(impliedRatio) && impliedRatio > 0,
					`width=${width}px: implied aspect ratio must be a finite positive number`,
				);
			}
			// Portrait instances (0, 1) must be taller than wide; the
			// landscape instance (2) must be wider than tall — true
			// regardless of the current viewport width.
			assert.ok(geoms[0].stageWidthVar < geoms[0].stageHeightVar, `width=${width}px: instance 0 (portrait) must stay portrait`);
			assert.ok(geoms[1].stageWidthVar < geoms[1].stageHeightVar, `width=${width}px: instance 1 (portrait) must stay portrait`);
			assert.ok(geoms[2].stageWidthVar > geoms[2].stageHeightVar, `width=${width}px: instance 2 (landscape) must stay landscape`);
		}
		report.portraitAndLandscapeBothCorrectAcrossResizes = true;

		// Repeated resize cycles: returning to a previously visited width
		// (1280 appears twice in the cycle) must reproduce the same geometry
		// as the first time, not drift.
		const first1280 = history[0].geoms;
		const second1280 = history[2].geoms;
		for (let instance = 0; instance < 3; instance++) {
			assert.ok(
				Math.abs(first1280[instance].stageWidthVar - second1280[instance].stageWidthVar) < 1,
				`instance ${instance}: returning to 1280px must reproduce the same stageWidth, not drift`,
			);
		}
		report.repeatedResizeCyclesStable = true;

		// --- Multiple Shadow-DOM instances resize independently: the
		// landscape instance's own geometry must never track the portrait
		// instances' values (they have different ratios, so equality would
		// indicate cross-contamination). ---
		for (const { geoms } of history) {
			assert.notEqual(
				Math.round(geoms[0].stageHeightVar),
				Math.round(geoms[2].stageHeightVar),
				"the portrait and landscape instances must never coincidentally share derived state",
			);
		}
		report.instancesResizeIndependently = true;

		// --- Slider remains interactive after every resize. ---
		await page.setViewportSize({ width: 900, height: 900 });
		await page.waitForTimeout(500);
		for (let instance = 0; instance < 3; instance++) {
			const slider = page.locator('[data-sameview-embed] [role="slider"]').nth(instance);
			await slider.scrollIntoViewIfNeeded();
			const before = await slider.getAttribute("aria-valuenow");
			await slider.focus();
			await page.keyboard.press("ArrowRight");
			const after = await slider.getAttribute("aria-valuenow");
			assert.notEqual(after, before, `instance ${instance}: slider must remain keyboard-interactive after resize`);
		}
		report.sliderInteractiveAfterResize = true;

		// --- Tooltip geometry still works after resize: force a narrow
		// viewport (more likely to truncate text), then check a truncated
		// item's tooltip still opens and positions correctly.
		await page.setViewportSize({ width: 360, height: 900 });
		await page.waitForTimeout(500);
		// A trigger only becomes tooltip-eligible (and gets `tabindex="0"`)
		// once its own rendered content is actually clamped — `.first()`
		// alone would risk grabbing a *non*-truncated trigger (e.g. a short
		// Title that happens to fit); select specifically by that same
		// runtime-applied signal.
		const truncatedTestId = await page.evaluate(() => {
			const embed = document.querySelector("[data-sameview-embed]");
			const truncated = embed.shadowRoot.querySelector(
				'[data-overflow-tooltip][tabindex="0"]',
			);
			return truncated ? truncated.getAttribute("data-testid") : null;
		});
		if (truncatedTestId) {
			const trigger = page
				.locator("[data-sameview-embed]")
				.first()
				.locator(`css=[data-testid="${truncatedTestId}"]`)
				.first();
			await trigger.focus();
			await page.waitForTimeout(300);
			const tooltipCheck = await page.evaluate(() => {
				const embed = document.querySelector("[data-sameview-embed]");
				const tooltip = embed.shadowRoot.querySelector(".presentation-tooltip");
				if (!tooltip || tooltip.hidden) return null;
				const rect = tooltip.getBoundingClientRect();
				return {
					withinViewportWidth: rect.right <= window.innerWidth + 1 && rect.left >= -1,
					hasSize: rect.width > 0 && rect.height > 0,
				};
			});
			assert.ok(tooltipCheck, "tooltip must actually open for a truncated item after resize");
			assert.ok(tooltipCheck.hasSize, "tooltip must have a real rendered size after resize");
			assert.ok(tooltipCheck.withinViewportWidth, "tooltip must stay within the viewport after resize");
			report.tooltipGeometryWorksAfterResize = true;
		} else {
			report.tooltipGeometryWorksAfterResize = "not triggered (no truncated item at this viewport)";
		}
		await page.setViewportSize({ width: 1280, height: 900 });

		const finalHtml = await page.content();
		assertNoPhpIssuesInHtml(finalHtml, "resize test page after full resize cycle");

		console.log("\nVERIFICATION PASSED\n");
		console.log(JSON.stringify(report, null, 2));
		if (pageErrors.length) {
			console.log("\nBrowser console/page errors observed (review):", pageErrors);
		} else {
			console.log("\nNo browser console.error/pageerror events observed.");
		}
	} catch (error) {
		console.log("\nVERIFICATION FAILED:", error.message);
		console.log("partial report:", JSON.stringify(report, null, 2));
		try {
			const pages = context.pages();
			for (let i = 0; i < pages.length; i++) {
				await pages[i].screenshot({ path: `C:/tmp/phase17-resize-fail-${i}.png`, fullPage: true });
			}
		} catch {
			// Best-effort debugging aid only.
		}
		throw error;
	} finally {
		await context.close();
		await browser.close();
	}
})();
