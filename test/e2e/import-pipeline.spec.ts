// Browser-only coverage for the import pipeline, per docs/AI_ENGINEERING_GUIDE.md
// "Testing": covers behavior that genuinely depends on real browser APIs
// (image decoding) and one end-to-end import path, using the test-only
// harness at test/e2e/harness/. It does not repeat pure-logic cases already
// covered by test/unit/ or test/integration/.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
);

async function readFixtureBase64(...segments: string[]): Promise<string> {
	const bytes = await readFile(join(fixturesDir, ...segments));
	return bytes.toString("base64");
}

test.beforeEach(async ({ page }) => {
	await page.goto("/");
});

test("browser-side archive validation accepts a real, small, well-formed ZIP", async ({
	page,
}) => {
	const base64 = await readFixtureBase64("archives", "valid-small.zip");
	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		return window.__importHarness__.validateArchive(bytes);
	}, base64);
	expect(result.ok).toBe(true);
});

test("browser-side archive validation rejects a nested ZIP entry", async ({
	page,
}) => {
	const base64 = await readFixtureBase64("archives", "nested-zip-entry.zip");
	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		return window.__importHarness__.validateArchive(bytes);
	}, base64);
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.error.code).toBe("nested-archive-entry");
});

test("browser-side session resolution resolves the one session in a valid archive", async ({
	page,
}) => {
	const base64 = await readFixtureBase64("archives", "valid-small.zip");
	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const archiveResult = await window.__importHarness__.validateArchive(bytes);
		if (!archiveResult.ok) return archiveResult;
		return window.__importHarness__.resolveImportedSession(
			bytes,
			archiveResult.entries,
		);
	}, base64);
	expect(result.ok).toBe(true);
	if (result.ok)
		expect(result.value.sessionDirectory).toBe("2024-01-15_10-30-00");
});

test("browser-side session resolution rejects a multi-session archive", async ({
	page,
}) => {
	const base64 = await readFixtureBase64("archives", "multi-session.zip");
	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const archiveResult = await window.__importHarness__.validateArchive(bytes);
		if (!archiveResult.ok) return archiveResult;
		return window.__importHarness__.resolveImportedSession(
			bytes,
			archiveResult.entries,
		);
	}, base64);
	expect(result.ok).toBe(false);
	if (!result.ok)
		expect(result.error.code).toBe("multiple-session-directories");
});

test("decodes a valid image and reports its dimensions", async ({ page }) => {
	const base64 = await readFixtureBase64("images", "tiny-valid.png");
	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		return window.__importHarness__.validateImageContent(bytes);
	}, base64);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.width).toBe(4);
		expect(result.height).toBe(4);
	}
});

test("rejects non-image bytes under an image filename", async ({ page }) => {
	const base64 = await readFixtureBase64("images", "non-image-bytes.png");
	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		return window.__importHarness__.validateImageContent(bytes);
	}, base64);
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.error.code).toBe("undecodable-image");
});

test("rejects truncated/unreadable image content", async ({ page }) => {
	const base64 = await readFixtureBase64("images", "truncated.png");
	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		return window.__importHarness__.validateImageContent(bytes);
	}, base64);
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.error.code).toBe("undecodable-image");
});

test("rejects a decoded image over the 40-megapixel limit", async ({
	page,
}) => {
	const base64 = await readFixtureBase64("images", "oversized.png");
	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		return window.__importHarness__.validateImageContent(bytes);
	}, base64);
	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.error.code).toBe("image-too-large");
		if (result.error.code === "image-too-large") {
			expect(result.error.width * result.error.height).toBeGreaterThan(
				40_000_000,
			);
		}
	}
});

// Uses sample-v6-session_full.zip (not _minimal.zip): this test exercises
// only the browser-only decode step, which is identical code for both real
// fixtures — the fixtures differ in optional-file/metadata content, already
// covered per-fixture in test/integration/android-export-fixture.test.mjs,
// not in anything relevant to image decoding. Running this same flow again
// for _minimal.zip would duplicate the identical decode assertion without
// exercising a new code path, so only the richer fixture is used here.
test("one complete valid import flow using the real Android export fixture", async ({
	page,
}) => {
	const base64 = await readFixtureBase64(
		"android-export",
		"sample-v6-session_full.zip",
	);

	const result = await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

		const archiveResult = await window.__importHarness__.validateArchive(bytes);
		if (!archiveResult.ok) {
			return { step: "archive" as const, ok: false as const };
		}

		const sessionResult = await window.__importHarness__.resolveImportedSession(
			bytes,
			archiveResult.entries,
		);
		if (!sessionResult.ok) {
			return { step: "resolve" as const, ok: false as const };
		}

		const referenceBytes = await window.__importHarness__.readEntryBytes(
			bytes,
			sessionResult.value.referenceFilePath,
		);
		const captureBytes = await window.__importHarness__.readEntryBytes(
			bytes,
			sessionResult.value.captureFilePath,
		);
		if (!referenceBytes || !captureBytes) {
			return { step: "read-bytes" as const, ok: false as const };
		}

		const referenceImage =
			await window.__importHarness__.validateImageContent(referenceBytes);
		const captureImage =
			await window.__importHarness__.validateImageContent(captureBytes);

		return {
			step: "done" as const,
			ok: referenceImage.ok && captureImage.ok,
			sessionDirectory: sessionResult.value.sessionDirectory,
			referenceImageOk: referenceImage.ok,
			captureImageOk: captureImage.ok,
		};
	}, base64);

	expect(result.step).toBe("done");
	expect(result.ok).toBe(true);
	if (result.step === "done") {
		expect(result.referenceImageOk).toBe(true);
		expect(result.captureImageOk).toBe(true);
	}
});
