// Regression test for the Passenger startup bug: an earlier version of
// app.js gated its entire startup path (including the real `.listen()`)
// behind `if (require.main === module)`. That works when a developer runs
// `node app.js` directly, but Phusion Passenger never does that — it loads
// the configured Startup File with `require("./app.js")` from inside its
// own internal loader module, so `require.main` is Passenger's loader, never
// app.js itself, and `require.main === module` is always false there. The
// guard silently skipped `.listen()` under Passenger while still appearing
// to work in every local/manual test that ran `node app.js` directly — see
// docs/deployment.md.
//
// This test reproduces Passenger's actual loading model instead of assuming
// it: it spawns a fresh `node -e "require('./app.js')"` child process (never
// `node app.js`) with PORT set and NODE_ENV deliberately not "test", and
// proves the server is actually accepting connections on that port. If
// `require.main === module` (or any equivalent guard tied to how the file
// was invoked) is reintroduced, `.listen()` never runs under this loading
// model and this test fails via the connection timeout below.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Ask the OS for a free port instead of hard-coding one, then hand that
// number to the child process via PORT — the same contract Plesk uses.
function getFreePort() {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.listen(0, "127.0.0.1", () => {
			const { port } = probe.address();
			probe.close((err) => (err ? reject(err) : resolve(port)));
		});
		probe.on("error", reject);
	});
}

function waitForPortOpen(port, { timeoutMs = 5000, intervalMs = 100 } = {}) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve, reject) => {
		function attempt() {
			const socket = connect({ port, host: "127.0.0.1" });
			socket.once("connect", () => {
				socket.destroy();
				resolve();
			});
			socket.once("error", () => {
				socket.destroy();
				if (Date.now() >= deadline) {
					reject(
						new Error(
							`nothing accepted connections on port ${port} within ${timeoutMs}ms`,
						),
					);
					return;
				}
				setTimeout(attempt, intervalMs);
			});
		}
		attempt();
	});
}

describe("app.js starts a listening server the way Passenger actually loads it", () => {
	test("`require('./app.js')` (not `node app.js`) still calls .listen()", async () => {
		const port = await getFreePort();

		const child = spawn(process.execPath, ["-e", "require('./app.js')"], {
			cwd: repoRoot,
			env: {
				...process.env,
				PORT: String(port),
				// Deliberately not "test" — this must exercise the same
				// production startup path Passenger uses, unconditionally.
				NODE_ENV: "production",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});

		let exitedEarly = false;
		child.once("exit", () => {
			exitedEarly = true;
		});

		try {
			await waitForPortOpen(port);
			assert.equal(
				exitedEarly,
				false,
				`child process exited before the port opened\nstdout:\n${stdout}\nstderr:\n${stderr}`,
			);
		} finally {
			child.kill("SIGTERM");
		}
	});
});
