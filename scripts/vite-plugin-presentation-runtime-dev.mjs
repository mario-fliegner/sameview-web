// Dev-only Vite plugin: serves the Comparison Presentation runtime script
// (src/lib/comparison-presentation-runtime-entry.ts, bundled by
// scripts/build-presentation-runtime.mjs's shared `buildPresentationRuntimeCode()`)
// directly from memory at `/generated/comparison-presentation-runtime.js` —
// the exact same URL src/lib/comparison-artifact-assets.ts fetches.
//
// Fixes a confirmed incident: `pnpm dev` used to pre-write this file to
// `public/generated/` once, at process start (`pnpm build:runtime && astro
// dev`). An already-running dev server has nothing watching that directory —
// once the file was deleted (by hand, by `pnpm clean`, by any other process)
// the server 404'd on this path permanently, with no self-recovery short of
// a full restart. This plugin removes the dependency on that file existing
// at all while `astro dev` is running: the response is always computed (or
// served from this plugin's own in-memory cache), never read from disk.
//
// `apply: "serve"` scopes this to `astro dev` only — `astro build` (and
// therefore the real production artifact under `dist/client/generated/`,
// written by the CLI path in scripts/build-presentation-runtime.mjs) never
// loads this plugin at all. Production keeps using the real static file,
// unchanged.
//
// No new dependency, no second bundling implementation: this plugin only
// ever calls the one shared `buildPresentationRuntimeCode()` function —
// exactly the same isolated, `configFile: false` Vite library build the CLI
// path already uses, so a rebuild triggered from inside this already-running
// dev server can never recursively load astro.config.mjs or otherwise
// re-enter the outer server's own configuration.

import { buildPresentationRuntimeCode } from "./build-presentation-runtime.mjs";

const RUNTIME_ROUTE = "/generated/comparison-presentation-runtime.js";
// Any change under here can plausibly affect the bundled runtime (it is the
// entry file's own directory, containing every module it — directly or
// transitively — imports); invalidating on all of it rather than
// maintaining an explicit, driftable dependency list trades a few
// occasionally-unnecessary rebuilds for never silently serving stale code.
const WATCHED_PATH_FRAGMENT = "/src/lib/";

export function presentationRuntimeDevPlugin() {
	/** @type {Promise<string> | null} */
	let cachedCode = null;

	function invalidate() {
		cachedCode = null;
	}

	function getCode() {
		cachedCode ??= buildPresentationRuntimeCode();
		return cachedCode;
	}

	return {
		name: "sameview-presentation-runtime-dev",
		apply: "serve",
		configureServer(server) {
			// Warm the cache immediately so the first real request does not pay
			// the build's own latency — failures here are swallowed on purpose
			// (surfaced instead on the next real request via `getCode()`'s own
			// rejection) so a transient startup error can never crash the dev
			// server itself.
			getCode().catch(() => {
				cachedCode = null;
			});

			server.watcher.on("all", (_event, filePath) => {
				if (filePath.replace(/\\/g, "/").includes(WATCHED_PATH_FRAGMENT)) {
					invalidate();
				}
			});

			// Registered directly in the hook body (not returned as a deferred
			// function) so this middleware runs *before* Vite's own built-in
			// `public/` static-file serving — required so this response stays
			// authoritative regardless of whatever may or may not exist on disk
			// under `public/generated/` at request time.
			server.middlewares.use(async (req, res, next) => {
				if (req.url !== RUNTIME_ROUTE) {
					next();
					return;
				}
				try {
					const code = await getCode();
					res.setHeader("Content-Type", "text/javascript; charset=utf-8");
					res.end(code);
				} catch (error) {
					invalidate();
					next(error instanceof Error ? error : new Error(String(error)));
				}
			});
		},
	};
}
