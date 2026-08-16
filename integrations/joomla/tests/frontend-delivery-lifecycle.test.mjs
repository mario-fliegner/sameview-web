// Real-instance verification of Phase 23 (docs/IMPLEMENTATION_PLAN_V1.md
// "Phase 23 – Joomla Frontend Delivery and Host Isolation"): conditional
// asset loading, native asset/cache versioning, multiple simultaneous
// placements on one page, and Shadow DOM host isolation against a real
// aggressive template stylesheet — against real, disposable Joomla
// instances for both supported major versions, per
// docs/JOOMLA_INTEGRATION.md "Testing".
//
// The underlying placement rendering itself (content plugin, module,
// Add-comparison lifecycle) is already covered by
// add-comparison-lifecycle.test.mjs and placement-lifecycle.test.mjs; the
// repository's own Phase 23 analysis found no product-code gap — this file
// exists to prove that already-correct rendering actually delivers the
// frontend-delivery/host-isolation contract end-to-end in a real browser,
// per docs/EMBED_IN_WEBSITE.md "Performance and Resource Loading",
// "Caching and Updates", "Host Isolation" and
// docs/JOOMLA_INTEGRATION.md "Frontend Delivery"/"Host Isolation".
//
// Prerequisites: the current-major and previous-major Docker instances must
// already be running; the real package artifact must already be built
// (`node scripts/generate-joomla-artifact-for-verification.mjs
// integrations/joomla/tests/artifact/comparison-full-joomla.zip`, repo
// root).

import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	BlobReader,
	BlobWriter,
	TextReader,
	TextWriter,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipReader,
	ZipWriter,
} from "@zip.js/zip.js";
import {
	INSTANCES,
	JOOMLA_DIR,
	copyIntoContainer,
	dbQuery,
	disableGuidedTours,
	joomlaCli,
	loginAsAdmin,
	normalizeMediaOwnership,
	raiseUploadLimits,
	resetExtensionState,
} from "./docker-helpers.mjs";

const ARTIFACT = join(JOOMLA_DIR, "tests", "artifact", "comparison-full-joomla.zip");
const HOSTILE_PLUGIN_DIR = join(JOOMLA_DIR, "tests", "hostile-template-plugin");
const HOSTILE_PLUGIN_ZIP = join(JOOMLA_DIR, "tests", "artifact", "_frontend-delivery-hostile-plugin.zip");
const UPDATED_ARTIFACT = join(JOOMLA_DIR, "tests", "artifact", "_frontend-delivery-updated.zip");
const CONTAINER_ZIP_PATH = "/var/www/html/tmp/sameview-comparisons-joomla.zip";
const CONTAINER_HOSTILE_ZIP_PATH = "/var/www/html/tmp/sameview-hostile-test-plugin.zip";

async function readManifestSessionId(artifactPath) {
	const buffer = await readFile(artifactPath);
	const reader = new ZipReader(new BlobReader(new Blob([buffer])));
	const entries = await reader.getEntries();
	const manifestEntry = entries.find(
		(entry) => entry.filename === "com_sameviewcomparisons/seed/comparison.json",
	);
	const text = await manifestEntry.getData(new TextWriter());
	await reader.close();
	return JSON.parse(text).sessionId;
}

// A same-session, different-fingerprint AND different-image-bytes variant of
// the full artifact, for the real byte-change proof in Check D below —
// mirrors add-comparison-lifecycle.test.mjs's own buildUpdatedArtifact(),
// but additionally swaps reference.jpg for the artifact's own capture.jpg
// bytes (a different, still-genuinely-valid real photo) rather than leaving
// image bytes untouched: that earlier helper only needed to prove the DB
// row's own fingerprint/title changed, never that the publicly served image
// bytes themselves differ, which is exactly what this phase's own Check D
// requires.
async function buildUpdatedArtifact() {
	const buffer = await readFile(ARTIFACT);
	const reader = new ZipReader(new BlobReader(new Blob([buffer])));
	const entries = await reader.getEntries();

	const captureEntry = entries.find(
		(entry) => entry.filename === "com_sameviewcomparisons/seed/capture.jpg",
	);
	const captureBytes = await captureEntry.getData(new Uint8ArrayWriter());

	const writer = new ZipWriter(new BlobWriter("application/zip"));
	for (const entry of entries) {
		if (entry.filename === "com_sameviewcomparisons/seed/comparison.json") {
			const text = await entry.getData(new TextWriter());
			const manifest = JSON.parse(text);
			manifest.outcomeFingerprint = `${manifest.outcomeFingerprint}-frontend-delivery-updated`;
			await writer.add(
				"com_sameviewcomparisons/seed/comparison.json",
				new TextReader(JSON.stringify(manifest, null, "\t")),
			);
			continue;
		}
		if (entry.filename === "com_sameviewcomparisons/seed/reference.jpg") {
			await writer.add(entry.filename, new Uint8ArrayReader(captureBytes));
			continue;
		}
		const bytes = await entry.getData(new Uint8ArrayWriter());
		await writer.add(entry.filename, new Uint8ArrayReader(bytes));
	}

	const blob = await writer.close();
	await writeFile(UPDATED_ARTIFACT, Buffer.from(await blob.arrayBuffer()));
	await reader.close();
}

async function buildHostilePluginZip() {
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	for (const name of ["sameviewhostiletest.xml", "sameviewhostiletest.php"]) {
		const bytes = await readFile(join(HOSTILE_PLUGIN_DIR, name));
		await writer.add(name, new Uint8ArrayReader(new Uint8Array(bytes)));
	}
	const blob = await writer.close();
	await writeFile(HOSTILE_PLUGIN_ZIP, Buffer.from(await blob.arrayBuffer()));
}

function installPackage(composeFile) {
	copyIntoContainer(composeFile, ARTIFACT, CONTAINER_ZIP_PATH);
	const output = joomlaCli(composeFile, `extension:install --path=${CONTAINER_ZIP_PATH} -v`);
	normalizeMediaOwnership(composeFile);
	return output;
}

async function createArticle(composeFile, baseUrl, title, bodyText) {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		await loginAsAdmin(page, baseUrl);
		await page.goto(`${baseUrl}/administrator/index.php?option=com_content&task=article.add`);
		await page.waitForSelector("#jform_title");
		await page.fill("#jform_title", title);
		const frame = page.frameLocator("#jform_articletext_ifr");
		await frame.locator("body").click();
		await frame.locator("body").fill(bodyText);
		await page.evaluate(() => {
			const f = document.getElementById("adminForm") || document.forms[0];
			f.task.value = "article.save";
			Joomla.submitform("article.save", f);
		});
		await page.waitForLoadState("networkidle").catch(() => {});
	} finally {
		await browser.close();
	}

	const id = Number(dbQuery(composeFile, "SELECT id FROM joom_content ORDER BY id DESC LIMIT 1;"));
	dbQuery(
		composeFile,
		`UPDATE joom_content SET state=1, catid=(SELECT id FROM joom_categories WHERE extension='com_content' LIMIT 1) WHERE id=${id};`,
	);
	return `${baseUrl}/index.php?option=com_content&view=article&id=${id}`;
}

async function createModulePlacement(composeFile, baseUrl, sessionId, versionLabel) {
	const eid = dbQuery(composeFile, "SELECT extension_id FROM joom_extensions WHERE name='mod_sameview_comparison';");
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		await loginAsAdmin(page, baseUrl);
		await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&task=module.add&client_id=0&eid=${eid}`);
		await page.waitForSelector("#jform_title", { timeout: 10000 });
		await page.fill("#jform_title", `Phase 23 Module — ${versionLabel}`);

		const sessionSelect = page.locator("select[name='jform[params][session_id]']");
		await sessionSelect.selectOption(sessionId);

		// docs/IMPLEMENTATION_PLAN_V1.md Phase 22 note (mirrored here): the
		// module position field is a Choices.js-enhanced select whose
		// underlying <select> starts with no template-position <option>s on
		// Joomla 5 — set the real <select> value directly, exactly like
		// placement-lifecycle.test.mjs already does.
		await page.evaluate(() => {
			const select = document.getElementById("jform_position");
			let option = Array.from(select.options).find((candidate) => candidate.value === "sidebar-right");
			if (!option) {
				option = document.createElement("option");
				option.value = "sidebar-right";
				option.textContent = "Sidebar Right";
				select.appendChild(option);
			}
			select.value = "sidebar-right";
			select.dispatchEvent(new Event("change", { bubbles: true }));
		});

		await page.evaluate(() => {
			const f = document.getElementById("adminForm") || document.forms[0];
			f.task.value = "module.save";
			Joomla.submitform("module.save", f);
		});
		await page.waitForLoadState("networkidle").catch(() => {});
	} finally {
		await browser.close();
	}
}

for (const [versionLabel, instance] of Object.entries(INSTANCES)) {
	test(`Phase 23 frontend delivery & host isolation — Joomla ${versionLabel}`, async (t) => {
		const { composeFile, baseUrl } = instance;
		let sessionId;
		let noPlacementArticleUrl;
		let multiInstanceArticleUrl;
		let contentPlacementArticleUrl;
		const moduleFrontUrl = `${baseUrl}/`;

		await t.test("prepares a clean instance with the bundled seed Comparison", () => {
			resetExtensionState(composeFile);
			disableGuidedTours(composeFile);
			raiseUploadLimits(composeFile);

			const output = installPackage(composeFile);
			assert.match(output, /Extension installed successfully/);

			sessionId = dbQuery(composeFile, "SELECT session_id FROM joom_sameview_comparisons LIMIT 1;");
			assert.ok(sessionId, "a Comparison must already be stored after first install");
		});

		await t.test("creates the placement-free, multi-instance and single-content-placement articles", async () => {
			noPlacementArticleUrl = await createArticle(
				composeFile,
				baseUrl,
				`Phase 23 Unrelated Article — ${versionLabel}`,
				"Nothing SameView-related here.",
			);
			multiInstanceArticleUrl = await createArticle(
				composeFile,
				baseUrl,
				`Phase 23 Multi-Instance Article — ${versionLabel}`,
				`First placement: {sameview session="${sessionId}"} — some text in between — Second placement: {sameview session="${sessionId}"}`,
			);
			contentPlacementArticleUrl = await createArticle(
				composeFile,
				baseUrl,
				`Phase 23 Content Placement Article — ${versionLabel}`,
				`{sameview session="${sessionId}"}`,
			);
		});

		await t.test("A: a page without any SameView placement never requests the embed runtime or CSS", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				const embedRequests = [];
				page.on("request", (request) => {
					const url = request.url();
					if (url.includes("comparison-embed-runtime.js") || url.includes("comparison-embed.css")) {
						embedRequests.push(url);
					}
				});
				await page.goto(noPlacementArticleUrl, { waitUntil: "networkidle" });
				assert.deepEqual(embedRequests, [], "a page without any placement must never request the Embed runtime or CSS");
			} finally {
				await browser.close();
			}
		});

		let versionTokenBefore;
		await t.test("asset versioning: the embed script carries Joomla's native 'auto' version token, which changes after a real code update", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await page.goto(multiInstanceArticleUrl, { waitUntil: "networkidle" });
				const srcBefore = await page.locator('script[src*="comparison-embed-runtime.js"]').getAttribute("src");
				versionTokenBefore = new URL(srcBefore, baseUrl).search;
				assert.match(
					versionTokenBefore,
					/^\?[a-z0-9]+$/i,
					"the script must carry Joomla's own native ?<mediaversion> query token",
				);
			} finally {
				await browser.close();
			}

			// docs/IMPLEMENTATION_PLAN_V1.md Phase 23 analysis, mirrored on
			// ComparisonRenderHelper::enqueueEmbedAssets()'s own comment: a
			// genuine code-only reinstall of the already-installed package
			// (deliverable at all only since the Phase 22 update-lifecycle fix)
			// triggers Joomla's own Installer::install() -> flushAssets() ->
			// Version::refreshMediaVersion(), changing this script's own
			// effective URL with no product-code change needed here.
			const output = installPackage(composeFile);
			assert.match(output, /Extension installed successfully/);

			const browser2 = await chromium.launch();
			try {
				const page = await browser2.newPage();
				await page.goto(multiInstanceArticleUrl, { waitUntil: "networkidle" });
				const srcAfter = await page.locator('script[src*="comparison-embed-runtime.js"]').getAttribute("src");
				const versionTokenAfter = new URL(srcAfter, baseUrl).search;
				assert.match(versionTokenAfter, /^\?[a-z0-9]+$/i);
				assert.notEqual(
					versionTokenAfter,
					versionTokenBefore,
					"a real code-only package update must change the embed script's effective URL",
				);
			} finally {
				await browser2.close();
			}
		});

		await t.test("B: two simultaneous placements of the same Comparison on one page mount as independent instances", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await page.goto(multiInstanceArticleUrl, { waitUntil: "networkidle" });
				await page.waitForFunction(
					() =>
						document.querySelectorAll("[data-sameview-embed]").length === 2 &&
						Array.from(document.querySelectorAll("[data-sameview-embed]")).every(
							(el) => el.shadowRoot && el.shadowRoot.mode === "open",
						),
					{ timeout: 20000 },
				);
				await page.waitForFunction(
					() =>
						Array.from(document.querySelectorAll("[data-sameview-embed]")).every(
							(el) => !el.shadowRoot.querySelector(".comparison-slider__frame--loading"),
						),
					{ timeout: 30000 },
				);

				const canvasCounts = await page.evaluate(() =>
					Array.from(document.querySelectorAll("[data-sameview-embed]")).map(
						(el) => el.shadowRoot.querySelectorAll(".presentation-canvas").length,
					),
				);
				assert.deepEqual(canvasCounts, [1, 1], "each placement must own exactly one Presentation canvas");

				const firstSlider = page.locator('[data-sameview-embed] [role="slider"]').nth(0);
				const secondSlider = page.locator('[data-sameview-embed] [role="slider"]').nth(1);
				const firstBefore = await firstSlider.getAttribute("aria-valuenow");
				const secondBefore = await secondSlider.getAttribute("aria-valuenow");
				await firstSlider.focus();
				await page.keyboard.press("ArrowRight");
				await page.keyboard.press("ArrowRight");
				const firstAfter = await firstSlider.getAttribute("aria-valuenow");
				const secondAfter = await secondSlider.getAttribute("aria-valuenow");
				assert.notEqual(firstAfter, firstBefore, "instance A must react to its own keyboard interaction");
				assert.equal(secondAfter, secondBefore, "interacting with instance A must never change instance B");
			} finally {
				await browser.close();
			}
		});

		await t.test("C: host isolation holds against a real aggressive template stylesheet", async () => {
			await buildHostilePluginZip();
			copyIntoContainer(composeFile, HOSTILE_PLUGIN_ZIP, CONTAINER_HOSTILE_ZIP_PATH);
			const installOutput = joomlaCli(composeFile, `extension:install --path=${CONTAINER_HOSTILE_ZIP_PATH} -v`);
			assert.match(installOutput, /Extension installed successfully/);
			dbQuery(composeFile, "UPDATE joom_extensions SET enabled=1 WHERE element='sameviewhostiletest' AND folder='system';");

			try {
				const browser = await chromium.launch();
				try {
					const page = await browser.newPage();
					await page.goto(multiInstanceArticleUrl, { waitUntil: "networkidle" });
					await page.waitForFunction(
						() =>
							document.querySelectorAll("[data-sameview-embed]").length === 2 &&
							Array.from(document.querySelectorAll("[data-sameview-embed]")).every(
								(el) => el.shadowRoot && el.shadowRoot.querySelector(".presentation-canvas"),
							),
						{ timeout: 20000 },
					);

					const isolationCheck = await page.evaluate(() => {
						const embeds = Array.from(document.querySelectorAll("[data-sameview-embed]"));
						const results = embeds.map((embed) => {
							const canvas = embed.shadowRoot.querySelector(".presentation-canvas");
							const infoTitle = embed.shadowRoot.querySelector(
								".presentation-info__title, .presentation-info__time",
							);
							const canvasStyle = canvas ? getComputedStyle(canvas) : null;
							const infoStyle = infoTitle ? getComputedStyle(infoTitle) : null;
							return {
								infoFontFamily: infoStyle ? infoStyle.fontFamily : null,
								infoTextTransform: infoStyle ? infoStyle.textTransform : null,
								infoColor: infoStyle ? infoStyle.color : null,
								canvasBoxSizing: canvasStyle ? canvasStyle.boxSizing : null,
							};
						});
						const hostParagraph = document.querySelector(".item-page p, article p, main p");
						const hostColor = hostParagraph ? getComputedStyle(hostParagraph).color : null;
						return { results, hostColor };
					});

					for (const result of isolationCheck.results) {
						assert.doesNotMatch(
							result.infoFontFamily ?? "",
							/Comic Sans/i,
							"the hostile template's global font must not reach Presentation Information text",
						);
						assert.notEqual(result.infoTextTransform, "uppercase");
						// rgb(126, 34, 206) === #7e22ce, the hostile plugin's own
						// forced text color — must never reach inside the Shadow Root.
						assert.notEqual(result.infoColor, "rgb(126, 34, 206)");
						assert.equal(result.canvasBoxSizing, "border-box");
					}
					// The host's own paragraph, outside any placement, must still
					// show the hostile stylesheet's own color — proving SameView's
					// CSS never leaked out and overrode it.
					assert.equal(
						isolationCheck.hostColor,
						"rgb(126, 34, 206)",
						"the host page's own content must still be affected by its own (hostile) stylesheet",
					);
				} finally {
					await browser.close();
				}
			} finally {
				const pluginId = dbQuery(
					composeFile,
					"SELECT extension_id FROM joom_extensions WHERE element='sameviewhostiletest' AND folder='system';",
				);
				if (pluginId) {
					joomlaCli(composeFile, `extension:remove ${pluginId} -n -v`);
				}
			}
		});

		await t.test("D: a real Comparison update actually changes the served bytes for both the content and module placements", async () => {
			await buildUpdatedArtifact();
			await createModulePlacement(composeFile, baseUrl, sessionId, versionLabel);

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();

				await page.goto(contentPlacementArticleUrl, { waitUntil: "networkidle" });
				const contentSrcBefore = await page.evaluate(
					() => JSON.parse(document.querySelector("[data-sameview-embed]").getAttribute("data-sameview-embed")).assets.referenceSrc,
				);
				const contentBytesBefore = await (await page.request.get(contentSrcBefore)).body();

				await page.goto(moduleFrontUrl, { waitUntil: "networkidle" });
				const moduleSrcBefore = await page.evaluate(
					() => JSON.parse(document.querySelector("[data-sameview-embed]").getAttribute("data-sameview-embed")).assets.referenceSrc,
				);
				const moduleBytesBefore = await (await page.request.get(moduleSrcBefore)).body();

				await loginAsAdmin(page, baseUrl);
				await page.goto(`${baseUrl}/administrator/index.php?option=com_sameviewcomparisons&view=upload`);
				await page.setInputFiles('[data-testid="sameview-upload-file-input"]', UPDATED_ARTIFACT);
				await page.click('[data-testid="sameview-upload-submit"]');
				await page.waitForLoadState("networkidle").catch(() => {});

				const row = dbQuery(
					composeFile,
					`SELECT outcome_fingerprint FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`,
				);
				assert.match(row, /frontend-delivery-updated/, "the real Add comparison upload must have applied the update");

				await page.goto(contentPlacementArticleUrl, { waitUntil: "networkidle" });
				const contentSrcAfter = await page.evaluate(
					() => JSON.parse(document.querySelector("[data-sameview-embed]").getAttribute("data-sameview-embed")).assets.referenceSrc,
				);
				assert.notEqual(contentSrcAfter, contentSrcBefore, "the content placement's effective image URL must change after a real update");
				const contentBytesAfter = await (await page.request.get(contentSrcAfter)).body();
				assert.notEqual(
					Buffer.from(contentBytesAfter).toString("base64"),
					Buffer.from(contentBytesBefore).toString("base64"),
					"the content placement must actually serve the updated image bytes, not the old cached ones",
				);

				await page.goto(moduleFrontUrl, { waitUntil: "networkidle" });
				const moduleSrcAfter = await page.evaluate(
					() => JSON.parse(document.querySelector("[data-sameview-embed]").getAttribute("data-sameview-embed")).assets.referenceSrc,
				);
				assert.notEqual(moduleSrcAfter, moduleSrcBefore, "the module placement's effective image URL must change after a real update");
				const moduleBytesAfter = await (await page.request.get(moduleSrcAfter)).body();
				assert.notEqual(
					Buffer.from(moduleBytesAfter).toString("base64"),
					Buffer.from(moduleBytesBefore).toString("base64"),
					"the module placement must actually serve the updated image bytes, not the old cached ones",
				);
			} finally {
				await browser.close();
			}
		});
	});
}
