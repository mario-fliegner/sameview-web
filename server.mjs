// Plesk/Passenger-compatible startup file for the built Astro app.
//
// Background: @astrojs/node's "standalone" mode starts its own internal HTTP
// server as an import-time side effect (dist/server/entry.mjs would call
// listen() deep inside the adapter's own code as soon as it is imported).
// Under this project's Netcup/Plesk (Passenger) setup that reproducibly
// resulted in 502 Bad Gateway, while a minimal, top-level
// `http.createServer(...).listen(process.env.PORT)` (no host argument)
// worked without issues. This file replicates exactly that proven-working
// pattern: a plain Node http server, created and listening directly at the
// top level of this module, using Astro's own request handler — obtained via
// the Node adapter's "middleware" mode (astro.config.mjs) — instead of a
// placeholder response.
//
// The middleware-mode handler only renders pages; unlike "standalone" mode it
// does not also serve dist/client's static assets, so this file additionally
// serves those directly from disk (plain node:fs — no Express needed).
//
// No secrets, no database access, no migrations — this file only wires up
// the HTTP server.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handler as astroHandler } from "./dist/server/entry.mjs";

const port = process.env.PORT;

if (!port) {
	throw new Error("PORT is not set. Plesk must provide it.");
}

const clientDir = fileURLToPath(new URL("./dist/client/", import.meta.url));

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

// Serves a file from dist/client if the request path matches one; returns
// false (without writing a response) if it doesn't, so the caller can fall
// back to the Astro SSR handler.
function tryServeStaticAsset(req, res) {
	try {
		const url = new URL(req.url ?? "/", "http://localhost");
		const requestedPath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
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
}

const server = createServer((req, res) => {
	if (tryServeStaticAsset(req, res)) {
		return;
	}
	astroHandler(req, res);
});

// Astro's own handler already catches rendering errors and responds with 500
// instead of throwing. These are an extra safety net for anything
// unexpected outside that path, so a single bad request or async error can
// never silently take the whole process down — which would otherwise show
// as 502 for every subsequent request until Plesk restarts it.
process.on("uncaughtException", (error) => {
	console.error("[server] uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
	console.error("[server] unhandled rejection:", reason);
});

function shutdown(signal) {
	console.log(`[server] received ${signal}, shutting down`);
	server.close(() => {
		process.exit(0);
	});
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(port, () => {
	console.log(`[server] SameView Web listening on port ${port}`);
});
