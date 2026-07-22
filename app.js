// path: app.js
//
// Plesk/Passenger startup file, built line-for-line after the two Node.js
// apps already proven to work under Passenger on this same Netcup account:
// ffg_monitor/app.js and ffg_einsatzzusammenfassung_chart/server.js. See
// docs/deployment.md for the full side-by-side comparison and the reasoning
// behind every place this file necessarily differs from them.
//
// Structure mirrors ffg_monitor/app.js:
//   requires -> "require the application" -> create the server object ->
//   PORT -> helper functions -> wire the request handling onto the server ->
//   `if (NODE_ENV !== 'test') { server.listen(...) }` -> module.exports
//
// The two places this deliberately differs from both reference projects,
// and why (also in docs/deployment.md):
//
// 1. No `dotenv`/env-file loading here. Both reference apps load their own
//    `.env`/`.env.production` at the top of app.js. SameView's env loading
//    already happens inside the Astro SSR code that actually needs it
//    (`src/db/client.ts`, via `process.loadEnvFile(".env")`) — env vars are
//    shared process-wide, so loading them a second time here would be
//    redundant, not incorrect, and would create a second place to keep in
//    sync with the first.
// 2. `require("./routes/...")` in the reference apps is synchronous
//    CommonJS. The equivalent step here — loading the actual application,
//    Astro's built `dist/server/entry.mjs` — cannot be synchronous: Astro
//    always emits that file as a native ES module regardless of this
//    project's own package.json, and Node's `require()` can never load an
//    ES module (confirmed root cause of this file's first broken version —
//    see docs/deployment.md). A dynamic `import()` is the standard,
//    documented replacement; it is kicked off in the exact same position a
//    reference app's route `require()`s would sit.

const { createServer } = require("node:http");
const { createReadStream, existsSync, statSync } = require("node:fs");
const { extname, join, normalize } = require("node:path");

// "Require the application" — the equivalent, in the reference apps, of
// `const cronRoutes = require('./routes/cronRoutes')` and friends. Kicked
// off immediately, unconditionally, in the same position those requires
// occupy — not gated behind NODE_ENV or anything else, exactly like the
// reference requires aren't. `.catch(() => {})` only marks this specific
// promise as handled so a missing/broken build can't raise an
// unhandledRejection here before any request exists to report it against;
// each request's own handling (`handleWithAstro` below) still reports and
// responds to the failure per request.
const astroHandlerReady = import("./dist/server/entry.mjs").then(
	(mod) => mod.handler,
);
astroHandlerReady.catch(() => {});

// `const app = express();` in both reference apps. `createServer()` with no
// argument creates the same kind of plain http.Server object; the request
// handler is attached afterwards with `.on("request", ...)`, mirroring how
// the reference apps mount everything onto `app` after creating it, instead
// of having to hand a single, fully-assembled listener to the constructor.
const server = createServer();

// `const PORT = process.env.PORT || 3000;` in both reference apps —
// identical here, including the same fallback for a plain local `node
// app.js` run without PORT set.
const port = process.env.PORT || 3000;

const mimeTypes = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".txt": "text/plain; charset=utf-8",
};

function safeErrorInfo(error) {
	const name = error instanceof Error ? error.name : "UnknownError";
	const rawMessage = error instanceof Error ? error.message : String(error);
	const message = rawMessage
		.replace(/[a-zA-Z]+:\/\/\S+/g, "[redacted-url]")
		.slice(0, 200);
	return `${name}: ${message}`;
}

// Serves a file from clientDir if the request path matches one; returns
// false (without writing a response) if it doesn't, so the caller can fall
// back to the Astro SSR handler. The equivalent, in the reference apps, of
// `app.use(express.static(path.join(__dirname, 'public')))` — needed here
// only because @astrojs/node's "middleware" adapter mode (astro.config.mjs)
// renders pages but does not also serve dist/client's static assets on its
// own (verified locally: without this, /favicon.ico and the built JS bundle
// both 404 even though "/" renders fine).
function createStaticAssetServer(clientDir) {
	return function tryServeStaticAsset(req, res) {
		try {
			const url = new URL(req.url ?? "/", "http://localhost");
			const requestedPath = normalize(url.pathname).replace(
				/^(\.\.[/\\])+/,
				"",
			);
			const filePath = join(clientDir, requestedPath);

			if (!filePath.startsWith(clientDir)) {
				return false;
			}
			if (!existsSync(filePath) || !statSync(filePath).isFile()) {
				return false;
			}

			res.writeHead(200, {
				"Content-Type":
					mimeTypes[extname(filePath)] ?? "application/octet-stream",
			});
			createReadStream(filePath).pipe(res);
			return true;
		} catch {
			return false;
		}
	};
}

// Sends a safe fallback response for a failed/timed-out/hung request. Never
// throws itself, never writes twice, never tries to write headers that have
// already been sent.
function respondWithFallbackError(res) {
	if (res.writableEnded) {
		return;
	}
	if (res.headersSent) {
		res.destroy();
		return;
	}
	try {
		res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
		res.end("Internal Server Error");
	} catch {
		res.destroy();
	}
}

// Explicitly handles: a synchronous throw from astroHandler, a rejected
// astroHandler promise, and an astroHandler that resolves without ever
// finishing the response (via requestTimeoutMs). Never sends more than one
// response for the same request. Neither reference app needs this: they are
// synchronous Express apps with no async SSR render step. This addresses a
// separate, already-diagnosed SameView-specific defect (the "/" request
// hanging indefinitely — see "Request handling safety" in
// docs/deployment.md), unrelated to the Passenger-startup problem this file
// was otherwise rebuilt to fix. Covered by test/app.test.mjs.
function handleWithAstro({ req, res, astroHandler, requestTimeoutMs }) {
	let settled = false;
	const timer = setTimeout(() => {
		if (settled) return;
		settled = true;
		respondWithFallbackError(res);
	}, requestTimeoutMs);
	timer.unref?.();

	const finish = () => {
		if (settled) return;
		settled = true;
		clearTimeout(timer);
	};

	res.on("finish", finish);
	res.on("close", finish);

	try {
		const result = astroHandler(req, res);
		Promise.resolve(result).catch((error) => {
			console.error("[app] astro handler rejected:", safeErrorInfo(error));
			respondWithFallbackError(res);
		});
	} catch (error) {
		console.error(
			"[app] astro handler threw synchronously:",
			safeErrorInfo(error),
		);
		respondWithFallbackError(res);
	}
}

// Builds the Node http request listener: tries the static asset server
// first, then falls back to astroHandler with full error/timeout handling.
// Pure — no top-level side effects — so it can be exercised by tests with a
// fake astroHandler instead of the real, built dist/server/entry.mjs.
function createRequestListener({
	astroHandler,
	tryServeStaticAsset,
	requestTimeoutMs = 15_000,
}) {
	return function requestListener(req, res) {
		if (tryServeStaticAsset(req, res)) {
			return;
		}
		handleWithAstro({ req, res, astroHandler, requestTimeoutMs });
	};
}

const clientDir = join(__dirname, "dist", "client");

// astroHandlerReady may still be pending (or, if the build is missing,
// rejected) the first time a request arrives — resolved once and reused for
// every subsequent request rather than re-importing per request.
function astroHandler(req, res) {
	return astroHandlerReady.then((handler) => handler(req, res));
}

// `app.use('/x', someRoutes)` in the reference apps — wiring the actual
// request handling onto the server object created above.
server.on(
	"request",
	createRequestListener({
		astroHandler,
		tryServeStaticAsset: createStaticAssetServer(clientDir),
	}),
);

// An uncaught exception or unhandled rejection means the process may be in
// an inconsistent state (Node's own guidance) — log and exit; Plesk/
// Passenger is responsible for restarting the process. Neither reference app
// registers these — same reasoning as `handleWithAstro` above: this is
// defense-in-depth for the separately-diagnosed "/" hang, not part of the
// Passenger-startup fix.
process.on("uncaughtException", (error) => {
	console.error("[app] uncaught exception:", error);
	process.exit(1);
});
process.on("unhandledRejection", (reason) => {
	console.error("[app] unhandled rejection:", reason);
	process.exit(1);
});

// `if (process.env.NODE_ENV !== 'test') { app.listen(PORT, ...) }` in
// ffg_monitor/app.js, including its own comment on this exact line:
// "WICHTIG für Passenger: immer lauschen (sonst 500), aber Tests nicht
// starten lassen." This must not be `require.main === module` instead —
// Passenger loads this file with `require("./app.js")` from inside its own
// internal loader module, so `require.main` is that loader, never this file,
// and that guard is always false under Passenger (confirmed root cause of
// this file's second broken version — see docs/deployment.md and
// test/passenger-boot.test.mjs, which fails if that guard is reintroduced).
if (process.env.NODE_ENV !== "test") {
	server.listen(port, () => {
		console.log(`[app] SameView Web listening on port ${port}`);
	});
}

// `module.exports = app;` in ffg_monitor/app.js — the real, fully-wired
// server object, exported unconditionally regardless of NODE_ENV, same as
// there. Also exports the pure helper functions above (ffg_monitor has no
// equivalent need for this: its request handling is synchronous Express
// middleware, not custom async error/timeout handling) so
// test/app.test.mjs can exercise them directly with a fake astroHandler.
module.exports = {
	server,
	mimeTypes,
	safeErrorInfo,
	createStaticAssetServer,
	respondWithFallbackError,
	createRequestListener,
};
