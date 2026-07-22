// Plesk/Passenger startup file — the actual server entry point.
//
// Root cause of "Web application could not be started" (confirmed against
// Plesk's own knowledge base and Node's documented behavior, and against how
// every other Node app on this Netcup/Plesk account is built — see
// docs/deployment.md): Phusion Passenger's Node loader always loads the
// configured Startup File with CommonJS `require()`, never with ESM
// `import()`. Node's `require()` can never load a native ES module — not
// `.mjs` files, not `.js` files under a `"type": "module"` package.json —
// regardless of Passenger. That failure happens before a single line of the
// app's own code runs, which is why no log or diagnostic file was ever
// produced. This file is plain CommonJS (package.json no longer sets
// `"type": "module"`) so Passenger's `require()` can load it directly.
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

// Everything below only runs when Passenger (or a developer) executes this
// file directly with `node app.js` — not when a test imports the pure
// functions above.
if (require.main === module) {
	const port = process.env.PORT;

	if (!port) {
		throw new Error("PORT is not set. Plesk must provide it.");
	}

	const clientDir = join(__dirname, "dist", "client");

	// dist/server/entry.mjs is a native ES module (Astro always emits it as
	// such); resolve it once and reuse the resolved handler for every request
	// instead of re-importing per request.
	const astroHandlerReady = import("./dist/server/entry.mjs").then(
		(mod) => mod.handler,
	);

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
