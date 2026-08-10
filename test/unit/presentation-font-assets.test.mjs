// Coverage for src/lib/presentation-font-assets.ts — the font-ID-to-asset
// packaging map and `buildFontFaceCss`, the one place a generated
// Standalone HTML/Static Microsite resolves which physical font file(s) to
// embed/copy. Guards the "only the selected Presentation Font is ever
// bundled" rule (docs/APPLICATION_LAYOUT.md "Standalone HTML"/"Static
// Microsite") and the resolved Inter/Manrope/Space Grotesk packaging
// decision (docs/IMPLEMENTATION_PLAN_V1.md Phase 8b).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildFontFaceCss,
	getPresentationFontAsset,
} from "../../src/lib/presentation-font-assets.ts";

describe("getPresentationFontAsset", () => {
	test("Inter and Space Grotesk each resolve to exactly one variable WOFF2 file", () => {
		assert.equal(getPresentationFontAsset("inter").files.length, 1);
		assert.equal(
			getPresentationFontAsset("inter").files[0].path,
			"inter/InterVariable.woff2",
		);
		assert.equal(getPresentationFontAsset("space-grotesk").files.length, 1);
		assert.equal(
			getPresentationFontAsset("space-grotesk").files[0].path,
			"spacegrotesk/SpaceGrotesk-Variable.woff2",
		);
	});

	test("Manrope resolves to exactly three static instances at 400/500/600", () => {
		const asset = getPresentationFontAsset("manrope");
		assert.equal(asset.files.length, 3);
		assert.deepEqual(
			asset.files.map((file) => file.weight).sort((a, b) => a - b),
			[400, 500, 600],
		);
	});

	test("each family carries its own license path and filename", () => {
		assert.equal(
			getPresentationFontAsset("inter").licenseFileName,
			"LICENSE.txt",
		);
		assert.equal(
			getPresentationFontAsset("manrope").licenseFileName,
			"OFL.txt",
		);
		assert.equal(
			getPresentationFontAsset("space-grotesk").licenseFileName,
			"OFL.txt",
		);
	});
});

describe("buildFontFaceCss", () => {
	test("emits exactly one @font-face rule for a single-file (variable) font", () => {
		const css = buildFontFaceCss("inter", (file) => `/fonts/${file.path}`);
		const matches = css.match(/@font-face/g) ?? [];
		assert.equal(matches.length, 1);
		assert.match(css, /font-family: "Inter Variable"/);
		assert.match(
			css,
			/src: url\("\/fonts\/inter\/InterVariable\.woff2"\) format\("woff2"\)/,
		);
	});

	test("emits exactly three @font-face rules for Manrope, one per static weight", () => {
		const css = buildFontFaceCss(
			"manrope",
			(file) => `fonts/${file.path.split("/").pop()}`,
		);
		const matches = css.match(/@font-face/g) ?? [];
		assert.equal(matches.length, 3);
		assert.match(css, /font-weight: 400;/);
		assert.match(css, /font-weight: 500;/);
		assert.match(css, /font-weight: 600;/);
	});

	test("only the selected font's own file(s) ever appear — never the other two families", () => {
		const css = buildFontFaceCss("inter", (file) => file.path);
		assert.doesNotMatch(css, /Manrope/);
		assert.doesNotMatch(css, /Space Grotesk/);
	});

	test("the resolved URL is whatever the caller's resolver returns (data: for Standalone, relative for Microsite)", () => {
		const standaloneCss = buildFontFaceCss(
			"inter",
			() => "data:font/woff2;base64,AAA=",
		);
		assert.match(standaloneCss, /url\("data:font\/woff2;base64,AAA="\)/);

		const micrositeCss = buildFontFaceCss(
			"inter",
			() => "../fonts/InterVariable.woff2",
		);
		assert.match(micrositeCss, /url\("\.\.\/fonts\/InterVariable\.woff2"\)/);
	});
});
