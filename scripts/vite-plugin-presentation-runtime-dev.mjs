// Dev-only Vite plugin: serves the Comparison Presentation runtime script and
// Presentation CSS (both bundled by scripts/build-presentation-runtime.mjs's
// shared build functions) directly from memory at the same
// `/generated/...` URLs src/lib/comparison-artifact-assets.ts fetches — the
// readable runtime, its Static-Microsite-only minified variant, and the
// Static-Microsite-only minified Presentation CSS.
//
// Fixes a confirmed incident: `pnpm dev` used to pre-write the runtime file
// to `public/generated/` once, at process start (`pnpm build:runtime && astro
// dev`). An already-running dev server has nothing watching that directory —
// once the file was deleted (by hand, by `pnpm clean`, by any other process)
// the server 404'd on this path permanently, with no self-recovery short of
// a full restart. This plugin removes the dependency on any of these files
// existing at all while `astro dev` is running: every response is always
// computed (or served from this plugin's own in-memory cache), never read
// from disk.
//
// `apply: "serve"` scopes this to `astro dev` only — `astro build` (and
// therefore the real production artifacts under `dist/client/generated/`,
// written by the CLI path in scripts/build-presentation-runtime.mjs) never
// loads this plugin at all. Production keeps using the real static files,
// unchanged.
//
// No new dependency, no second bundling implementation: this plugin only
// ever calls the two shared build functions — exactly the same isolated,
// `configFile: false` Vite builds the CLI path already uses, so a rebuild
// triggered from inside this already-running dev server can never
// recursively load astro.config.mjs or otherwise re-enter the outer server's
// own configuration.

import {
	buildPresentationCssCode,
	buildPresentationRuntimeCode,
} from "./build-presentation-runtime.mjs";

// Any change under here can plausibly affect the bundled runtime (it is the
// entry file's own directory, containing every module it — directly or
// transitively — imports); invalidating on all of it rather than
// maintaining an explicit, driftable dependency list trades a few
// occasionally-unnecessary rebuilds for never silently serving stale code.
const JS_WATCHED_PATH_FRAGMENT = "/src/lib/";
// The Presentation CSS build only ever reads these two files (see
// build-presentation-runtime.mjs `buildPresentationCssCode`); this directory
// contains only Presentation Card/Comparison Stage styling, not the rest of
// the application's own styles.
const CSS_WATCHED_PATH_FRAGMENT = "/src/styles/";

// One entry per served route: its own build function and its own cache, so
// invalidating the CSS build never discards an already-cached JS build and
// vice versa.
const ROUTES = [
	{
		path: "/generated/comparison-presentation-runtime.js",
		contentType: "text/javascript; charset=utf-8",
		build: () => buildPresentationRuntimeCode(),
		watchFragment: JS_WATCHED_PATH_FRAGMENT,
	},
	{
		path: "/generated/comparison-presentation-runtime.min.js",
		contentType: "text/javascript; charset=utf-8",
		build: () => buildPresentationRuntimeCode({ minify: true }),
		watchFragment: JS_WATCHED_PATH_FRAGMENT,
	},
	{
		path: "/generated/comparison-presentation.min.css",
		contentType: "text/css; charset=utf-8",
		build: () => buildPresentationCssCode(),
		watchFragment: CSS_WATCHED_PATH_FRAGMENT,
	},
];

export function presentationRuntimeDevPlugin() {
	/** @type {Map<string, Promise<string> | null>} */
	const cache = new Map(ROUTES.map((route) => [route.path, null]));

	function getCode(route) {
		let cached = cache.get(route.path);
		cached ??= route.build();
		cache.set(route.path, cached);
		return cached;
	}

	return {
		name: "sameview-presentation-runtime-dev",
		apply: "serve",
		configureServer(server) {
			// Warm every cache immediately so the first real request does not pay
			// the build's own latency — failures here are swallowed on purpose
			// (surfaced instead on the next real request via `getCode()`'s own
			// rejection) so a transient startup error can never crash the dev
			// server itself.
			for (const route of ROUTES) {
				getCode(route).catch(() => {
					cache.set(route.path, null);
				});
			}

			server.watcher.on("all", (_event, filePath) => {
				const normalized = filePath.replace(/\\/g, "/");
				for (const route of ROUTES) {
					if (normalized.includes(route.watchFragment)) {
						cache.set(route.path, null);
					}
				}
			});

			// Registered directly in the hook body (not returned as a deferred
			// function) so this middleware runs *before* Vite's own built-in
			// `public/` static-file serving — required so this response stays
			// authoritative regardless of whatever may or may not exist on disk
			// under `public/generated/` at request time.
			server.middlewares.use(async (req, res, next) => {
				const route = ROUTES.find((candidate) => candidate.path === req.url);
				if (!route) {
					next();
					return;
				}
				try {
					const code = await getCode(route);
					res.setHeader("Content-Type", route.contentType);
					res.end(code);
				} catch (error) {
					cache.set(route.path, null);
					next(error instanceof Error ? error : new Error(String(error)));
				}
			});
		},
	};
}
