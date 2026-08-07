// Test-only harness exposing the import pipeline's browser-safe modules on
// `window` for Playwright's page.evaluate() to drive with real bytes. This
// file is not part of the SameView Web application (src/) and ships nothing
// to production — see test/e2e/harness/vite.config.ts, which serves this
// folder in isolation from the main Astro app.

import {
	readEntryBytes,
	validateArchive,
} from "../../../src/lib/import-archive.ts";
import { validateImageContent } from "../../../src/lib/import-image.ts";
import { parseImportedMetadata } from "../../../src/lib/import-metadata.ts";
import { resolveImportedSession } from "../../../src/lib/import-resolve.ts";
import { removeEmbeddedLocationData } from "../../../src/lib/jpeg-location-metadata.ts";
import { removeXmpLocation } from "../../../src/lib/xmp-location-removal.ts";

declare global {
	interface Window {
		__importHarness__: {
			validateArchive: typeof validateArchive;
			readEntryBytes: typeof readEntryBytes;
			validateImageContent: typeof validateImageContent;
			resolveImportedSession: typeof resolveImportedSession;
			parseImportedMetadata: typeof parseImportedMetadata;
			removeXmpLocation: typeof removeXmpLocation;
			removeEmbeddedLocationData: typeof removeEmbeddedLocationData;
		};
	}
}

window.__importHarness__ = {
	validateArchive,
	readEntryBytes,
	validateImageContent,
	resolveImportedSession,
	parseImportedMetadata,
	removeXmpLocation,
	removeEmbeddedLocationData,
};
