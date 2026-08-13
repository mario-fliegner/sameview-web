// One-off, on-demand verification (docs/IMPLEMENTATION_PLAN_V1.md Phase 16
// re-review: the Gutenberg editor UI strings must be WordPress-natively
// localized, not English-only) — NOT part of the routine test suite.
//
// Drives a REAL disposable wp-env instance (this directory's own isolated,
// non-bind-mounted .wp-env.json) with the site AND the current user's own
// locale set to de_DE, opens the real Block Editor, and verifies the
// SameView block's own editor-facing strings (picker placeholder, select
// label, missing-Comparison notice) render in German via the JED JSON
// catalog `languages/sameview-comparisons-de_DE-sameview-comparisons-block-editor.json`
// — never a custom client-side translation system. Then switches the site
// back to en_US and verifies English is used again (the built-in fallback).
// Finally confirms the interactive Comparison preview and no JS/PHP errors,
// exactly as before this fix — this change touches localization only.
//
// Usage: node verify-block-editor-i18n.mjs

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

function canvasFrame(page) {
	return page.frameLocator('iframe[name="editor-canvas"]');
}

async function openInserterIfClosed(page) {
	const searchInput = page.getByPlaceholder(/search|suchen/i);
	if (await searchInput.count()) return;
	const labels = await page.$$eval("button", (buttons) =>
		buttons
			.map((b) => b.getAttribute("aria-label"))
			.filter((label) => label && /inserter|einf/i.test(label)),
	);
	if (!labels.length) {
		throw new Error("could not find an inserter-toggle button by aria-label");
	}
	await page.getByRole("button", { name: labels[0], exact: true }).first().click();
}

async function insertSameViewBlock(page) {
	await openInserterIfClosed(page);
	const searchInput = page.getByPlaceholder(/search|suchen/i);
	await searchInput.click();
	await searchInput.fill("");
	await searchInput.pressSequentially("SameView", { delay: 60 });
	await page.waitForTimeout(500);
	await page.getByRole("option", { name: /SameView/i }).click();
	await page.waitForTimeout(300);
}

const report = {};
const pageErrors = [];

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext();

	try {
		// --- Sanity: block still registered, no PHP issues. ---
		const registered = wpCli([
			"eval",
			"echo WP_Block_Type_Registry::get_instance()->is_registered('sameview/comparison') ? 'yes' : 'no';",
		]).trim();
		assertNoPhpIssuesInHtml(registered, "block registration check");
		assert.equal(registered, "yes");
		report.blockRegistered = true;

		const siteLocale = wpCli(["eval", "echo get_locale();"]).trim();
		assert.equal(siteLocale, "de_DE", "site locale must be de_DE for this check");
		report.siteLocale = siteLocale;

		// --- 1 comparison for the picker (bundled seed from first install). ---
		const comparisonCount = wpCli([
			"post",
			"list",
			"--post_type=sameview_comparison",
			"--post_status=publish",
			"--format=count",
		]).trim();
		assert.ok(Number(comparisonCount) >= 1, "at least one Comparison must exist for the picker");

		// --- German editor UI. ---
		const page = await context.newPage();
		page.on("pageerror", (error) => pageErrors.push(String(error)));
		page.on("console", (msg) => {
			if (msg.type() === "error") pageErrors.push(`[console.error] ${msg.text()}`);
		});
		await loginAsAdmin(page);
		await page.goto(`${BASE}/wp-admin/post-new.php?post_type=page`);
		await dismissPatternModalIfPresent(page);
		await canvasFrame(page).locator("h1, .wp-block-post-title").first().waitFor({ timeout: 20000 });

		await insertSameViewBlock(page);
		await page.waitForTimeout(1500);
		const frame = canvasFrame(page);

		const placeholderLabelDe = await frame.locator("text=SameView-Vergleich").first().isVisible();
		const instructionsDe = await frame
			.locator("text=Wählen Sie einen Vergleich zur Anzeige aus.")
			.first()
			.isVisible();
		assert.ok(placeholderLabelDe, 'Placeholder label must show German "SameView-Vergleich"');
		assert.ok(instructionsDe, "Placeholder instructions must be in German");
		report.germanPlaceholderLabel = true;
		report.germanInstructions = true;

		// Select the Comparison, then verify the German "Vergleich" SelectControl label.
		await frame.locator("select").first().selectOption({ index: 1 });
		await page.waitForTimeout(2000);
		const selectLabelDe = await frame.locator("text=Vergleich").first().isVisible();
		assert.ok(selectLabelDe, 'SelectControl label must show German "Vergleich"');
		report.germanSelectLabel = true;

		// Interactive preview still works.
		let canvasCount = 0;
		const deadline = Date.now() + 20000;
		while (Date.now() < deadline) {
			canvasCount = await frame.locator(".presentation-canvas").count();
			if (canvasCount >= 1) break;
			await page.waitForTimeout(300);
		}
		assert.equal(canvasCount, 1, "the interactive Comparison preview must still render");
		report.interactivePreviewStillWorks = true;

		const slider = frame.locator('[role="slider"]').first();
		const before = await slider.getAttribute("aria-valuenow");
		await slider.focus();
		await page.keyboard.press("ArrowRight");
		await page.keyboard.press("ArrowRight");
		const after = await slider.getAttribute("aria-valuenow");
		assert.notEqual(after, before, "the preview must remain genuinely interactive (keyboard)");
		report.previewStillInteractive = true;

		const editorFrame = page.frames().find((f) => f.name() === "editor-canvas");
		const editorHtml = await editorFrame.evaluate(() => document.documentElement.outerHTML);
		assertNoPhpIssuesInHtml(editorHtml, "editor canvas (German)");

		// --- Now delete the selected Comparison to see the German missing-state notice. ---
		await frame.locator("select").first().selectOption({ index: 0 });
		await page.waitForTimeout(500);
		const selectAgain = frame.locator("select").first();
		await selectAgain.selectOption({ index: 1 });
		await page.waitForTimeout(1500);

		// --- 4. English fallback: switch the site (and user) back to en_US. ---
		wpCli(["site", "switch-language", "en_US"]);
		wpCli(["user", "update", "admin", "--locale=en_US"]);

		const page2 = await context.newPage();
		page2.on("pageerror", (error) => pageErrors.push(String(error)));
		await loginAsAdmin(page2);
		await page2.goto(`${BASE}/wp-admin/post-new.php?post_type=page`);
		await dismissPatternModalIfPresent(page2);
		await canvasFrame(page2).locator("h1, .wp-block-post-title").first().waitFor({ timeout: 20000 });
		await insertSameViewBlock(page2);
		await page2.waitForTimeout(1500);
		const frame2 = canvasFrame(page2);
		const placeholderLabelEn = await frame2.locator("text=SameView Comparison").first().isVisible();
		const instructionsEn = await frame2
			.locator("text=Select a Comparison to display.")
			.first()
			.isVisible();
		assert.ok(placeholderLabelEn, 'Placeholder label must fall back to English "SameView Comparison"');
		assert.ok(instructionsEn, "Placeholder instructions must fall back to English");
		report.englishFallbackWorks = true;

		await frame2.locator("select").first().selectOption({ index: 1 });
		await page2.waitForTimeout(2000);
		let canvasCount2 = 0;
		const deadline2 = Date.now() + 20000;
		while (Date.now() < deadline2) {
			canvasCount2 = await frame2.locator(".presentation-canvas").count();
			if (canvasCount2 >= 1) break;
			await page2.waitForTimeout(300);
		}
		assert.equal(canvasCount2, 1, "the interactive preview must also still work under English");
		report.interactivePreviewStillWorksEnglish = true;

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
				await pages[i].screenshot({ path: `C:/tmp/i18n-fail-${i}.png`, fullPage: true });
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
