// Same real-`wp-env`-and-WP-CLI approach as ../wp-env-helpers.mjs, but
// targeting a SEPARATE, isolated wp-env instance: this directory's own
// .wp-env.json, which bind-mounts no plugin at all (a genuinely vanilla
// WordPress instance) and only exposes the already-generated artifact ZIP
// via a `mappings` entry. @wordpress/env keys its Docker container names off
// a hash of the config file's own absolute path, so passing `--config` here
// guarantees this never collides with, starts, stops, or destroys the main
// shared instance's containers (the one ../wp-env-helpers.mjs and every
// other test file in this directory operates on).

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { quoteArgForShell } from "../wp-env-helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = join(HERE, ".wp-env.json");

// `wp-env` resolves a `mappings` entry's relative local path against the
// *process's own cwd*, not against the config file's own directory
// (confirmed empirically: running from `integrations/wordpress` with a
// config in `tests/fresh-install/` mounted `integrations/wordpress/artifact`
// instead of `tests/fresh-install/artifact`). `npx` itself still resolves
// `wp-env` correctly from here by walking up to `integrations/wordpress/`'s
// own node_modules, so running from HERE fixes the mapping without needing a
// machine-specific absolute path in the checked-in .wp-env.json.
export function runWpEnvFresh(args, options = {}) {
	return execFileSync(
		"npx",
		["wp-env", "--config", CONFIG_PATH, ...args].map(quoteArgForShell),
		{
			cwd: HERE,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			shell: true,
			...options,
		},
	);
}

export function wpCliFresh(args) {
	try {
		return execFileSync(
			"npx",
			[
				"wp-env",
				"--config",
				CONFIG_PATH,
				"run",
				"cli",
				"wp",
				...args,
			].map(quoteArgForShell),
			{
				cwd: HERE,
				encoding: "utf8",
				shell: true,
			},
		);
	} catch (error) {
		const stdout = error.stdout ?? "";
		const stderr = error.stderr ?? "";
		throw new Error(
			`wp ${args.join(" ")} failed (fresh-install instance):\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
		);
	}
}
