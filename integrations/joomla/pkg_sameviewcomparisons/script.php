<?php

/**
 * Post-install lifecycle for pkg_sameviewcomparisons.
 *
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 22 (UX follow-up): a site operator
 * installing the package expects the whole feature — including placement —
 * to work immediately, with no hidden manual step
 * (docs/JOOMLA_INTEGRATION.md "Persistent Integration": "a site operator
 * only ever performs one native install action"). Joomla registers every
 * newly installed plugin disabled by default (an ordinary, deliberate
 * precaution for arbitrary third-party plugins); since
 * plg_content_sameview and plg_editors-xtd_sameview are not independent
 * third-party behavior but the placement mechanisms of the very feature the
 * operator just chose to install, `postflight()` here enables both of them
 * automatically on a genuine first install only. mod_sameview_comparison is
 * deliberately left untouched: modules already register enabled by default
 * (confirmed empirically), and using one still requires the operator to
 * explicitly create and place a module instance regardless — there is no
 * hidden step to remove there.
 *
 * Bound to `postflight()`, and only acting when `$route === 'install'`,
 * deliberately: confirmed empirically against real Joomla 6.1.2 and 5.4.7
 * instances (libraries/src/Installer/Adapter/InstallerAdapter.php
 * `install()`) that `copyBaseFiles()` — which, for a package, installs
 * every bundled child extension completely, including each child's own
 * `#__extensions` row — always runs before `triggerManifestScript($route)`
 * and before `triggerManifestScript('postflight')`. `postflight()` is
 * therefore the latest available hook, guaranteed to run only after both
 * companion plugins already exist in `#__extensions`. Mirrors this
 * package's own component script.php's seed-import guard: only the
 * `'install'` route (a genuine first install) is acted on, never `'update'`
 * (every later reinstall of an already-registered package, including a
 * future code-only release) — an operator who has deliberately disabled
 * either plugin after install keeps that choice across updates, exactly as
 * docs/JOOMLA_INTEGRATION.md "Persistent Integration Versioning" already
 * requires for Comparison content ("Updating the integration does not
 * alter Comparison content") applied the same way to operator-chosen
 * extension state.
 *
 * Uses only native Joomla APIs, never a raw SQL UPDATE: `ExtensionHelper::
 * getExtensionRecord()` for lookup (the same helper Joomla's own core code
 * uses to resolve an extension row by element/type/folder) and
 * `Joomla\CMS\Table\Extension` to load, mutate and `store()` the row — the
 * exact same Table class Joomla's own Plugin Manager UI uses internally to
 * toggle a plugin's enabled state.
 *
 * Deliberately a plain global class, not a namespaced one, matching
 * com_sameviewcomparisons/script.php's own established reasoning: no
 * dependency on this package's own PSR-4 namespace being registered yet.
 * Every class used here (`ExtensionHelper`, `Table\Extension`, `Factory`)
 * is Joomla's own core API, already autoloadable at this point regardless.
 */

defined('_JEXEC') or die;

use Joomla\CMS\Extension\ExtensionHelper;
use Joomla\CMS\Factory;
use Joomla\CMS\Table\Extension;
use Joomla\Database\DatabaseDriver;

class Pkg_SameviewcomparisonsInstallerScript
{
	// docs/JOOMLA_INTEGRATION.md "Placement": the two placement mechanisms —
	// never mod_sameview_comparison, see this file's own header comment.
	private const PLACEMENT_PLUGINS = [
		['element' => 'sameview', 'folder' => 'content'],
		['element' => 'sameview', 'folder' => 'editors-xtd'],
	];

	public function postflight($route, $parent): bool
	{
		if ($route === 'install') {
			$this->enablePlacementPlugins();
		}

		return true;
	}

	private function enablePlacementPlugins(): void
	{
		$db = Factory::getContainer()->get(DatabaseDriver::class);

		foreach (self::PLACEMENT_PLUGINS as $plugin) {
			$record = ExtensionHelper::getExtensionRecord($plugin['element'], 'plugin', 0, $plugin['folder']);

			if ($record === null) {
				continue;
			}

			$table = new Extension($db);

			if (!$table->load($record->extension_id) || (int) $table->enabled === 1) {
				continue;
			}

			$table->enabled = 1;
			$table->store();
		}
	}
}
