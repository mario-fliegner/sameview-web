// One-off, on-demand verification (docs/IMPLEMENTATION_PLAN_V1.md Phase 16
// final acceptance) — NOT part of the routine test suite (its filename does
// not match "tests/**/*.test.mjs"). Drives a REAL disposable wp-env
// WordPress instance (this directory's own isolated, non-bind-mounted
// .wp-env.json — see verify-fresh-install.mjs's own header comment for why)
// through the actual Block Editor UI and public frontend via Playwright,
// covering the Phase 16 placement/rendering behavior:
//
//   block insertion → Comparison picker → genuinely interactive editor
//   preview (pointer + keyboard) → publish → public frontend rendering
//   through the same shared renderer → multiple independent placements
//   (same Comparison twice, two different Comparisons) → shortcode via the
//   same render path → conditional asset loading → deleted-Comparison
//   missing states (editor + public) → re-import restores the placement
//   without resaving → no PHP warnings/notices/errors throughout.
//
// Prerequisites: two real generated WordPress packages must already exist —
//   node scripts/generate-wordpress-artifact-for-verification.mjs \
//     integrations/wordpress/tests/fresh-install/artifact/comparison-a.zip \
//     sample-v6-session_full.zip
//   node scripts/generate-wordpress-artifact-for-verification.mjs \
//     integrations/wordpress/tests/fresh-install/artifact/comparison-b.zip \
//     sample-v6-session_minimal.zip
// — and Comparison A must already be freshly installed+activated
// (`wp plugin install .../comparison-a.zip --activate`) with Comparison B's
// own seed/ folder imported via `sameview_import_seed()` (see this
// repository's own Phase 16 report for the exact commands used).
//
// Usage: node verify-phase16-placement.mjs

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

const report = {};
const pageErrors = [];

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

async function dismissPatternModalIfPresent(page, timeoutMs = 5000) {
	try {
		await page.getByRole("button", { name: "Close" }).first().click({ timeout: timeoutMs });
	} catch {
		// No modal this time.
	}
}

function canvasFrame(page) {
	return page.frameLocator('iframe[name="editor-canvas"]');
}

async function openInserterIfClosed(page) {
	// A bare `.count()` snapshot can observe a search input that is mid-
	// transition (about to unmount from the previous block's own insertion,
	// e.g. on WordPress 6.9.7) and wrongly conclude the inserter is already
	// open, handing the caller an element that then detaches mid-interaction.
	// Waiting briefly for actual visibility is a stronger, still-minimal
	// signal of "genuinely open and interactable right now".
	// A search-input DOM presence/visibility check is unreliable here: after
	// a previous insertSameViewBlock's own option selection, the popover
	// begins an async close transition during which its search input can
	// still read as "visible" for a moment while genuinely on its way out
	// (observed on 6.9.7 — the very next `.click()` then finds it detached
	// mid-interaction). The toggle button's own `aria-pressed` reflects the
	// real React open/closed state immediately, not a transition artifact.
	const toggle = page.getByRole("button", { name: "Block Inserter", exact: true });
	const alreadyOpen = (await toggle.getAttribute("aria-pressed")) === "true";
	if (!alreadyOpen) {
		await toggle.click();
	}
	const searchInput = page.getByPlaceholder(/search/i);
	await searchInput.waitFor({ state: "visible", timeout: 5000 });
}

async function insertSameViewBlock(page) {
	// WordPress's own native "Choose a pattern" starter-pattern modal can
	// reappear before a later inserter interaction on some WordPress
	// versions (observed on 6.9.7, intercepting the inserter search input) —
	// defensive re-check here, not just once at page load, keeps this
	// unrelated WordPress-core UI behavior from blocking the SameView block
	// insertion it has nothing to do with. A short timeout, since the modal
	// is normally absent here and this must not meaningfully shift the rest
	// of this function's own interaction timing.
	// Brief settle wait: the previous insertion's own selectComparisonInLastBlock
	// re-renders the editor canvas via ServerSideRender on an independent
	// timeline (see assets/block/index.js `ComparisonPreview`'s own
	// MutationObserver-driven re-mount) — starting the next inserter
	// interaction immediately after can race that unrelated re-render.
	await page.waitForTimeout(500);
	await dismissPatternModalIfPresent(page, 800);
	await openInserterIfClosed(page);
	const searchInput = page.getByPlaceholder(/search/i);
	await searchInput.click();
	await searchInput.fill("");
	await searchInput.pressSequentially("SameView", { delay: 60 });
	await page.waitForTimeout(500);
	await page.getByRole("option", { name: /SameView Comparison/i }).click();
	await page.waitForTimeout(300);
}

async function insertShortcodeBlock(page, shortcodeText) {
	await dismissPatternModalIfPresent(page, 800);
	await openInserterIfClosed(page);
	const searchInput = page.getByPlaceholder(/search/i);
	await searchInput.click();
	await searchInput.fill("");
	await searchInput.pressSequentially("Shortcode", { delay: 60 });
	await page.waitForTimeout(500);
	await page.getByRole("option", { name: /^Shortcode$/i }).click();
	await page.waitForTimeout(300);
	const frame = canvasFrame(page);
	const shortcodeTextarea = frame.locator("textarea").last();
	await shortcodeTextarea.click();
	await shortcodeTextarea.fill(shortcodeText);
	await page.waitForTimeout(300);
}

async function selectComparisonInLastBlock(page, label) {
	const frame = canvasFrame(page);
	const select = frame.locator("select").last();
	await select.selectOption({ label });
	await page.waitForTimeout(2000);
}

async function waitForPresentationCanvas(page, expectedCount, timeoutMs = 20000) {
	const frame = canvasFrame(page);
	const deadline = Date.now() + timeoutMs;
	let count = 0;
	while (Date.now() < deadline) {
		count = await frame.locator(".presentation-canvas").count();
		if (count >= expectedCount) return count;
		await page.waitForTimeout(300);
	}
	return count;
}

async function publishPage(page) {
	await page.getByRole("button", { name: "Publish", exact: true }).first().click();
	const panel = page.getByRole("region", { name: /editor publish/i }).or(
		page.locator(".editor-post-publish-panel"),
	);
	await panel.getByRole("button", { name: "Publish", exact: true }).click();
	await page.waitForSelector("text=is now live", { timeout: 20000 }).catch(() => {});
}

async function getPermalink(page) {
	const link = page.locator(".post-publish-panel__postpublish-buttons a, .components-panel__body a").filter({
		hasText: /view page|view post/i,
	});
	if (await link.count()) {
		return link.first().getAttribute("href");
	}
	return null;
}

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext();
	let debugPage;

	try {
		// --- 1. Real disposable wp-env instance, block registered. ---
		const registered = wpCli([
			"eval",
			"echo WP_Block_Type_Registry::get_instance()->is_registered('sameview/comparison') ? 'yes' : 'no';",
		]).trim();
		assertNoPhpIssuesInHtml(registered, "block registration check");
		assert.equal(registered, "yes", "sameview/comparison block must be registered");
		report.blockRegistered = true;

		// --- Editor: insert the block three times (A, A again, B). ---
		const editorPage = await context.newPage();
		editorPage.on("pageerror", (error) => pageErrors.push(String(error)));
		await loginAsAdmin(editorPage);
		await editorPage.goto(`${BASE}/wp-admin/post-new.php?post_type=page`);
		await dismissPatternModalIfPresent(editorPage);
		await canvasFrame(editorPage).locator("h1, .wp-block-post-title").first().waitFor({ timeout: 20000 });

		await insertSameViewBlock(editorPage);
		await selectComparisonInLastBlock(editorPage, "White and black wall portait");
		let canvasCount = await waitForPresentationCanvas(editorPage, 1);
		assert.equal(canvasCount, 1, "first placement (Comparison A) must render interactively in the editor");

		await insertSameViewBlock(editorPage);
		await selectComparisonInLastBlock(editorPage, "White and black wall portait");
		canvasCount = await waitForPresentationCanvas(editorPage, 2);
		assert.equal(canvasCount, 2, "second placement (Comparison A again) must render independently");

		await insertSameViewBlock(editorPage);
		await selectComparisonInLastBlock(editorPage, "SameView Comparison");
		canvasCount = await waitForPresentationCanvas(editorPage, 3);
		assert.equal(canvasCount, 3, "third placement (Comparison B) must render");
		report.editorThreePlacementsRendered = true;

		// --- Editor: no colliding DOM ids across the three instances. ---
		const editorFrame = editorPage
			.frames()
			.find((frame) => frame.name() === "editor-canvas");
		const editorIdCounts = await editorFrame.evaluate(() => {
			const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
			const counts = {};
			for (const id of ids) counts[id] = (counts[id] || 0) + 1;
			return Object.entries(counts).filter(([, n]) => n > 1);
		});
		assert.deepEqual(editorIdCounts, [], "no duplicate DOM ids across editor placements");
		report.editorNoDuplicateIds = true;

		// --- Editor: pointer + keyboard slider interaction, independent per instance. ---
		const sliders = editorFrame.locator('[role="slider"]');
		const firstSliderBefore = await sliders.nth(0).getAttribute("aria-valuenow");
		const secondSliderBefore = await sliders.nth(1).getAttribute("aria-valuenow");
		await sliders.nth(0).focus();
		await editorPage.keyboard.press("ArrowRight");
		await editorPage.keyboard.press("ArrowRight");
		const firstSliderAfterKeyboard = await sliders.nth(0).getAttribute("aria-valuenow");
		const secondSliderAfterKeyboard = await sliders.nth(1).getAttribute("aria-valuenow");
		assert.notEqual(
			firstSliderAfterKeyboard,
			firstSliderBefore,
			"keyboard interaction must move the focused instance's own slider",
		);
		assert.equal(
			secondSliderAfterKeyboard,
			secondSliderBefore,
			"keyboard interaction on one instance must not move another instance's slider",
		);

		await sliders.nth(1).scrollIntoViewIfNeeded();
		const secondSliderBox = await sliders.nth(1).boundingBox();
		if (secondSliderBox) {
			const startX = secondSliderBox.x + secondSliderBox.width / 2;
			const startY = secondSliderBox.y + secondSliderBox.height / 2;
			await editorPage.mouse.move(startX, startY);
			await editorPage.mouse.down();
			await editorPage.mouse.move(startX + 150, startY, { steps: 10 });
			await editorPage.mouse.up();
		}
		const secondSliderAfterPointer = await sliders.nth(1).getAttribute("aria-valuenow");
		const firstSliderAfterPointer = await sliders.nth(0).getAttribute("aria-valuenow");
		assert.notEqual(
			secondSliderAfterPointer,
			secondSliderBefore,
			"pointer drag must move the dragged instance's own slider",
		);
		assert.equal(
			firstSliderAfterPointer,
			firstSliderAfterKeyboard,
			"pointer drag on one instance must not move another instance's slider",
		);
		report.editorSliderPointerAndKeyboardIndependent = true;

		const editorHtmlAfterInteraction = await editorFrame.evaluate(() => document.documentElement.outerHTML);
		assertNoPhpIssuesInHtml(editorHtmlAfterInteraction, "editor canvas after block insertion/interaction");

		// --- Publish and get the permalink. ---
		await publishPage(editorPage);
		const permalink = (await getPermalink(editorPage)) || (await editorPage.url());
		report.permalink = permalink;

		// --- Add a shortcode block for Comparison A on a second page. ---
		const shortcodePage = await context.newPage();
		await shortcodePage.goto(`${BASE}/wp-admin/post-new.php?post_type=page`);
		await dismissPatternModalIfPresent(shortcodePage);
		await canvasFrame(shortcodePage).locator("h1, .wp-block-post-title").first().waitFor({ timeout: 20000 });
		await insertShortcodeBlock(shortcodePage, '[sameview_comparison session_id="2026-07-27_13-54-15"]');
		await publishPage(shortcodePage);
		const shortcodePermalink = (await getPermalink(shortcodePage)) || shortcodePage.url();
		report.shortcodePermalink = shortcodePermalink;

		// --- Public frontend: the same three placements + shortcode, via the shared renderer. ---
		const publicPage = await context.newPage();
		const requestedAssets = [];
		publicPage.on("request", (request) => {
			const url = request.url();
			if (url.includes("comparison-embed-runtime.js") || url.includes("comparison-embed.css")) {
				requestedAssets.push(url);
			}
		});
		await publicPage.goto(String(permalink), { waitUntil: "networkidle" });
		const publicHtmlBefore = await publicPage.content();
		assertNoPhpIssuesInHtml(publicHtmlBefore, "public page with placements");
		await publicPage.waitForSelector(".presentation-canvas", { timeout: 20000 });
		const publicCanvasCount = await publicPage.locator(".presentation-canvas").count();
		assert.equal(publicCanvasCount, 3, "all three placements must render on the public page");
		report.publicThreePlacementsRendered = true;
		assert.ok(
			requestedAssets.some((u) => u.includes("comparison-embed-runtime.js")),
			"the embed runtime must load on a page that actually has a placement",
		);

		const publicIdCounts = await publicPage.evaluate(() => {
			const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
			const counts = {};
			for (const id of ids) counts[id] = (counts[id] || 0) + 1;
			return Object.entries(counts).filter(([, n]) => n > 1);
		});
		assert.deepEqual(publicIdCounts, [], "no duplicate DOM ids across public placements");
		report.publicNoDuplicateIds = true;

		// Independent public interaction state across the two Comparison-A instances.
		const publicSliders = publicPage.locator('[role="slider"]');
		const pubFirstBefore = await publicSliders.nth(0).getAttribute("aria-valuenow");
		const pubSecondBefore = await publicSliders.nth(1).getAttribute("aria-valuenow");
		await publicSliders.nth(0).focus();
		await publicPage.keyboard.press("ArrowLeft");
		await publicPage.keyboard.press("ArrowLeft");
		const pubFirstAfter = await publicSliders.nth(0).getAttribute("aria-valuenow");
		const pubSecondAfter = await publicSliders.nth(1).getAttribute("aria-valuenow");
		assert.notEqual(pubFirstAfter, pubFirstBefore, "public keyboard interaction must move the focused instance");
		assert.equal(pubSecondAfter, pubSecondBefore, "public keyboard interaction must not move another instance");
		report.publicInteractionIndependent = true;

		// Shortcode renders the same output via the same render path.
		await publicPage.goto(String(shortcodePermalink), { waitUntil: "networkidle" });
		const shortcodeHtml = await publicPage.content();
		assertNoPhpIssuesInHtml(shortcodeHtml, "shortcode public page");
		const shortcodeCanvasCount = await publicPage.locator(".presentation-canvas").count();
		assert.equal(shortcodeCanvasCount, 1, "shortcode must render exactly one interactive Comparison");
		report.shortcodeRendersInteractively = true;

		// --- Conditional asset loading: an unrelated page must not load the embed runtime/CSS. ---
		const unrelatedRequests = [];
		const unrelatedPage = await context.newPage();
		unrelatedPage.on("request", (request) => {
			const url = request.url();
			if (url.includes("comparison-embed-runtime.js") || url.includes("comparison-embed.css")) {
				unrelatedRequests.push(url);
			}
		});
		await unrelatedPage.goto(`${BASE}/?page_id=2`, { waitUntil: "networkidle" }).catch(() => {});
		await unrelatedPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
		assert.deepEqual(
			unrelatedRequests,
			[],
			"an unrelated page without any SameView placement must not load the embed runtime/CSS",
		);
		report.unrelatedPageLoadsNoEmbedAssets = true;
		await unrelatedPage.close();

		// --- Deleted Comparison: public missing state + editor missing state. ---
		const deletedPostId = wpCli([
			"post",
			"list",
			"--post_type=sameview_comparison",
			"--meta_key=_sameview_session_id",
			"--meta_value=2026-07-27_13-54-15",
			"--field=ID",
		]).trim();
		wpCli(["post", "delete", deletedPostId, "--force"]);

		await publicPage.goto(String(permalink), { waitUntil: "networkidle" });
		const afterDeleteHtml = await publicPage.content();
		assertNoPhpIssuesInHtml(afterDeleteHtml, "public page after deleting Comparison A");
		const afterDeleteCanvasCount = await publicPage.locator(".presentation-canvas").count();
		assert.equal(
			afterDeleteCanvasCount,
			1,
			"only Comparison B's placement must still render after Comparison A is deleted",
		);
		report.publicMissingStateAfterDelete = true;

		await editorPage.goto(editorPage.url());
		await dismissPatternModalIfPresent(editorPage);
		await editorPage.waitForTimeout(2000);
		const editorFrameAfterDelete = editorPage
			.frames()
			.find((frame) => frame.name() === "editor-canvas");
		const missingNoticeCount = await editorFrameAfterDelete.evaluate(
			() => document.querySelectorAll(".components-notice.is-warning").length,
		);
		assert.ok(missingNoticeCount >= 2, "the two blocks referencing the deleted Comparison must show the missing-Comparison notice");
		report.editorMissingStateAfterDelete = true;

		// --- Re-import the same session.id: the existing placement becomes
		// functional again without resaving the post. ---
		wpCli([
			"eval",
			"echo json_encode( sameview_import_seed('/var/www/html/wp-content/sameview-artifact/comparison-a-reimport-seed') );",
		]);

		await publicPage.goto(String(permalink), { waitUntil: "networkidle" });
		const afterReimportHtml = await publicPage.content();
		assertNoPhpIssuesInHtml(afterReimportHtml, "public page after re-importing Comparison A");
		const afterReimportCanvasCount = await publicPage.locator(".presentation-canvas").count();
		assert.equal(
			afterReimportCanvasCount,
			3,
			"re-importing the same session.id must restore both placements without resaving the post",
		);
		report.reimportRestoresPlacementWithoutResave = true;

		console.log("\nVERIFICATION PASSED\n");
		console.log(JSON.stringify(report, null, 2));
		if (pageErrors.length) {
			console.log("\nBrowser page errors observed (review):", pageErrors);
		}
	} catch (error) {
		console.log("\nVERIFICATION FAILED:", error.message);
		console.log("partial report:", JSON.stringify(report, null, 2));
		try {
			const pages = context.pages();
			for (let i = 0; i < pages.length; i++) {
				await pages[i].screenshot({ path: `C:/tmp/fail-${i}.png`, fullPage: true });
			}
			console.log(`saved ${pages.length} debug screenshot(s) to C:/tmp/fail-*.png`);
		} catch {
			// Best-effort debugging aid only.
		}
		throw error;
	} finally {
		await context.close();
		await browser.close();
	}
})();
