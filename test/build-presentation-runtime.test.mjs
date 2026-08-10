// Regression coverage for a confirmed incident: `public/generated/comparison-presentation-runtime.js`
// (the pre-bundled script Standalone HTML/Static Microsite embed —
// src/lib/comparison-artifact-assets.ts) used to only ever be written once,
// before `astro dev` started. An already-running dev server had nothing
// watching that file; once it was deleted (by hand, `pnpm clean`, or any
// other process), every subsequent "Create Output" attempt failed with a
// 404 that no automated test caught, because every local Playwright run
// happened to reuse one already-correctly-started server instance instead
// of ever exercising a genuinely cold start.
//
// Fixed by scripts/vite-plugin-presentation-runtime-dev.mjs: `astro dev`
// now serves that exact URL from an in-memory cache, built by the same
// `buildPresentationRuntimeCode()` scripts/build-presentation-runtime.mjs's
// CLI path uses — never from a file on disk. This spawns real `astro dev`/
// `pnpm build` child processes (the same commands documented in README.md
// and used by playwright.config.ts) rather than asserting against the
// source code, since the previous incident is exactly the kind of gap that
// only a real process boundary reproduces.
//
// Process cleanup (`killProcessTree` below) is deliberately not a plain
// `child.kill()`: confirmed by an actual hang during this file's own
// development — on Windows, `spawn(..., { shell: true })` makes `child`
// the *cmd.exe wrapper*, not the real `pnpm`/`astro`/`node` process it
// launches; killing the wrapper leaves that real process running, orphaned,
// still holding its stdio pipes open. A single such leftover `astro dev`
// process from an earlier failed run kept a later `node --test` invocation
// from ever exiting. `taskkill /T /F` (built into Windows, no new
// dependency) kills the whole process tree, not just the wrapper.
//
// Every test that touches `public/generated/` removes it again in a
// `finally` block, regardless of outcome, so a failed assertion never
// leaves that (gitignored, disposable) directory in a surprising state for
// whatever runs next. Every spawned process is torn down through the same
// `killProcessTree` in a `finally` too, and the `pnpm build` test races its
// own hard deadline against the child's `exit` event (rather than trusting
// this file's `node:test` `timeout` option alone) — that option marks a
// slow test failed but does not itself reclaim a still-running child
// process, which is exactly how the original hang went unnoticed.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const generatedDir = join(repoRoot, "public", "generated");
const runtimeAssetPath = join(
	generatedDir,
	"comparison-presentation-runtime.js",
);
const RUNTIME_ROUTE = "/generated/comparison-presentation-runtime.js";
// A real, stable identifier from inside the bundled module graph
// (src/lib/adaptive-text-size.ts) — proves the response is genuinely the
// compiled runtime, not merely "some 200 response" or a stale placeholder.
const RUNTIME_CODE_MARKER = "computeWrappedLineCount";

function getFreePort() {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		// "localhost", not "127.0.0.1": Astro's own dev server binds to
		// whatever "localhost" resolves to on this machine — confirmed to be
		// the IPv6 loopback (`::1`), not `127.0.0.1`, in this project's actual
		// environment — so probing (and, further below, fetching) against the
		// same hostname is what keeps this test bound to the same address
		// family Astro itself will actually use, rather than assuming IPv4.
		probe.listen(0, "localhost", () => {
			const { port } = probe.address();
			probe.close((err) => (err ? reject(err) : resolve(port)));
		});
		probe.on("error", reject);
	});
}

async function waitForRuntimeAsset(
	port,
	{ timeoutMs = 25_000, intervalMs = 250 } = {},
) {
	const deadline = Date.now() + timeoutMs;
	let lastError;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`http://localhost:${port}${RUNTIME_ROUTE}`);
			if (response.ok) return response;
			lastError = new Error(`unexpected status ${response.status}`);
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	throw new Error(
		`runtime asset never became available on port ${port} within ${timeoutMs}ms: ${lastError}`,
	);
}

function removeGeneratedDir() {
	rmSync(generatedDir, { recursive: true, force: true });
}

// See module header comment: kills the *entire* process tree a
// `shell: true` spawn produces, not just the immediate `cmd.exe`/shell
// wrapper `child` itself refers to on Windows.
function killProcessTree(child) {
	if (!child.pid) return;
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
			stdio: "ignore",
		});
	} else {
		try {
			child.kill("SIGTERM");
		} catch {
			// Already exited — nothing to do.
		}
	}
}

// Races the child's own `exit` event against a hard deadline, force-killing
// the whole tree if that deadline wins — so a hung/misbehaving child can
// never leave this test (or the `node --test` process as a whole) waiting
// forever, regardless of this file's own `node:test` `timeout` option
// (which fails the test but does not, by itself, reclaim the process).
function waitForExit(child, timeoutMs) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			killProcessTree(child);
			reject(new Error(`process did not exit within ${timeoutMs}ms`));
		}, timeoutMs);
		child.once("exit", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(code);
		});
		child.once("error", (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(error);
		});
	});
}

// `shell: true` with a joined command string: the most reliable way to
// invoke `pnpm`'s own OS-specific shim (a `.cmd`/`.ps1` wrapper on Windows,
// this project's actual development platform) exactly as a developer's own
// shell would, rather than assuming a particular binary resolution.
function spawnCommand(commandLine, extraEnv) {
	return spawn(commandLine, {
		cwd: repoRoot,
		shell: true,
		env: {
			...process.env,
			// See playwright.config.ts's own identical override: Astro 7
			// auto-daemonizes `astro dev` when it detects an AI coding agent
			// (CLAUDECODE), which would make this spawned process exit
			// immediately while the real server keeps running invisibly,
			// orphaned and unreachable via this test's own cleanup.
			CLAUDECODE: "",
			...extraEnv,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
}

describe("astro dev serves the Comparison Presentation runtime without depending on a persisted public/generated file", () => {
	test("a genuinely fresh `pnpm dev` (via `pnpm exec astro dev`) start, with no public/generated/ at all, serves the runtime asset", {
		timeout: 40_000,
	}, async () => {
		removeGeneratedDir();
		assert.equal(existsSync(runtimeAssetPath), false);

		const port = await getFreePort();
		const child = spawnCommand(`pnpm exec astro dev --port ${port}`);
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});

		try {
			// Still true at the moment the server first answers — proves the
			// response was never read from a pre-written file on disk.
			const response = await waitForRuntimeAsset(port);
			assert.equal(existsSync(runtimeAssetPath), false);
			const code = await response.text();
			assert.ok(code.length > 0, "runtime asset response was empty");
			assert.ok(
				code.includes(RUNTIME_CODE_MARKER),
				`runtime asset response did not contain the expected compiled marker\nstdout:\n${stdout}\nstderr:\n${stderr}`,
			);
		} finally {
			killProcessTree(child);
			removeGeneratedDir();
		}
	});

	test("the same already-running server keeps serving the runtime asset after public/generated/ is deleted mid-session — the exact incident this fixes", {
		timeout: 40_000,
	}, async () => {
		removeGeneratedDir();
		const port = await getFreePort();
		const child = spawnCommand(`pnpm exec astro dev --port ${port}`);

		try {
			await waitForRuntimeAsset(port);

			// Seed a deliberately wrong static file at the exact same path a
			// stale production build (or manual edit) could leave behind, to
			// prove the dev response is never merely "whatever happens to be
			// on disk" even when something *is* there.
			mkdirSync(generatedDir, { recursive: true });
			writeFileSync(runtimeAssetPath, "STALE_PLACEHOLDER_CONTENT");
			const staleResponse = await fetch(
				`http://localhost:${port}${RUNTIME_ROUTE}`,
			);
			const staleBody = await staleResponse.text();
			assert.ok(
				!staleBody.includes("STALE_PLACEHOLDER_CONTENT"),
				"dev server served the stale static file instead of the live-built runtime",
			);
			assert.ok(staleBody.includes(RUNTIME_CODE_MARKER));

			// The actual regression: delete it outright, without restarting
			// the server process.
			removeGeneratedDir();
			const afterDeleteResponse = await fetch(
				`http://localhost:${port}${RUNTIME_ROUTE}`,
			);
			assert.equal(afterDeleteResponse.status, 200);
			const afterDeleteBody = await afterDeleteResponse.text();
			assert.ok(afterDeleteBody.includes(RUNTIME_CODE_MARKER));
		} finally {
			killProcessTree(child);
			removeGeneratedDir();
		}
	});
});

describe("pnpm build still produces the real static runtime asset, without the dev-only plugin", () => {
	test("`pnpm build` writes a valid runtime asset to dist/client/generated/, and no dev-plugin code reaches dist/", {
		timeout: 100_000,
	}, async () => {
		const distDir = join(repoRoot, "dist");
		rmSync(distDir, { recursive: true, force: true });
		removeGeneratedDir();

		const child = spawnCommand("pnpm build");
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});

		try {
			// Below this file's own 100s `node:test` timeout, so a genuine
			// build hang fails via this explicit deadline (with a real
			// process-tree kill) rather than via that outer timeout, which
			// would leave the child running.
			const exitCode = await waitForExit(child, 80_000);
			assert.equal(
				exitCode,
				0,
				`pnpm build failed\nstdout:\n${stdout}\nstderr:\n${stderr}`,
			);

			const distRuntimePath = join(
				distDir,
				"client",
				"generated",
				"comparison-presentation-runtime.js",
			);
			assert.ok(
				existsSync(distRuntimePath),
				"dist/client/generated/comparison-presentation-runtime.js is missing after pnpm build",
			);
			const distRuntimeCode = readFileSync(distRuntimePath, "utf8");
			assert.ok(distRuntimeCode.length > 0);
			assert.ok(distRuntimeCode.includes(RUNTIME_CODE_MARKER));

			// The dev-only plugin (scripts/vite-plugin-presentation-runtime-dev.mjs)
			// must never end up inside the shipped artifact — `apply: "serve"`
			// is what is supposed to guarantee this; verified here rather than
			// only asserted in a code comment.
			const devPluginMarker = "sameview-presentation-runtime-dev";
			for (const filePath of walk(distDir)) {
				if (!filePath.endsWith(".js") && !filePath.endsWith(".mjs")) continue;
				const content = readFileSync(filePath, "utf8");
				assert.ok(
					!content.includes(devPluginMarker),
					`dev-only plugin marker found in production build output: ${filePath}`,
				);
			}
		} finally {
			killProcessTree(child);
			rmSync(distDir, { recursive: true, force: true });
			removeGeneratedDir();
		}
	});
});

function* walk(dir) {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			yield* walk(fullPath);
		} else {
			yield fullPath;
		}
	}
}
