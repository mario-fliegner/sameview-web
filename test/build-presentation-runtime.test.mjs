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
const MIN_RUNTIME_ROUTE = "/generated/comparison-presentation-runtime.min.js";
const CSS_ROUTE = "/generated/comparison-presentation.min.css";
// A real, stable identifier from inside the bundled module graph
// (src/lib/adaptive-text-size.ts) — proves the readable response is
// genuinely the compiled runtime, not merely "some 200 response" or a stale
// placeholder. Only usable against the *readable* variant: esbuild's
// `minify: true` (scripts/build-presentation-runtime.mjs
// `buildPresentationRuntimeCode({ minify: true })`) mangles every local
// identifier in this no-exports IIFE, so this exact function name does not
// survive minification — empirically confirmed against the real minified
// build output before writing this test, not assumed.
const RUNTIME_CODE_MARKER = "computeWrappedLineCount";
// A real, stable *string literal* the runtime reads via
// `document.getElementById` (src/lib/comparison-presentation-runtime.ts
// `requireElement<HTMLElement>("sameview-output-frame")`) — unlike
// `RUNTIME_CODE_MARKER` above, string literals are never renamed by esbuild's
// minifier, so this marker proves genuine compiled-runtime identity in
// *both* the readable and minified variants.
const MIN_RUNTIME_CODE_MARKER = "sameview-output-frame";
// Real, stable selectors from src/styles/comparison-presentation.css and
// src/styles/comparison-artifact-frame.css respectively — proves the CSS
// response is genuinely both real stylesheets, concatenated in the fixed
// Presentation-then-Frame order scripts/build-presentation-runtime.mjs
// `buildPresentationCssCode` documents.
const PRESENTATION_CSS_MARKER = ".presentation-canvas";
const FRAME_CSS_MARKER = "#sameview-output-frame";

// Structural (not size-based) proof of esbuild minification: readable source
// is always written with real newlines between declarations/rules; esbuild's
// minifier collapses a rule/statement body onto a single line with no space
// after `{`/`:`/`;`/`,` separators it controls. Comparing against the
// already-fetched readable sibling in the same test, rather than a fixed
// byte-count threshold, is what keeps this assertion meaningful if either
// source file's own size changes later.
function assertStructurallyMinified(minifiedText, readableText, label) {
	const minifiedLineCount = minifiedText.split("\n").length;
	const readableLineCount = readableText.split("\n").length;
	assert.ok(
		minifiedLineCount < readableLineCount / 2,
		`${label}: expected minified output to collapse onto far fewer lines than the readable variant (minified: ${minifiedLineCount} lines, readable: ${readableLineCount} lines)`,
	);
	assert.doesNotMatch(
		minifiedText,
		/\n\t/,
		`${label}: minified output still contains tab-indented lines`,
	);
}

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

// `process.kill(pid, 0)` sends no actual signal — it only probes whether a
// process with this pid still exists (throws ESRCH/EPERM otherwise). Used
// below to confirm an already-signaled process has genuinely exited, since
// a signal only requests termination and returns immediately regardless of
// whether the target has actually stopped running yet.
function isAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function waitUntilDead(pid, { timeoutMs, intervalMs = 100 } = {}) {
	return new Promise((resolve) => {
		const deadline = Date.now() + timeoutMs;
		function check() {
			if (!isAlive(pid)) {
				resolve(true);
				return;
			}
			if (Date.now() >= deadline) {
				resolve(false);
				return;
			}
			setTimeout(check, intervalMs);
		}
		check();
	});
}

// Confirmed regression fix: on Linux CI, this used to fire `child.kill
// ("SIGTERM")` and return immediately, without waiting for the signaled
// process to actually exit. Node's test runner then started the next
// subtest right away, sometimes while the previous `astro dev` process was
// still alive — Astro's own project-wide `.astro/dev.json` lock file (see
// node_modules/astro/dist/core/dev/lockfile.js `checkExistingServer`) still
// pointed at that live pid, so the next `astro dev` invocation aborted with
// "Another astro dev server is already running" and never bound its own
// port, which `waitForRuntimeAsset()` then timed out waiting for. This
// function now blocks until the process it itself started is confirmed
// gone (SIGTERM, then SIGKILL only if still alive after a short grace
// period) before returning, exactly like the Windows branch's `spawnSync`
// already does by construction.
//
// Kills the *entire* process tree a `shell: true` spawn produces, not just
// the immediate `cmd.exe`/shell wrapper `child` itself refers to on
// Windows, and (see spawnCommand()'s `detached: true` on non-Windows) not
// just the immediate `sh -c "…"` wrapper there either — `pnpm exec astro
// dev`/`pnpm build` can spawn further child processes (astro, vite,
// esbuild helpers) under the same process group, and only the group as a
// whole is guaranteed to be gone once this resolves.
async function killProcessTree(child) {
	if (!child.pid) return;
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
			stdio: "ignore",
		});
		return;
	}
	const pid = child.pid;
	const SIGTERM_GRACE_MS = 5_000;
	const SIGKILL_CONFIRM_MS = 3_000;
	try {
		// Negative pid: signals the whole process group `spawnCommand()`'s
		// `detached: true` made `pid` the leader of — never an unrelated,
		// pre-existing process outside the group this test itself started.
		process.kill(-pid, "SIGTERM");
	} catch {
		// Already exited (or never got its own group) — nothing to do.
		return;
	}
	if (await waitUntilDead(pid, { timeoutMs: SIGTERM_GRACE_MS })) {
		return;
	}
	try {
		process.kill(-pid, "SIGKILL");
	} catch {
		return;
	}
	await waitUntilDead(pid, { timeoutMs: SIGKILL_CONFIRM_MS });
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
			// Not awaited here: this timeout path already ends in `reject()`,
			// and every caller's own `finally` block separately awaits its own
			// `killProcessTree(child)` call, which fully covers cleanup.
			killProcessTree(child).catch(() => {});
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
		// Non-Windows only: makes the spawned process the leader of its own
		// new process group (pgid === pid), so killProcessTree() can signal
		// the entire group — including whatever `sh -c "…"` itself spawns
		// (pnpm, astro, vite, esbuild helpers, …) — via a single negative-pid
		// kill, not just the immediate shell wrapper. Windows has no
		// equivalent concept; `taskkill /T /F` already walks the real PID
		// tree there regardless of this flag.
		detached: process.platform !== "win32",
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
			// Confirmed regression fix (scripts/build-presentation-runtime.mjs
			// `stripBundlerRegionMarkers`): Rollup's own auto-inserted
			// `//#region <path>`/`//#endregion` module-boundary comments used to
			// reveal this project's internal src/lib/*.ts file layout inside a
			// publicly downloadable artifact.
			assert.ok(
				!code.includes("//#region") && !code.includes("//#endregion"),
				"runtime asset response still contains bundler region-marker comments revealing internal src/lib paths",
			);

			// The same already-running dev server also serves the two
			// Static-Microsite-only minified variants (scripts/vite-plugin-presentation-runtime-dev.mjs),
			// built from the exact same runtime source and CSS files as the
			// readable assets already asserted above — same server, same
			// in-memory build functions, never a second implementation.
			const minResponse = await fetch(
				`http://localhost:${port}${MIN_RUNTIME_ROUTE}`,
			);
			assert.equal(minResponse.status, 200);
			const minCode = await minResponse.text();
			assert.ok(
				minCode.includes(MIN_RUNTIME_CODE_MARKER),
				"minified runtime asset response did not contain the expected compiled marker",
			);
			assert.ok(
				!minCode.includes("//#region") && !minCode.includes("//#endregion"),
				"minified runtime asset response still contains bundler region-marker comments",
			);
			assertStructurallyMinified(minCode, code, "dev-served runtime JS");

			const cssResponse = await fetch(`http://localhost:${port}${CSS_ROUTE}`);
			assert.equal(cssResponse.status, 200);
			const css = await cssResponse.text();
			assert.ok(
				css.includes(PRESENTATION_CSS_MARKER) && css.includes(FRAME_CSS_MARKER),
				"minified Presentation CSS response is missing an expected selector from either source file",
			);
			assert.ok(
				css.indexOf(PRESENTATION_CSS_MARKER) < css.indexOf(FRAME_CSS_MARKER),
				"minified Presentation CSS response does not preserve the Presentation-then-Frame order",
			);
			assert.doesNotMatch(
				css,
				/\/\*/,
				"minified Presentation CSS response still contains a comment opening",
			);
			assert.doesNotMatch(css, /docs\//);
			assert.doesNotMatch(css, /src\/(lib|components)\//);
			assert.match(
				css,
				/\.presentation-canvas\{/,
				"minified Presentation CSS response does not use compact selector formatting",
			);
		} finally {
			await killProcessTree(child);
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
			await killProcessTree(child);
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
			// Confirmed regression fix (scripts/build-presentation-runtime.mjs
			// `stripBundlerRegionMarkers`) against the real production build
			// output, not just the dev-server-served response above.
			assert.ok(
				!distRuntimeCode.includes("//#region") &&
					!distRuntimeCode.includes("//#endregion"),
				"dist/client/generated/comparison-presentation-runtime.js still contains bundler region-marker comments revealing internal src/lib paths",
			);

			// Static-Microsite-only minified runtime — same source, same
			// production build (scripts/build-presentation-runtime.mjs
			// `buildPresentationRuntimeCode({ minify: true })`), written
			// alongside the readable variant above, never a second
			// implementation.
			const distRuntimeMinPath = join(
				distDir,
				"client",
				"generated",
				"comparison-presentation-runtime.min.js",
			);
			assert.ok(
				existsSync(distRuntimeMinPath),
				"dist/client/generated/comparison-presentation-runtime.min.js is missing after pnpm build",
			);
			const distRuntimeMinCode = readFileSync(distRuntimeMinPath, "utf8");
			assert.ok(distRuntimeMinCode.includes(MIN_RUNTIME_CODE_MARKER));
			assert.ok(
				!distRuntimeMinCode.includes("//#region") &&
					!distRuntimeMinCode.includes("//#endregion"),
				"dist/client/generated/comparison-presentation-runtime.min.js still contains bundler region-marker comments",
			);
			assertStructurallyMinified(
				distRuntimeMinCode,
				distRuntimeCode,
				"production runtime JS",
			);

			// Static-Microsite-only minified Presentation CSS — same two source
			// files Standalone HTML still reads unminified via its own `?raw`
			// imports (src/lib/generate-standalone-html.ts, untouched by this
			// change).
			const distCssMinPath = join(
				distDir,
				"client",
				"generated",
				"comparison-presentation.min.css",
			);
			assert.ok(
				existsSync(distCssMinPath),
				"dist/client/generated/comparison-presentation.min.css is missing after pnpm build",
			);
			const distCssMin = readFileSync(distCssMinPath, "utf8");
			assert.ok(
				distCssMin.includes(PRESENTATION_CSS_MARKER) &&
					distCssMin.includes(FRAME_CSS_MARKER),
				"dist/client/generated/comparison-presentation.min.css is missing an expected selector from either source file",
			);
			assert.ok(
				distCssMin.indexOf(PRESENTATION_CSS_MARKER) <
					distCssMin.indexOf(FRAME_CSS_MARKER),
				"dist/client/generated/comparison-presentation.min.css does not preserve the Presentation-then-Frame order",
			);
			assert.doesNotMatch(distCssMin, /\/\*/);
			assert.doesNotMatch(distCssMin, /docs\//);
			assert.doesNotMatch(distCssMin, /src\/(lib|components)\//);
			assert.match(distCssMin, /\.presentation-canvas\{/);

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
			await killProcessTree(child);
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
