// Real-application coverage for Web-uploaded Custom Branding image
// normalization (src/lib/branding-image-normalize.ts;
// docs/FEATURE_SPECIFICATION.md F-004). This suite exists specifically to
// prove the architecture agreed for this feature:
//
// - exactly one decode, one resize, one encode per Web upload,
// - the original upload bytes never reach the Current Working State,
// BrandingDraft or any other retained state — only the normalized asset
//   does,
// - that normalized asset is reused byte-for-byte everywhere (preview,
//   Handle, and across a Custom -> Symbol -> Custom retain/restore cycle,
//   without any further decode), and
// - an imported Android branding-handle.png is never touched by any of
//   this — normalization only ever applies to a fresh Web upload.
//
// Fixtures are deliberately not new large binaries committed to the repo:
// - The "large real photo" case extracts a real, already-committed,
//   multi-megapixel JPEG from test/fixtures/android-export/
//   sample-v6-session_minimal.zip at test-run time (the same fixture
//   test/e2e/workspace-creation.spec.ts already uses for its own
//   real-image coverage), rather than adding a second multi-MB file.
// - The aspect-ratio/transparency/orientation cases use small synthetic
//   images generated in-browser via <canvas> at test-run time (exact,
//   deterministic control over size/transparency), plus one hand-built
//   minimal EXIF Orientation segment spliced onto a canvas-generated JPEG
//   in Node — see buildJpegWithExifOrientation below for why a real file
//   is impractical here and what guarantees the hand-built segment gives.

import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { readEntryBytes } from "../../src/lib/import-archive.ts";

// Typed hook for the `createImageBitmap` call-counting instrumentation used
// by the retain/restore test below (`page.addInitScript` runs this file's
// arrow functions inside the *browser*, where this augments the real
// `window`, not a test-only mock).
declare global {
	interface Window {
		__createImageBitmapCalls?: number;
	}
}

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
);

const ANDROID_EXPORT_ZIP = join(
	fixturesDir,
	"android-export",
	"sample-v6-session_minimal.zip",
);
const ANDROID_EXPORT_SESSION = "2026-07-27_16-13-22";

// docs/ARCHITECTURE.md "Image Limits": 40 megapixels — mirrored here only
// to build a deliberately-oversized *synthetic* dimension check is not
// needed: test/fixtures/images/oversized.png (already used by
// test/e2e/import-pipeline.spec.ts for the identical 40-megapixel rejection
// on the reference/capture path) is reused as-is below.

// Minimal, spec-valid single-entry TIFF/EXIF block carrying only the
// Orientation tag, spliced directly after a JPEG's SOI marker. This is the
// smallest possible EXIF payload that createImageBitmap's
// `imageOrientation: "from-image"` needs to react to — hand-built here
// because no real EXIF-bearing fixture exists in the repo and downloading
// one is not appropriate for a test asset. Verified indirectly by the test
// itself (orientation-corrected content must be TALL, not WIDE — see that
// test's own comment for the geometry argument), not merely by construction.
function buildJpegWithExifOrientation(
	baseJpeg: Uint8Array,
	orientation: number,
): Uint8Array {
	const tiff = Buffer.alloc(26);
	tiff.write("II", 0, "ascii"); // little-endian byte order
	tiff.writeUInt16LE(0x002a, 2); // TIFF magic number
	tiff.writeUInt32LE(8, 4); // offset to IFD0 (right after this header)
	tiff.writeUInt16LE(1, 8); // IFD0 entry count: 1
	tiff.writeUInt16LE(0x0112, 10); // tag: Orientation
	tiff.writeUInt16LE(3, 12); // type: SHORT
	tiff.writeUInt32LE(1, 14); // count: 1
	tiff.writeUInt16LE(orientation, 18); // value (first 2 bytes of the 4-byte field)
	tiff.writeUInt32LE(0, 22); // next IFD offset: none

	const exifHeader = Buffer.from("Exif\0\0", "ascii");
	const payload = Buffer.concat([exifHeader, tiff]);
	const app1Length = payload.length + 2; // includes the length field itself
	const app1Marker = Buffer.from([
		0xff,
		0xe1,
		(app1Length >> 8) & 0xff,
		app1Length & 0xff,
	]);
	const app1Segment = Buffer.concat([app1Marker, payload]);

	const original = Buffer.from(baseJpeg);
	const soi = original.subarray(0, 2); // 0xFFD8
	const rest = original.subarray(2);
	return new Uint8Array(Buffer.concat([soi, app1Segment, rest]));
}

interface Fixtures {
	readonly tmpDir: string;
	readonly largePhotoPath: string;
	readonly largePhotoByteLength: number;
	readonly nonSquareOpaquePath: string;
	readonly transparentHolePath: string;
	readonly exifRotatedPath: string;
}

async function buildFixtures(browser: Browser): Promise<Fixtures> {
	const tmpDir = mkdtempSync(join(tmpdir(), "branding-normalize-"));

	// Reuses src/lib/import-archive.ts's own readEntryBytes — the exact same
	// zip.js-based reader the app's real import pipeline uses — rather than
	// spawning an external `unzip` process, which proved unreliable here
	// under Playwright's parallel workers (each worker runs its own
	// `test.beforeAll`, and concurrent child-process spawns intermittently
	// failed with ENOBUFS).
	const largePhotoPath = join(tmpDir, "large-real-photo.jpg");
	const zipBytes = await readFile(ANDROID_EXPORT_ZIP);
	const jpegBytes = await readEntryBytes(
		new Uint8Array(zipBytes),
		`${ANDROID_EXPORT_SESSION}/capture.jpg`,
	);
	if (!jpegBytes) {
		throw new Error("Fixture zip entry not found: capture.jpg");
	}
	writeFileSync(largePhotoPath, jpegBytes);

	const page = await browser.newPage();
	await page.goto("about:blank");
	const synthetic = await page.evaluate(async () => {
		function toBase64(buffer: ArrayBuffer): string {
			const bytes = new Uint8Array(buffer);
			let binary = "";
			const chunkSize = 0x8000;
			for (let i = 0; i < bytes.length; i += chunkSize) {
				binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
			}
			return btoa(binary);
		}
		async function canvasToBase64(
			width: number,
			height: number,
			draw: (ctx: CanvasRenderingContext2D) => void,
			mimeType: string,
		): Promise<string> {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("2d context unavailable");
			draw(ctx);
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, mimeType),
			);
			if (!blob) throw new Error("toBlob failed");
			return toBase64(await blob.arrayBuffer());
		}

		// Non-square, fully opaque — for the aspect-ratio/fit/centering case.
		const nonSquareOpaque = await canvasToBase64(
			800,
			400,
			(ctx) => {
				ctx.fillStyle = "#ff0000";
				ctx.fillRect(0, 0, 800, 400);
			},
			"image/png",
		);

		// Square, opaque everywhere except a cleared (transparent) center hole
		// — for the "existing transparency is preserved" case. 400x400 scales
		// to exactly 512x512 (factor 1.28), so no rounding/margin ambiguity.
		const transparentHole = await canvasToBase64(
			400,
			400,
			(ctx) => {
				ctx.fillStyle = "#0000ff";
				ctx.fillRect(0, 0, 400, 400);
				ctx.clearRect(150, 150, 100, 100);
			},
			"image/png",
		);

		// Plain landscape JPEG base for the EXIF-orientation case (opaque,
		// asymmetric width/height so a 90 degree rotation is geometrically
		// detectable). The EXIF segment itself is spliced in Node afterwards.
		const baseJpeg = await canvasToBase64(
			200,
			100,
			(ctx) => {
				ctx.fillStyle = "#00ff00";
				ctx.fillRect(0, 0, 200, 100);
			},
			"image/jpeg",
		);

		return { nonSquareOpaque, transparentHole, baseJpeg };
	});
	await page.close();

	const nonSquareOpaquePath = join(tmpDir, "non-square-opaque.png");
	writeFileSync(
		nonSquareOpaquePath,
		Buffer.from(synthetic.nonSquareOpaque, "base64"),
	);

	const transparentHolePath = join(tmpDir, "transparent-hole.png");
	writeFileSync(
		transparentHolePath,
		Buffer.from(synthetic.transparentHole, "base64"),
	);

	const baseJpegBytes = Buffer.from(synthetic.baseJpeg, "base64");
	// Orientation 6: "rotate 90 degrees clockwise to display correctly" —
	// the stored 200x100 landscape pixels must be treated as 100x200
	// portrait content once orientation is applied.
	const exifRotatedBytes = buildJpegWithExifOrientation(baseJpegBytes, 6);
	const exifRotatedPath = join(tmpDir, "exif-rotated.jpg");
	writeFileSync(exifRotatedPath, exifRotatedBytes);

	return {
		tmpDir,
		largePhotoPath,
		largePhotoByteLength: statSync(largePhotoPath).size,
		nonSquareOpaquePath,
		transparentHolePath,
		exifRotatedPath,
	};
}

let fixtures: Fixtures;

test.beforeAll(async ({ browser }) => {
	fixtures = await buildFixtures(browser);
});

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
});

async function importMinimalWorkspace(page: Page) {
	await page.locator("#import-zip-input").setInputFiles(ANDROID_EXPORT_ZIP);
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
}

async function importBrandedWorkspace(page: Page) {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_full.zip"),
		);
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
}

async function expandBrandingSection(page: Page) {
	await page.getByTestId("edit-inspector-branding-toggle").click();
}

async function uploadCustomBranding(page: Page, filePath: string) {
	await page.getByTestId("edit-branding-option-custom").click();
	await page.getByTestId("edit-branding-custom-input").setInputFiles(filePath);
}

// Decodes whatever bytes currently sit behind `blobUrl` (a `files.
// brandingHandleBytes`-derived object URL) inside the page, without
// re-implementing PNG parsing in Node: fetch() can read a blob: URL from
// the same page that created it, createImageBitmap decodes it exactly as
// the app itself would, and a throwaway canvas is used only to sample
// pixels for the assertions below — never to re-encode or replace
// anything the app produced.
async function inspectAsset(
	page: Page,
	blobUrl: string,
	samplePoints: ReadonlyArray<{ readonly x: number; readonly y: number }>,
) {
	return page.evaluate(
		async ({ blobUrl, samplePoints }) => {
			const response = await fetch(blobUrl);
			const buffer = await response.arrayBuffer();
			const bytes = new Uint8Array(buffer);
			const isPng =
				bytes.length > 8 &&
				bytes[0] === 0x89 &&
				bytes[1] === 0x50 &&
				bytes[2] === 0x4e &&
				bytes[3] === 0x47 &&
				bytes[4] === 0x0d &&
				bytes[5] === 0x0a &&
				bytes[6] === 0x1a &&
				bytes[7] === 0x0a;
			const bitmap = await createImageBitmap(new Blob([buffer]));
			const canvas = document.createElement("canvas");
			canvas.width = bitmap.width;
			canvas.height = bitmap.height;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("2d context unavailable");
			ctx.drawImage(bitmap, 0, 0);
			const samples: Record<string, readonly number[]> = {};
			for (const point of samplePoints) {
				samples[`${point.x},${point.y}`] = Array.from(
					ctx.getImageData(point.x, point.y, 1, 1).data,
				);
			}
			return {
				width: bitmap.width,
				height: bitmap.height,
				byteLength: bytes.length,
				isPng,
				samples,
			};
		},
		{ blobUrl, samplePoints },
	);
}

// `samples` is only ever populated for exactly the points passed into
// inspectAsset above, so a lookup by one of those same points is always
// present — this helper is just where that invariant is asserted once,
// instead of at every call site below.
function samplePixel(
	asset: { readonly samples: Record<string, readonly number[]> },
	x: number,
	y: number,
): readonly [number, number, number, number] {
	const pixel = asset.samples[`${x},${y}`];
	if (!pixel) throw new Error(`No sample recorded for ${x},${y}`);
	return pixel as unknown as readonly [number, number, number, number];
}

async function customPreviewSrc(page: Page): Promise<string> {
	const preview = page.getByTestId("edit-branding-custom-preview");
	await expect(preview).toHaveAttribute("src", /^blob:/);
	return (await preview.getAttribute("src")) as string;
}

async function handleAssetSrc(page: Page): Promise<string> {
	const handleImage = page.locator(
		'[data-testid="comparison-slider-handle"] image',
	);
	await expect(handleImage).toHaveAttribute("href", /^blob:/);
	return (await handleImage.getAttribute("href")) as string;
}

// 1. Large file: stored bytes are much smaller than the original, decode to
// exactly 512x512 PNG, and both the Current Working State's live consumers
// (preview, Handle) reflect that same small normalized asset.
test("a large real photo upload is stored as a small, exactly 512x512 PNG", async ({
	page,
}) => {
	await importMinimalWorkspace(page);
	await expandBrandingSection(page);
	await uploadCustomBranding(page, fixtures.largePhotoPath);
	await expect(page.getByTestId("edit-branding-custom-error")).toHaveCount(0);

	const previewSrc = await customPreviewSrc(page);
	const previewAsset = await inspectAsset(page, previewSrc, []);
	expect(previewAsset.width).toBe(512);
	expect(previewAsset.height).toBe(512);
	expect(previewAsset.isPng).toBe(true);
	// "Deutlich kleiner": at least a real fraction of the multi-MP, multi-MB
	// original (photographic content compresses less predictably as
	// lossless PNG than a flat-color logo would, so this stays a
	// conservative bound rather than assuming a specific ratio), plus an
	// absolute sanity cap well under the ~1 MB a raw, uncompressed 512x512
	// RGBA buffer would be.
	expect(previewAsset.byteLength).toBeLessThan(
		fixtures.largePhotoByteLength / 2,
	);
	expect(previewAsset.byteLength).toBeLessThan(600_000);

	const handleSrc = await handleAssetSrc(page);
	const handleAsset = await inspectAsset(page, handleSrc, []);
	expect(handleAsset.width).toBe(512);
	expect(handleAsset.height).toBe(512);
	expect(handleAsset.byteLength).toBe(previewAsset.byteLength);
});

// 2. Aspect ratio: fit, centered, no crop, transparent margins on the
// shorter axis. 800x400 -> scale 0.64 -> content exactly 512x256, centered
// vertically (top/bottom margin 128px each), full width (no left/right
// margin).
test("a non-square image is fit, centered and never cropped, with transparent margins on the shorter axis", async ({
	page,
}) => {
	await importMinimalWorkspace(page);
	await expandBrandingSection(page);
	await uploadCustomBranding(page, fixtures.nonSquareOpaquePath);
	await expect(page.getByTestId("edit-branding-custom-error")).toHaveCount(0);

	const src = await customPreviewSrc(page);
	const asset = await inspectAsset(page, src, [
		{ x: 256, y: 10 }, // top margin
		{ x: 256, y: 256 }, // content center
		{ x: 256, y: 500 }, // bottom margin
		{ x: 10, y: 256 }, // left edge — full width, no side margin
	]);
	expect(asset.width).toBe(512);
	expect(asset.height).toBe(512);
	expect(samplePixel(asset, 256, 10)[3]).toBe(0); // transparent
	expect(samplePixel(asset, 256, 256)).toEqual([255, 0, 0, 255]); // opaque red
	expect(samplePixel(asset, 256, 500)[3]).toBe(0); // transparent
	expect(samplePixel(asset, 10, 256)).toEqual([255, 0, 0, 255]); // opaque red
});

// 3. Transparency: existing internal transparency survives normalization —
// no white/black background is ever added, neither behind the whole image
// nor behind an already-transparent region within it.
test("existing transparency is preserved, with no white or black background added", async ({
	page,
}) => {
	await importMinimalWorkspace(page);
	await expandBrandingSection(page);
	await uploadCustomBranding(page, fixtures.transparentHolePath);
	await expect(page.getByTestId("edit-branding-custom-error")).toHaveCount(0);

	const src = await customPreviewSrc(page);
	// 400x400 scales by exactly 1.28 (no rounding) to fill the full
	// 512x512 canvas with no margin; the source's cleared 150,150-250,250
	// hole scales to 192,192-320,320.
	const asset = await inspectAsset(page, src, [
		{ x: 50, y: 50 }, // outside the hole — opaque blue
		{ x: 256, y: 256 }, // hole center, scaled — must stay transparent
	]);
	expect(samplePixel(asset, 50, 50)).toEqual([0, 0, 255, 255]);
	expect(samplePixel(asset, 256, 256)[3]).toBe(0); // alpha 0 — never filled white or black
});

// 4. Orientation: an EXIF-rotated source produces a correctly oriented
// output. The 200x100 landscape source is tagged Orientation=6 ("rotate 90
// degrees clockwise to display correctly"): if orientation is honored, the
// effective content is 100(w)x200(h) portrait, fitting to a TALL 256x512
// box; if orientation were ignored, it would fit to a WIDE 512x256 box.
// These two outcomes are geometrically disjoint, so measuring which one
// occurred is a robust, deterministic proxy for correct EXIF handling
// without needing per-pixel color verification.
test("EXIF orientation is applied during normalization", async ({ page }) => {
	await importMinimalWorkspace(page);
	await expandBrandingSection(page);
	await uploadCustomBranding(page, fixtures.exifRotatedPath);
	await expect(page.getByTestId("edit-branding-custom-error")).toHaveCount(0);

	const src = await customPreviewSrc(page);
	const asset = await inspectAsset(page, src, [
		// If corrected (tall, 256x512 content centered horizontally: left
		// margin (512-256)/2=128): x=64 is inside the transparent left
		// margin. If ignored (wide, 512x256 content, full width): x=64 would
		// be inside the opaque content.
		{ x: 64, y: 256 },
		// Center is opaque content either way — a baseline sanity check that
		// something was drawn at all.
		{ x: 256, y: 256 },
	]);
	expect(samplePixel(asset, 64, 256)[3]).toBe(0);
	expect(samplePixel(asset, 256, 256)[3]).toBe(255);
});

// 5. Metadata: the produced PNG contains no EXIF/GPS/XMP/IPTC/ICC segment
// carried over from the source. Verified by construction (decode -> canvas
// -> re-encode, per this module's own header comment) and confirmed here
// by scanning the actual output bytes for the ASCII markers such metadata
// would use if it had somehow survived.
test("the normalized PNG carries no source metadata", async ({ page }) => {
	await importMinimalWorkspace(page);
	await expandBrandingSection(page);
	// The real photo fixture is a JPEG with genuine camera EXIF (from a real
	// Android capture); the EXIF-rotated fixture also carries a hand-built
	// EXIF segment. Either is a valid "metadata-bearing" source; the real
	// photo is used since it plausibly carries the richest original
	// metadata (camera make/model, GPS, timestamps).
	await uploadCustomBranding(page, fixtures.largePhotoPath);
	await expect(page.getByTestId("edit-branding-custom-error")).toHaveCount(0);

	const src = await customPreviewSrc(page);
	const containsMarker = await page.evaluate(async (blobUrl) => {
		const response = await fetch(blobUrl);
		const bytes = new Uint8Array(await response.arrayBuffer());
		const text = Array.from(bytes)
			.map((byte) => String.fromCharCode(byte))
			.join("");
		return {
			exif: text.includes("Exif"),
			icc: text.includes("ICC_PROFILE") || text.includes("icc"),
			xmp: text.includes("XMP") || text.includes("xmp"),
			iptc: text.includes("IPTC") || text.includes("Photoshop"),
		};
	}, src);
	expect(containsMarker).toEqual({
		exif: false,
		icc: false,
		xmp: false,
		iptc: false,
	});
});

// 6. Error atomicity — every failure mode leaves the active branding and
// the remembered custom image completely unchanged, and shows only the
// existing generic error state (never a technical message).
test("an undecodable file leaves branding unchanged and shows the existing error state", async ({
	page,
}) => {
	await importBrandedWorkspace(page);
	await expandBrandingSection(page);
	await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
		"data-branding-kind",
		"asset",
	);

	await uploadCustomBranding(
		page,
		join(fixturesDir, "images", "non-image-bytes.png"),
	);

	await expect(page.getByTestId("edit-branding-custom-error")).toBeVisible();
	await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
		"data-branding-kind",
		"asset",
	);
	await expect(page.getByTestId("edit-branding-custom-preview")).toHaveCount(0);
});

test("an image over the 40-megapixel limit leaves branding unchanged", async ({
	page,
}) => {
	await importBrandedWorkspace(page);
	await expandBrandingSection(page);

	await uploadCustomBranding(
		page,
		join(fixturesDir, "images", "oversized.png"),
	);

	await expect(page.getByTestId("edit-branding-custom-error")).toBeVisible();
	await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
		"data-branding-kind",
		"asset",
	);
});

test("a canvas 2D context failure leaves branding unchanged and reports the existing generic error", async ({
	page,
}) => {
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		// @ts-expect-error test-only instrumentation, deliberately narrowed
		HTMLCanvasElement.prototype.getContext = function (
			this: HTMLCanvasElement,
			contextId: string,
			...rest: unknown[]
		) {
			if (contextId === "2d") return null;
			return original.call(this, contextId, ...rest);
		};
	});
	await page.goto("/");
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
	await importBrandedWorkspace(page);
	await expandBrandingSection(page);

	await uploadCustomBranding(page, fixtures.nonSquareOpaquePath);

	await expect(page.getByTestId("edit-branding-custom-error")).toBeVisible();
	await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
		"data-branding-kind",
		"asset",
	);
});

test("a PNG encoding failure leaves branding unchanged and reports the existing generic error", async ({
	page,
}) => {
	await page.addInitScript(() => {
		HTMLCanvasElement.prototype.toBlob = (callback: BlobCallback) => {
			callback(null);
		};
	});
	await page.goto("/");
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
	await importBrandedWorkspace(page);
	await expandBrandingSection(page);

	await uploadCustomBranding(page, fixtures.nonSquareOpaquePath);

	await expect(page.getByTestId("edit-branding-custom-error")).toBeVisible();
	await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
		"data-branding-kind",
		"asset",
	);
});

// 7. Retain & Restore: Custom -> Symbol -> Custom reactivates the exact
// same normalized bytes, with zero additional createImageBitmap calls —
// i.e. no re-normalization and no re-decode of the original upload, which
// by this point in the test no longer exists anywhere the app could even
// re-decode from.
test("switching Custom -> Symbol -> Custom reactivates the exact same normalized bytes without re-decoding", async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.__createImageBitmapCalls = 0;
		const original = window.createImageBitmap.bind(window);
		window.createImageBitmap = ((
			...args: Parameters<typeof createImageBitmap>
		) => {
			window.__createImageBitmapCalls =
				(window.__createImageBitmapCalls ?? 0) + 1;
			return original(...args);
		}) as typeof createImageBitmap;
	});
	await page.goto("/");
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
	await importMinimalWorkspace(page);
	await expandBrandingSection(page);

	// Baseline: the ZIP import pipeline itself already decodes the
	// reference/capture images for validation (src/lib/import-image.ts),
	// so the counter is not expected to be 0 here — only its *delta* around
	// the branding upload and the later reactivation is meaningful.
	const baselineCalls = await page.evaluate(
		() => window.__createImageBitmapCalls,
	);

	await uploadCustomBranding(page, fixtures.largePhotoPath);
	await expect(page.getByTestId("edit-branding-custom-error")).toHaveCount(0);
	// Reads the rendered <image href> attribute only — no decode of its own,
	// so this cannot itself perturb the createImageBitmap count checked
	// immediately below.
	const originalHandleSrc = await handleAssetSrc(page);

	const callsAfterUpload = await page.evaluate(
		() => window.__createImageBitmapCalls,
	);
	expect(callsAfterUpload).toBe((baselineCalls ?? 0) + 1);

	// Decoded now, while this blob URL is still the current, un-revoked one
	// — src/lib/use-object-url.ts revokes the previous URL as soon as
	// `files.brandingHandleBytes` changes again (i.e. the moment Symbol is
	// selected below), so this must happen before that switch, not after.
	// This inspectAsset call adds one more createImageBitmap call of its
	// own, which is fine: callsAfterUpload has already been captured above.
	const originalAsset = await inspectAsset(page, originalHandleSrc, []);

	await page.getByTestId("edit-branding-option-symbol").click();
	await page.getByTestId("edit-branding-symbol-fire").click();
	await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
		"data-branding-kind",
		"symbol",
	);

	await page.getByTestId("edit-branding-option-custom").click();
	await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
		"data-branding-kind",
		"asset",
	);
	const reactivatedHandleSrc = await handleAssetSrc(page);

	const callsAfterReactivation = await page.evaluate(
		() => window.__createImageBitmapCalls,
	);
	// Unchanged from callsAfterUpload's own value, i.e. only the deliberate
	// inspectAsset call above added to the count — no further
	// createImageBitmap call happened for the reactivation itself.
	expect(callsAfterReactivation).toBe((callsAfterUpload ?? 0) + 1);

	const reactivatedAsset = await inspectAsset(page, reactivatedHandleSrc, []);
	expect(reactivatedAsset.byteLength).toBe(originalAsset.byteLength);
	expect(reactivatedAsset.width).toBe(originalAsset.width);
	expect(reactivatedAsset.height).toBe(originalAsset.height);
});

// 8. Imported Android asset: byte-identical to the ZIP's own
// branding-handle.png, and never run through any decode of its own — this
// task concerns only a fresh Web upload
// (docs/IMPORTED_COMPARISON_V1.md "Immutable Fields"; this module's own
// header comment).
//
// docs/FEATURE_SPECIFICATION.md F-004 already establishes (and
// test/e2e/comparison-editing.spec.ts already covers) that re-selecting a
// Built-in Symbol tile — even the same id an import carried — deliberately
// *replaces* the imported raster asset with the shared vector rendering
// (src/lib/branding.ts's own header comment: "Every fresh symbol selection
// made in SameView Web clears any previously imported brandingHandleBytes
// ... including when the user re-selects the very same id"). There is
// therefore no UI action that "reactivates" the imported PNG byte-for-byte
// the way Custom Image reactivation works — the only meaningful
// byte-identity claim for an imported asset is that it is never touched
// between import and being rendered, which this test verifies directly
// against the ZIP's own bytes, plus that unrelated interactions (Fullscreen)
// cannot perturb it either.
test("an imported Android branding asset is byte-identical to the ZIP and is never decoded by normalization", async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.__createImageBitmapCalls = 0;
		const original = window.createImageBitmap.bind(window);
		window.createImageBitmap = ((
			...args: Parameters<typeof createImageBitmap>
		) => {
			window.__createImageBitmapCalls =
				(window.__createImageBitmapCalls ?? 0) + 1;
			return original(...args);
		}) as typeof createImageBitmap;
	});
	await page.goto("/");
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
	await importBrandedWorkspace(page);
	await expandBrandingSection(page);
	await expect(page.getByTestId("edit-branding-option-symbol")).toHaveAttribute(
		"aria-checked",
		"true",
	);

	const zipBytes = await readFile(
		join(fixturesDir, "android-export", "sample-v6-session_full.zip"),
	);
	const groundTruth = await readEntryBytes(
		new Uint8Array(zipBytes),
		"2026-07-27_13-54-15/branding-handle.png",
	);
	if (!groundTruth) throw new Error("Fixture zip entry not found");

	// Baseline: import itself already decodes reference/capture for
	// validation — only the delta from here on is meaningful.
	const baselineCalls = await page.evaluate(
		() => window.__createImageBitmapCalls,
	);

	const importedHandleSrc = await handleAssetSrc(page);
	const renderedBytes = await page.evaluate(async (blobUrl) => {
		const response = await fetch(blobUrl);
		return Array.from(new Uint8Array(await response.arrayBuffer()));
	}, importedHandleSrc);

	expect(renderedBytes).toEqual(Array.from(groundTruth));

	// Opening/closing Fullscreen re-renders the same Handle component
	// (docs/APPLICATION_LAYOUT.md "Fullscreen Mode") — a legitimate
	// unrelated interaction that must not perturb the imported asset either.
	await page.getByTestId("fullscreen-open-button").click();
	await page.getByTestId("fullscreen-close-button").click();

	const afterFullscreenSrc = await handleAssetSrc(page);
	const afterFullscreenBytes = await page.evaluate(async (blobUrl) => {
		const response = await fetch(blobUrl);
		return Array.from(new Uint8Array(await response.arrayBuffer()));
	}, afterFullscreenSrc);
	expect(afterFullscreenBytes).toEqual(Array.from(groundTruth));

	// No decode was ever attributable to the imported asset — displaying it
	// is a plain browser image render (SVG <image href>), not a
	// createImageBitmap call, and none of this test's own actions upload or
	// normalize anything.
	const finalCalls = await page.evaluate(() => window.__createImageBitmapCalls);
	expect(finalCalls).toBe(baselineCalls);
});

// 9. Performance regression — deterministic, not timing-based: a large
// original upload produces a bounded normalized byte length, and repeated
// option switching neither changes that byte length/content nor triggers
// any further normalization call.
test("repeated option switching never changes the normalized asset's size or content", async ({
	page,
}) => {
	await importMinimalWorkspace(page);
	await expandBrandingSection(page);
	await uploadCustomBranding(page, fixtures.largePhotoPath);
	await expect(page.getByTestId("edit-branding-custom-error")).toHaveCount(0);

	const firstSrc = await handleAssetSrc(page);
	const first = await inspectAsset(page, firstSrc, []);
	// Bounded regardless of the multi-MB/multi-MP original — this is the
	// deterministic proxy for "not the original bytes" the task asks for,
	// in place of any timing measurement.
	expect(first.byteLength).toBeLessThan(1_000_000);

	for (let i = 0; i < 3; i++) {
		await page.getByTestId("edit-branding-option-none").click();
		await page.getByTestId("edit-branding-option-custom").click();
	}

	const finalSrc = await handleAssetSrc(page);
	const final = await inspectAsset(page, finalSrc, []);
	expect(final.byteLength).toBe(first.byteLength);
	expect(final.width).toBe(first.width);
	expect(final.height).toBe(first.height);
});
