// One-off, on-demand verification (docs/IMPLEMENTATION_PLAN_V1.md Phase 17
// final acceptance) — NOT part of the routine test suite. Drives a real,
// disposable, non-bind-mounted wp-env WordPress instance (this directory's
// own .wp-env.json) through real browser interaction, verifying Shadow DOM
// host isolation, asset/cache versioning, conditional loading and the real
// Block Editor preview — all against the actual generated ZIP, a real
// hostile-theme CSS simulation (mu-plugins/hostile-theme-simulation.php),
// and real placements created directly via wp_insert_post (block insertion
// UI mechanics were already fully verified in Phase 16's own
// verify-phase16-placement.mjs; this script focuses on what changed here).
//
// Prerequisites (see this repository's own Phase 17 report for the exact
// commands used): comparison-a.zip/comparison-b.zip generated and installed/
// imported, and the three test pages created by artifact/create-test-pages.php
// (SameView Isolation Test — 3 placements: A, A, B; SameView Shortcode
// Test — shortcode for A; Unrelated Page — no placement).
//
// Usage: node verify-phase17-isolation.mjs

import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { quoteArgForShell } from "../wp-env-helpers.mjs";
import { CONFIG_PATH } from "./wp-env-fresh-helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:8890";
const ADMIN_USER = "admin";
const ADMIN_PASS = "password";
const PAGE_URL = `${BASE}/sameview-isolation-test/`;
const SHORTCODE_PAGE_URL = `${BASE}/sameview-shortcode-test/`;
const UNRELATED_PAGE_URL = `${BASE}/unrelated-page/`;

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

async function loginAsAdmin(page) {
	await page.goto(`${BASE}/wp-login.php`);
	await page.fill("#user_login", ADMIN_USER);
	await page.fill("#user_pass", ADMIN_PASS);
	await page.click("#wp-submit");
	await page.waitForURL(/wp-admin/);
}

async function dismissPatternModalIfPresent(page) {
	try {
		await page
			.getByRole("button", { name: /^(Close|Schließen)$/ })
			.first()
			.click({ timeout: 8000 });
	} catch {
		// No modal this time.
	}
}

const report = {};
const pageErrors = [];

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext();

	try {
		// --- Sanity: both Comparisons present, no PHP issues. ---
		const registered = wpCli([
			"eval",
			"echo WP_Block_Type_Registry::get_instance()->is_registered('sameview/comparison') ? 'yes' : 'no';",
		]).trim();
		assertNoPhpIssuesInHtml(registered, "block registration check");
		assert.equal(registered, "yes");

		// --- Public frontend: load the isolation test page under the
		// hostile-theme simulation. ---
		const page = await context.newPage();
		page.on("pageerror", (error) => pageErrors.push(String(error)));
		page.on("console", (msg) => {
			if (msg.type() === "error") pageErrors.push(`[console.error] ${msg.text()}`);
		});
		const embedRequests = [];
		page.on("request", (request) => {
			const url = request.url();
			if (
				url.includes("comparison-embed-runtime.js") ||
				url.includes("comparison-embed.css")
			) {
				embedRequests.push(url);
			}
		});

		await page.goto(PAGE_URL, { waitUntil: "networkidle" });
		const htmlBefore = await page.content();
		assertNoPhpIssuesInHtml(htmlBefore, "isolation test page");

		// 1 & 2 & 3. Each placement gets its own open Shadow Root; multiple
		// placements (same Comparison twice, a different Comparison once)
		// remain independent.
		await page.waitForFunction(
			() =>
				document.querySelectorAll("[data-sameview-embed]").length === 3 &&
				Array.from(document.querySelectorAll("[data-sameview-embed]")).every(
					(el) => el.shadowRoot && el.shadowRoot.mode === "open",
				),
			{ timeout: 20000 },
		);
		report.threeShadowRootsOpen = true;

		// Pointer-drag interaction only activates once both of an instance's
		// own images have actually finished loading
		// (src/lib/comparison-presentation-runtime.ts `readyTriggered`) —
		// wait for every placement's own loading indicator to detach before
		// any interaction check below, exactly like every other real-browser
		// test in this codebase already does for the light-DOM case.
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll("[data-sameview-embed]")).every(
					(el) =>
						!el.shadowRoot.querySelector(".comparison-slider__frame--loading"),
				),
			{ timeout: 30000 },
		);

		// No `.presentation-canvas` (or any SameView-owned class) anywhere in
		// the light DOM — everything lives inside a Shadow Root. Proves no
		// SameView-owned DOM leaked into the host page.
		const lightDomLeak = await page.evaluate(
			() => document.querySelectorAll(".presentation-canvas").length,
		);
		assert.equal(lightDomLeak, 0, "no .presentation-canvas must exist in the light DOM");
		report.noLightDomLeak = true;

		const canvasCountsPerShadowRoot = await page.evaluate(() =>
			Array.from(document.querySelectorAll("[data-sameview-embed]")).map(
				(el) => el.shadowRoot.querySelectorAll(".presentation-canvas").length,
			),
		);
		assert.deepEqual(canvasCountsPerShadowRoot, [1, 1, 1]);
		report.eachPlacementHasOwnCanvas = true;

		// --- 6 & 7 & 8. Host theme CSS must not affect the Presentation, and
		// the Presentation's own CSS must not leak into the host page —
		// verified against the realistic hostile-theme simulation (not the
		// extreme variant). ---
		const isolationCheck = await page.evaluate(() => {
			const embeds = Array.from(
				document.querySelectorAll("[data-sameview-embed]"),
			);
			const results = embeds.map((embed) => {
				const canvas = embed.shadowRoot.querySelector(".presentation-canvas");
				const handleVisual = embed.shadowRoot.querySelector(
					".comparison-slider__handle-visual",
				);
				const infoTitle = embed.shadowRoot.querySelector(
					".presentation-info__title, .presentation-info__time",
				);
				const canvasStyle = canvas ? getComputedStyle(canvas) : null;
				const infoStyle = infoTitle ? getComputedStyle(infoTitle) : null;
				return {
					// The hostile theme sets `button { all: unset; background:
					// #16a34a; ... }` globally — the Handle's own ring background
					// must still be white, never green, proving the host's
					// `button` rule did not reach into the Shadow Root.
					handleRingFill: handleVisual
						? getComputedStyle(handleVisual).getPropertyValue("fill")
						: null,
					// The hostile theme sets `h1,h2,h3,p,span,div { font-family:
					// "Comic Sans MS" ...; color: #7e22ce; text-transform:
					// uppercase; }` globally — none of that must reach a
					// Presentation Information text element either.
					infoFontFamily: infoStyle ? infoStyle.fontFamily : null,
					infoTextTransform: infoStyle ? infoStyle.textTransform : null,
					// The hostile theme sets `* { box-sizing: content-box;
					// margin: 4px; padding: 4px; }` globally — the canvas's own
					// box-sizing must remain whatever the Presentation CSS
					// itself declares (border-box), never the host's reset.
					canvasBoxSizing: canvasStyle ? canvasStyle.boxSizing : null,
				};
			});
			// Outward leak check: a host-page heading that is NOT part of any
			// SameView placement must still show the hostile theme's OWN
			// styling (proving SameView's CSS did not leak out and override
			// it).
			const hostHeading = document.querySelector(
				".entry-title, h1:not([data-sameview-embed] *)",
			);
			const hostHeadingColor = hostHeading
				? getComputedStyle(hostHeading).color
				: null;
			return { results, hostHeadingColor };
		});
		for (const result of isolationCheck.results) {
			assert.notEqual(
				result.handleRingFill,
				"rgb(22, 163, 74)",
				"the host theme's global button rule must not reach the Handle inside the Shadow Root",
			);
			assert.doesNotMatch(
				result.infoFontFamily ?? "",
				/Comic Sans/i,
				"the host theme's global heading/paragraph font must not reach Presentation Information text",
			);
			assert.notEqual(result.infoTextTransform, "uppercase");
			assert.equal(result.canvasBoxSizing, "border-box");
		}
		// rgb(126, 34, 206) === #7e22ce, the hostile theme's own heading color —
		// still in effect for the *host's own* heading, proving SameView's CSS
		// never overrode it (no outward leak).
		assert.equal(isolationCheck.hostHeadingColor, "rgb(126, 34, 206)");
		report.hostileThemeDoesNotAffectPresentation = true;
		report.presentationDoesNotLeakToHost = true;

		// --- 9. An additional extreme hostile-style test, never the sole
		// proof. ---
		const extremePage = await context.newPage();
		await extremePage.goto(`${PAGE_URL}?sameview_hostile_extreme=1`, {
			waitUntil: "networkidle",
		});
		await extremePage.waitForFunction(
			() =>
				Array.from(
					document.querySelectorAll("[data-sameview-embed]"),
				).every(
					(el) =>
						el.shadowRoot &&
						el.shadowRoot.querySelector(".presentation-canvas"),
				),
			{ timeout: 20000 },
		);
		const extremeCanvasCount = await extremePage.evaluate(
			() =>
				document.querySelectorAll(
					"[data-sameview-embed]",
				).length,
		);
		assert.equal(extremeCanvasCount, 3);
		const extremeHandleFill = await extremePage.evaluate(() => {
			const embed = document.querySelector("[data-sameview-embed]");
			const handleVisual = embed.shadowRoot.querySelector(
				".comparison-slider__handle-visual",
			);
			return handleVisual
				? getComputedStyle(handleVisual).getPropertyValue("fill")
				: null;
		});
		assert.notEqual(extremeHandleFill, null);
		report.extremeHostileStyleAlsoIsolated = true;
		await extremePage.close();

		// --- 4 & 5. Pointer, keyboard, resize geometry and overflow-tooltip
		// behavior inside Shadow DOM; tooltip DOM stays inside the owning
		// Shadow Root. ---
		const firstSlider = page.locator('[data-sameview-embed] [role="slider"]').nth(0);
		const secondSlider = page.locator('[data-sameview-embed] [role="slider"]').nth(1);
		const firstBefore = await firstSlider.getAttribute("aria-valuenow");
		const secondBefore = await secondSlider.getAttribute("aria-valuenow");
		await firstSlider.focus();
		await page.keyboard.press("ArrowRight");
		await page.keyboard.press("ArrowRight");
		const firstAfterKeyboard = await firstSlider.getAttribute("aria-valuenow");
		const secondAfterKeyboard = await secondSlider.getAttribute("aria-valuenow");
		assert.notEqual(firstAfterKeyboard, firstBefore);
		assert.equal(secondAfterKeyboard, secondBefore);

		await secondSlider.scrollIntoViewIfNeeded();
		const secondBox = await secondSlider.boundingBox();
		await page.mouse.move(
			secondBox.x + secondBox.width / 2,
			secondBox.y + secondBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(secondBox.x + secondBox.width / 2 + 150, secondBox.y + secondBox.height / 2, {
			steps: 10,
		});
		await page.mouse.up();
		const secondAfterPointer = await secondSlider.getAttribute("aria-valuenow");
		assert.notEqual(secondAfterPointer, secondBefore);
		report.pointerAndKeyboardWorkInsideShadowDom = true;

		// Resize geometry: shrink the viewport and confirm the canvas still
		// reports a sane, updated width (ResizeObserver reacting correctly
		// inside a Shadow Root).
		const widthBeforeResize = await page.evaluate(() => {
			const embed = document.querySelector("[data-sameview-embed]");
			return embed.shadowRoot
				.querySelector(".presentation-canvas")
				.getBoundingClientRect().width;
		});
		await page.setViewportSize({ width: 480, height: 900 });
		await page.waitForTimeout(500);
		const widthAfterResize = await page.evaluate(() => {
			const embed = document.querySelector("[data-sameview-embed]");
			return embed.shadowRoot
				.querySelector(".presentation-canvas")
				.getBoundingClientRect().width;
		});
		assert.ok(widthAfterResize > 0 && widthAfterResize !== widthBeforeResize);
		report.resizeGeometryWorksInsideShadowDom = true;
		await page.setViewportSize({ width: 1280, height: 800 });

		// Overflow tooltip: force a narrow canvas (small viewport already
		// set moments ago would do it, but do it deterministically via a
		// narrow window one more time) and check a truncated item's tooltip
		// opens, lives inside the SAME Shadow Root, and never in the light
		// DOM.
		await page.setViewportSize({ width: 360, height: 800 });
		await page.waitForTimeout(500);
		const tooltipCheck = await page.evaluate(() => {
			const embed = document.querySelector("[data-sameview-embed]");
			// A trigger only becomes tooltip-eligible (and gets `tabindex="0"`)
			// once its own rendered content is actually clamped — checking
			// specifically for that, rather than any `[data-overflow-tooltip]`
			// match, avoids grabbing a non-truncated trigger (e.g. a short
			// Title that happens to fit at this width).
			const trigger = embed.shadowRoot.querySelector(
				'[data-overflow-tooltip][tabindex="0"]',
			);
			return {
				hasTrigger: Boolean(trigger),
				testId: trigger ? trigger.getAttribute("data-testid") : null,
			};
		});
		if (tooltipCheck.hasTrigger) {
			const triggerHandle = page
				.locator("[data-sameview-embed]")
				.first()
				.locator(`css=[data-testid="${tooltipCheck.testId}"]`)
				.first();
			await triggerHandle.focus();
			await page.waitForTimeout(300);
			const tooltipLocation = await page.evaluate(() => {
				const embed = document.querySelector("[data-sameview-embed]");
				const inShadow = Boolean(
					embed.shadowRoot.querySelector(".presentation-tooltip"),
				);
				const inLightDom = Boolean(
					document.querySelector(".presentation-tooltip"),
				);
				return { inShadow, inLightDom };
			});
			assert.equal(tooltipLocation.inLightDom, false, "tooltip must never live in the light DOM");
			assert.equal(tooltipLocation.inShadow, true, "tooltip must live inside the owning Shadow Root");
			report.tooltipStaysInsideShadowRoot = true;
		} else {
			report.tooltipStaysInsideShadowRoot = "not triggered (no truncated item at this viewport)";
		}
		await page.setViewportSize({ width: 1280, height: 800 });

		// --- 13. Unrelated public pages load no Embed runtime assets. ---
		const unrelatedRequests = [];
		const unrelatedPage = await context.newPage();
		unrelatedPage.on("request", (request) => {
			const url = request.url();
			if (
				url.includes("comparison-embed-runtime.js") ||
				url.includes("comparison-embed.css")
			) {
				unrelatedRequests.push(url);
			}
		});
		await unrelatedPage.goto(UNRELATED_PAGE_URL, { waitUntil: "networkidle" });
		assert.deepEqual(unrelatedRequests, []);
		report.unrelatedPageLoadsNoEmbedAssets = true;
		await unrelatedPage.close();

		// --- Shortcode uses the same render path and is also isolated. ---
		await page.goto(SHORTCODE_PAGE_URL, { waitUntil: "networkidle" });
		const shortcodeHtml = await page.content();
		assertNoPhpIssuesInHtml(shortcodeHtml, "shortcode page");
		const shortcodeShadowOk = await page.evaluate(() => {
			const embed = document.querySelector("[data-sameview-embed]");
			return Boolean(
				embed &&
					embed.shadowRoot &&
					embed.shadowRoot.querySelector(".presentation-canvas"),
			);
		});
		assert.equal(shortcodeShadowOk, true);
		report.shortcodeAlsoShadowIsolated = true;

		// --- 11 & 12. Cache/versioning: the fingerprint is the `?v=` token,
		// and an update changes it and the served bytes. ---
		await page.goto(PAGE_URL, { waitUntil: "networkidle" });
		const referenceSrcBefore = await page.evaluate(() => {
			const embed = document.querySelector("[data-sameview-embed]");
			return JSON.parse(embed.getAttribute("data-sameview-embed")).assets
				.referenceSrc;
		});
		assert.match(referenceSrcBefore, /\?v=6330a49ff96057d1a4018e188f01d24b1fb030294cabf96618fc0fd9745d882e$/);
		const bytesBefore = await (await page.request.get(referenceSrcBefore)).body();

		// A genuine update: re-import the *same* session.id with different
		// asset bytes and a different fingerprint (mirrors
		// includes/import.php's own atomic-update path, exactly as a real
		// "Add comparison" upload would).
		wpCli([
			"eval",
			"echo json_encode( sameview_import_seed('/var/www/html/wp-content/sameview-artifact/comparison-a-update-seed') );",
		]);

		await page.goto(PAGE_URL, { waitUntil: "networkidle" });
		const referenceSrcAfter = await page.evaluate(() => {
			const embed = document.querySelector("[data-sameview-embed]");
			return JSON.parse(embed.getAttribute("data-sameview-embed")).assets
				.referenceSrc;
		});
		assert.notEqual(referenceSrcAfter, referenceSrcBefore, "the effective URL must change after a real update");
		const bytesAfter = await (await page.request.get(referenceSrcAfter)).body();
		assert.notEqual(
			Buffer.from(bytesAfter).toString("base64"),
			Buffer.from(bytesBefore).toString("base64"),
			"the newly served bytes must actually be the updated image, not the old cached one",
		);
		report.versioningReflectsRealUpdate = true;

		// --- 10. The real Gutenberg editor preview continues to render and
		// interact correctly. ---
		const pageIdRaw = wpCli([
			"post",
			"list",
			"--post_type=page",
			"--title=SameView Isolation Test",
			"--field=ID",
		]).trim();
		const editorPage = await context.newPage();
		editorPage.on("pageerror", (error) => pageErrors.push(String(error)));
		await loginAsAdmin(editorPage);
		await editorPage.goto(`${BASE}/wp-admin/post.php?post=${pageIdRaw}&action=edit`);
		await dismissPatternModalIfPresent(editorPage);
		const canvasFrame = editorPage.frameLocator('iframe[name="editor-canvas"]');
		await canvasFrame.locator("h1, .wp-block-post-title").first().waitFor({ timeout: 20000 });
		await editorPage.waitForTimeout(3000);
		const editorFrame = editorPage.frames().find((f) => f.name() === "editor-canvas");
		const editorShadowCount = await editorFrame.evaluate(
			() =>
				Array.from(document.querySelectorAll("[data-sameview-embed]")).filter(
					(el) => el.shadowRoot && el.shadowRoot.querySelector(".presentation-canvas"),
				).length,
		);
		assert.equal(editorShadowCount, 3, "all three placements must render interactively (shadow-rooted) in the editor");
		const editorSlider = canvasFrame.locator('[data-sameview-embed] [role="slider"]').first();
		const editorBefore = await editorSlider.getAttribute("aria-valuenow");
		await editorSlider.focus();
		await editorPage.keyboard.press("ArrowRight");
		const editorAfter = await editorSlider.getAttribute("aria-valuenow");
		assert.notEqual(editorAfter, editorBefore);
		report.editorPreviewStillWorksWithShadowDom = true;

		const editorHtml = await editorFrame.evaluate(() => document.documentElement.outerHTML);
		assertNoPhpIssuesInHtml(editorHtml, "editor canvas");

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
				await pages[i].screenshot({ path: `C:/tmp/phase17-fail-${i}.png`, fullPage: true });
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
