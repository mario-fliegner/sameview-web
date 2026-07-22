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
// The exported `handler` from @astrojs/node's middleware build has the
// officially documented signature (see node_modules/@astrojs/node/dist/types.d.ts):
//   (req, res, next?, locals?) => void | Promise<void>
// i.e. `next`/`locals` are optional and the return value may be a Promise
// that must be handled — calling it as `handler(req, res)` is a valid,
// documented invocation. The request-handling logic in server-runtime.mjs
// (see there and its tests) handles that returned promise robustly: a
// synchronous throw, a rejection, and a request-level timeout if it never
// settles at all.
//
// No secrets, no database access, no migrations — this file only wires up
// the HTTP server.

import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { handler as astroHandler } from "./dist/server/entry.mjs";
import {
	createRequestListener,
	createStaticAssetServer,
} from "./server-runtime.mjs";

const port = process.env.PORT;

if (!port) {
	throw new Error("PORT is not set. Plesk must provide it.");
}

const clientDir = fileURLToPath(new URL("./dist/client/", import.meta.url));

// ============================================================================
// TEMPORARY PRODUCTION DIAGNOSTIC — remove after the one-time diagnostic run
// described in docs/deployment.md, once the "/" hang under Plesk is resolved.
//
// Plesk currently exposes no visible Node/Passenger stdout/stderr logs, so
// this writes safe, non-sensitive lifecycle markers to a plain text file in
// the Application Root instead. Synchronous writes on purpose: if the
// process exits right after (e.g. on an uncaught exception), the marker for
// that event must already be on disk, not queued.
//
// Never written here: DATABASE_URL, other env values, request headers,
// cookies, Authorization, query parameters, full request URLs, or raw stack
// traces — see server-runtime.mjs's safeErrorInfo for what an error marker
// actually contains (name + truncated/sanitized message only).
// ============================================================================
const diagnosticLogPath = fileURLToPath(
	new URL("./runtime-diagnostic.log", import.meta.url),
);

function diag(marker, detail = "") {
	try {
		const line = `${new Date().toISOString()} ${marker}${detail ? ` ${detail}` : ""}\n`;
		appendFileSync(diagnosticLogPath, line);
	} catch {
		// Writing the diagnostic must never itself break a request or crash.
	}
}
// ============================================================================
// END TEMPORARY PRODUCTION DIAGNOSTIC (server wiring continues below)
// ============================================================================

const requestListener = createRequestListener({
	astroHandler,
	tryServeStaticAsset: createStaticAssetServer(clientDir),
	diag,
});

const server = createServer(requestListener);

// An uncaught exception or unhandled rejection means the process may be in
// an inconsistent state (Node's own guidance). Continuing to run risks
// exactly the kind of silent hang this file previously could not explain —
// logging and carrying on is not treated as "still a working application"
// here. Log safely (synchronously, so the diagnostic line is guaranteed to
// be on disk) and exit; Plesk/Passenger is responsible for restarting the
// process — this file does not loop or retry itself.
process.on("uncaughtException", (error) => {
	diag(
		"uncaughtException",
		error instanceof Error
			? `${error.name}: ${error.message.slice(0, 200)}`
			: String(error),
	);
	console.error("[server] uncaught exception:", error);
	process.exit(1);
});
process.on("unhandledRejection", (reason) => {
	diag(
		"unhandledRejection",
		reason instanceof Error
			? `${reason.name}: ${reason.message.slice(0, 200)}`
			: String(reason),
	);
	console.error("[server] unhandled rejection:", reason);
	process.exit(1);
});
process.on("beforeExit", (code) => {
	diag("beforeExit", `code=${code}`);
});
process.on("exit", (code) => {
	diag("exit", `code=${code}`);
});

function shutdown(signal) {
	diag(signal);
	console.log(`[server] received ${signal}, shutting down`);
	server.close(() => {
		process.exit(0);
	});
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

diag(
	"process-started",
	`node=${process.version} port-present=${Boolean(port)}`,
);

server.listen(port, () => {
	console.log(`[server] SameView Web listening on port ${port}`);
});
