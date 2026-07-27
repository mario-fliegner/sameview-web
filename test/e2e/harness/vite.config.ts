// Minimal, isolated dev server for the import-pipeline Playwright harness.
// Deliberately separate from astro.config.mjs: this serves only
// test/e2e/harness/, never the SameView Web application itself.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: currentDir,
	server: {
		port: 4173,
		strictPort: true,
	},
});
