// path: hosted/app.js
//
// Plesk/Passenger startup file for the Hosted application (my.sameview.app).
// Structurally identical to the root application's app.js (see ../app.js and
// docs/deployment.md), which already proves this exact pattern under
// Passenger on this same Netcup account. Nothing in the root file is
// root-product-specific — it is generic Astro `mode: "middleware"` +
// Passenger startup boilerplate — so it is duplicated here deliberately
// rather than shared, per the approved Phase 2 scope: two independently
// deployable applications, no cross-app abstraction.
//
// Structure mirrors ../app.js (itself built line-for-line after
// ffg_monitor/app.js and ffg_einsatzzusammenfassung_chart/server.js):
//   requires -> "require the application" -> create the server object ->
//   PORT -> helper functions -> wire the request handling onto the server ->
//   `if (NODE_ENV !== 'test') { server.listen(...) }` -> module.exports
//
// The two places this deliberately differs from a naive Express-style
// reference, and why (also in docs/deployment.md):
//
// 1. No `dotenv`/env-file loading here. Phase 2 introduces no environment
//    configuration for Hosted yet (no database, no storage) — this file
//    stays exactly as minimal as the root's own reasoning already
//    establishes: load env vars once, only where actually needed.
// 2. `require("./routes/...")` in a synchronous-Express reference is plain
//    CommonJS. The equivalent step here — loading the actual application,
//    Astro's built `dist/server/entry.mjs` — cannot be synchronous: Astro
//    always emits that file as a native ES module regardless of this
//    project's own package.json, and Node's `require()` can never load an
//    ES module. A dynamic `import()` is the standard, documented
//    replacement; it is kicked off in the exact same position a reference
//    app's route `require()`s would sit.

const { createServer } = require("node:http");
const { createReadStream, existsSync, statSync } = require("node:fs");
const { extname, join, normalize } = require("node:path");

// "Require the application" — kicked off immediately, unconditionally, not
// gated behind NODE_ENV or anything else. `.catch(() => {})` only marks this
// specific promise as handled so a missing/broken build can't raise an
// unhandledRejection here before any request exists to report it against;
// each request's own handling (`handleWithAstro` below) still reports and
// responds to the failure per request.
const astroHandlerReady = import("./dist/server/entry.mjs").then(
	(mod) => mod.handler,
);
astroHandlerReady.catch(() => {});

// `createServer()` with no argument creates a plain http.Server object; the
// request handler is attached afterwards with `.on("request", ...)`.
const server = createServer();

// `process.env.PORT || 3000` — same fallback for a plain local `node app.js`
// run without PORT set, matching Plesk's own contract for the root app.
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
// back to the Astro SSR handler. Needed because @astrojs/node's
// "middleware" adapter mode (hosted/astro.config.mjs) renders pages but does
// not also serve dist/client's static assets on its own — proven by the root
// application's own build (verified locally there: without this,
// /favicon.ico and the built JS bundle both 404 even though "/" renders
// fine). Included now even though hosted/dist/client is currently empty (the
// Phase 1 placeholder page emits no client assets), so that a later Hosted
// page adding a favicon/script/CSS does not require touching this startup
// file again.
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
// response for the same request. Covered by hosted/test/app.test.mjs.
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
			console.error(
				"[hosted/app] astro handler rejected:",
				safeErrorInfo(error),
			);
			respondWithFallbackError(res);
		});
	} catch (error) {
		console.error(
			"[hosted/app] astro handler threw synchronously:",
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

// Wiring the actual request handling onto the server object created above.
server.on(
	"request",
	createRequestListener({
		astroHandler,
		tryServeStaticAsset: createStaticAssetServer(clientDir),
	}),
);

// An uncaught exception or unhandled rejection means the process may be in
// an inconsistent state (Node's own guidance) — log and exit; Plesk/
// Passenger is responsible for restarting the process.
process.on("uncaughtException", (error) => {
	console.error("[hosted/app] uncaught exception:", error);
	process.exit(1);
});
process.on("unhandledRejection", (reason) => {
	console.error("[hosted/app] unhandled rejection:", reason);
	process.exit(1);
});

// "WICHTIG für Passenger: immer lauschen (sonst 500), aber Tests nicht
// starten lassen." This must not be `require.main === module` instead —
// Passenger loads this file with `require("./app.js")` from inside its own
// internal loader module, so `require.main` is that loader, never this file,
// and that guard is always false under Passenger (confirmed root cause in
// the root application's own app.js history — see docs/deployment.md and
// hosted/test/passenger-boot.test.mjs, which fails if that guard is
// reintroduced here).
if (process.env.NODE_ENV !== "test") {
	server.listen(port, () => {
		console.log(`[hosted/app] SameView Hosted listening on port ${port}`);
	});
}

// The real, fully-wired server object, exported unconditionally regardless
// of NODE_ENV. Also exports the pure helper functions so
// hosted/test/app.test.mjs can exercise them directly with a fake
// astroHandler.
module.exports = {
	server,
	mimeTypes,
	safeErrorInfo,
	createStaticAssetServer,
	respondWithFallbackError,
	createRequestListener,
};
