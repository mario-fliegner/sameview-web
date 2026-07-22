// @ts-check

import node from "@astrojs/node";

import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	output: "server",
	integrations: [react()],

	adapter: node({
		mode: "middleware",
	}),
});
