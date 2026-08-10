// @ts-check

import node from "@astrojs/node";

import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import { presentationRuntimeDevPlugin } from "./scripts/vite-plugin-presentation-runtime-dev.mjs";

// https://astro.build/config
export default defineConfig({
	output: "server",
	integrations: [react()],

	adapter: node({
		mode: "middleware",
	}),

	// `apply: "serve"` inside the plugin itself already scopes it to `astro
	// dev` only — see scripts/vite-plugin-presentation-runtime-dev.mjs's own
	// header comment for what it does and why.
	vite: {
		plugins: [presentationRuntimeDevPlugin()],
	},
});
