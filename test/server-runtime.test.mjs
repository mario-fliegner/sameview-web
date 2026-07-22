// Regression tests for the request-handling bug behind the Plesk "/" hang:
// server.mjs previously called `astroHandler(req, res)` without awaiting or
// catching its result at all. These tests reproduce exactly the failure
// modes that could cause "End of script output before headers" — a
// synchronous throw, a rejected promise, and a handler that never finishes
// the response — using a fake astroHandler instead of the real, built Astro
// app, plus the request-abort and already-responded cases.

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, test } from "node:test";
import { createRequestListener } from "../server-runtime.mjs";

const neverMatchesStaticAsset = () => false;

function startServer(astroHandler, options = {}) {
	const listener = createRequestListener({
		astroHandler,
		tryServeStaticAsset: options.tryServeStaticAsset ?? neverMatchesStaticAsset,
		requestTimeoutMs: options.requestTimeoutMs ?? 15_000,
		diag: options.diag,
	});
	const server = createServer(listener);
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
		});
	});
}

function stopServer(server) {
	return new Promise((resolve) => server.close(resolve));
}

describe("request handling around the Astro middleware handler", () => {
	test("synchronous throw from the handler results in HTTP 500, not a hang", async () => {
		const { server, baseUrl } = await startServer(() => {
			throw new Error("boom-sync");
		});
		try {
			const res = await fetch(`${baseUrl}/`);
			assert.equal(res.status, 500);
			await res.text();
		} finally {
			await stopServer(server);
		}
	});

	test("a rejected handler promise results in HTTP 500, not a hang", async () => {
		const { server, baseUrl } = await startServer(async () => {
			throw new Error("boom-async");
		});
		try {
			const res = await fetch(`${baseUrl}/`);
			assert.equal(res.status, 500);
			await res.text();
		} finally {
			await stopServer(server);
		}
	});

	test("a handler that finishes the response successfully is passed through untouched", async () => {
		const { server, baseUrl } = await startServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("ok");
		});
		try {
			const res = await fetch(`${baseUrl}/`);
			assert.equal(res.status, 200);
			assert.equal(await res.text(), "ok");
		} finally {
			await stopServer(server);
		}
	});

	test("a handler that never finishes the response times out with HTTP 500 instead of hanging forever", async () => {
		const { server, baseUrl } = await startServer(() => new Promise(() => {}), {
			requestTimeoutMs: 50,
		});
		try {
			const res = await fetch(`${baseUrl}/`);
			assert.equal(res.status, 500);
			await res.text();
		} finally {
			await stopServer(server);
		}
	});

	test("an aborted request does not crash the server or affect later requests", async () => {
		// Same never-resolving fake handler for both requests; what's under test
		// is that aborting the first one doesn't crash or wedge the server for
		// the second (a short timeout keeps the test itself fast).
		const { server, baseUrl } = await startServer(() => new Promise(() => {}), {
			requestTimeoutMs: 50,
		});
		try {
			const controller = new AbortController();
			const aborted = fetch(`${baseUrl}/`, { signal: controller.signal }).catch(
				() => {
					// Expected: aborting the request rejects the fetch itself.
				},
			);
			controller.abort();
			await aborted;

			// The server itself must still be healthy and respond to later requests.
			const res = await fetch(`${baseUrl}/still-alive`);
			assert.equal(res.status, 500);
			await res.text();
		} finally {
			await stopServer(server);
		}
	});

	test("a late rejection after the response already finished does not attempt to write again", async () => {
		const { server, baseUrl } = await startServer(async (_req, res) => {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("already-done");
			await Promise.resolve();
			throw new Error("late-error-after-response-finished");
		});
		try {
			const res = await fetch(`${baseUrl}/`);
			assert.equal(res.status, 200);
			assert.equal(await res.text(), "already-done");

			// Give the late rejection's .catch() a moment to run; the server
			// must still be responsive afterwards (no crash, no double-write).
			await new Promise((resolve) => setTimeout(resolve, 50));
			const res2 = await fetch(`${baseUrl}/`);
			assert.equal(res2.status, 200);
			await res2.text();
		} finally {
			await stopServer(server);
		}
	});
});
