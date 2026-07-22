// Plesk/Passenger startup file — the actual server entry point.
//
// Two separate, confirmed root causes of "Web application could not be
// started" led to this file's current shape (see docs/deployment.md for the
// full history):
//
// 1. Phusion Passenger's Node loader always loads the configured Startup
//    File with CommonJS `require()`, never with ESM `import()`. Node's
//    `require()` can never load a native ES module — not `.mjs` files, not
//    `.js` files under a `"type": "module"` package.json. This file is
//    therefore plain CommonJS (package.json no longer sets
//    `"type": "module"`) so Passenger's `require()` can load it directly.
// 2. Passenger loads the Startup File by `require()`-ing it from inside its
//    own internal loader module — it never runs it as `node app.js`
//    directly. That means `require.main` (the process's actual entry
//    module) is Passenger's own loader, never this file, so
//    `require.main === module` is always false under Passenger. An earlier
//    version of this file gated the entire startup path (including
//    `.listen()`) behind that check, which silently skipped starting the
//    server under Passenger while still working when run directly with
//    `node app.js` locally. The startup path below therefore runs
//    unconditionally, gated only by `NODE_ENV !== "test"` (mirroring
//    ffg_monitor's proven pattern on this same Netcup/Plesk account), not by
//    `require.main`.
//
// Astro's own build output (dist/server/entry.mjs) is unavoidably a native
// ES module regardless of this project's package.json — Astro always emits
// it as `.mjs`. It is loaded below with a dynamic `import()`, which is the
// standard, documented way for a CommonJS module to load an ES module.
//
// @astrojs/node's "standalone" adapter mode was tried previously and
// reproducibly caused 502s: its built entry starts its own internal HTTP
// server as an import-time side effect, nested inside the adapter's bundled
// code, instead of this file's own top-level `.listen()` call. "middleware"
// mode (astro.config.mjs) avoids that: it only exports a request handler,
// with no autostart side effect, so this file remains the one and only place
// that creates and starts the HTTP server. Because middleware mode does not
// also serve dist/client's static assets, this file serves those directly
// from disk (plain node:fs — no Express needed).

const { createServer } = require("node:http");
const { createReadStream, existsSync, statSync } = require("node:fs");
const { extname, join, normalize } = require("node:path");

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
// back to the Astro SSR handler.
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
// response for the same request.
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
		console.error("[app] astro handler threw synchronously:", safeErrorInfo(error));
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

module.exports = {
	mimeTypes,
	safeErrorInfo,
	createStaticAssetServer,
	respondWithFallbackError,
	createRequestListener,
};

// Everything below runs as soon as this file is loaded — including when
// Passenger loads it, which it does with `require("./app.js")` from inside
// its own internal loader module, never as `node app.js` directly. That
// means `require.main` is Passenger's own loader module, not this one, so
// `require.main === module` is always false under Passenger and must not be
// used to gate startup here (previously it was, which silently skipped
// `.listen()` entirely under Passenger — see docs/deployment.md). None of
// the reference Plesk apps (ffg_monitor, ffg_einsatzzusammenfassung_chart)
// use that guard either; they start unconditionally (ffg_monitor only skips
// under `NODE_ENV=test`, which mirrors the guard below).
if (process.env.NODE_ENV !== "test") {
	const port = process.env.PORT;

	if (!port) {
		throw new Error("PORT is not set. Plesk must provide it.");
	}

	const clientDir = join(__dirname, "dist", "client");

	// dist/server/entry.mjs is a native ES module (Astro always emits it as
	// such); resolve it once and reuse the resolved handler for every request
	// instead of re-importing per request. The extra top-level `.catch` below
	// only marks this specific promise as handled (preventing an
	// unhandledRejection from the process-level handler further down if the
	// build is ever missing) — each request's own error handling, further
	// below, still reports and responds to the failure per-request.
	const astroHandlerReady = import("./dist/server/entry.mjs").then(
		(mod) => mod.handler,
	);
	astroHandlerReady.catch(() => {});

	function astroHandler(req, res) {
		return astroHandlerReady.then((handler) => handler(req, res));
	}

	const requestListener = createRequestListener({
		astroHandler,
		tryServeStaticAsset: createStaticAssetServer(clientDir),
	});

	const server = createServer(requestListener);

	// An uncaught exception or unhandled rejection means the process may be
	// in an inconsistent state (Node's own guidance) — log and exit; Plesk/
	// Passenger is responsible for restarting the process.
	process.on("uncaughtException", (error) => {
		console.error("[app] uncaught exception:", error);
		process.exit(1);
	});
	process.on("unhandledRejection", (reason) => {
		console.error("[app] unhandled rejection:", reason);
		process.exit(1);
	});

	function shutdown(signal) {
		console.log(`[app] received ${signal}, shutting down`);
		server.close(() => {
			process.exit(0);
		});
	}
	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));

	server.listen(port, () => {
		console.log(`[app] SameView Web listening on port ${port}`);
	});
}
