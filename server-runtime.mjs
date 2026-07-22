// Testable core of server.mjs's request handling.
//
// Pure logic with no top-level side effects (no listen(), no top-level file
// reads) so it can be exercised by automated tests with a fake Astro handler
// instead of the real, large, built dist/server/entry.mjs. server.mjs wires
// this up with the real handler, the real dist/client directory and a real
// (file-writing) diagnostic function, and starts listening.

import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

export const mimeTypes = {
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

export function safeErrorInfo(error) {
	const name = error instanceof Error ? error.name : "UnknownError";
	const rawMessage = error instanceof Error ? error.message : String(error);
	// Defensive: strip anything that looks like a URL/connection string before truncating.
	const message = rawMessage
		.replace(/[a-zA-Z]+:\/\/\S+/g, "[redacted-url]")
		.slice(0, 200);
	return `${name}: ${message}`;
}

// Serves a file from clientDir if the request path matches one; returns
// false (without writing a response) if it doesn't, so the caller can fall
// back to the Astro SSR handler.
export function createStaticAssetServer(clientDir) {
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
export function respondWithFallbackError(res) {
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

const noopDiag = () => {};

// Explicitly handles: a synchronous throw from astroHandler, a rejected
// astroHandler promise, an astroHandler that resolves without ever
// finishing the response (via requestTimeoutMs), and never sends more than
// one response for the same request.
function handleWithAstro({
	req,
	res,
	isRoot,
	astroHandler,
	diag,
	requestTimeoutMs,
}) {
	if (isRoot) diag("astro-handler-invoked");

	let settled = false;
	const timer = setTimeout(() => {
		if (settled) return;
		settled = true;
		if (isRoot) diag("request-timeout");
		respondWithFallbackError(res);
	}, requestTimeoutMs);
	timer.unref?.();

	const finish = () => {
		if (settled) return;
		settled = true;
		clearTimeout(timer);
	};

	res.on("finish", () => {
		finish();
		if (isRoot) diag("response-finish");
	});
	res.on("close", () => {
		finish();
		if (isRoot) diag("response-close");
	});
	req.on("aborted", () => {
		if (isRoot) diag("request-aborted");
	});

	try {
		const result = astroHandler(req, res);
		Promise.resolve(result)
			.then(() => {
				if (isRoot) diag("astro-handler-completed");
			})
			.catch((error) => {
				if (isRoot) diag("astro-handler-rejected", safeErrorInfo(error));
				respondWithFallbackError(res);
			});
	} catch (error) {
		if (isRoot) diag("astro-handler-threw-sync", safeErrorInfo(error));
		respondWithFallbackError(res);
	}
}

// Builds the Node http request listener: tries the static asset server
// first, then falls back to astroHandler with full error/timeout handling.
export function createRequestListener({
	astroHandler,
	tryServeStaticAsset,
	diag = noopDiag,
	requestTimeoutMs = 15_000,
	isRoot = (req) => req.url === "/",
}) {
	return function requestListener(req, res) {
		const root = isRoot(req);
		if (root) diag("request-root-received");

		if (tryServeStaticAsset(req, res)) {
			return;
		}
		if (root) diag("static-handling-skipped");

		handleWithAstro({
			req,
			res,
			isRoot: root,
			astroHandler,
			diag,
			requestTimeoutMs,
		});
	};
}
