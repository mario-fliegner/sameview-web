<?php

/**
 * Install/update/uninstall lifecycle for com_sameviewcomparisons.
 *
 * docs/JOOMLA_INTEGRATION.md "Persistent Integration": installation and
 * full removal are the two native lifecycle actions Joomla applies to a
 * component; short of full removal, no native Joomla action discards
 * SameView-owned data.
 *
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 21: on a genuinely fresh install
 * (never on `update()`), imports the package's own bundled `seed/`
 * Comparison — docs/JOOMLA_INTEGRATION.md "First Installation": "installing
 * that package ... makes the currently generated Comparison immediately
 * available, without a separate manual import step." Bound to `install()`
 * only, deliberately: `update()` fires on every subsequent reinstall of an
 * already-registered extension (e.g. a future code-only release), not only
 * on a genuine first install, and re-importing whatever Comparison happens
 * to be bundled with an unrelated code update would silently alter stored
 * Comparison content — which docs/JOOMLA_INTEGRATION.md "Persistent
 * Integration Versioning" explicitly rules out ("Updating the integration
 * does not alter Comparison content"). This mirrors the WordPress
 * integration's own activation-hook-only seed bootstrap.
 *
 * `seed/` is read directly from the installer's own temporary extraction
 * directory (`$parent->getParent()->getPath('source')`), not from a
 * permanent install location: confirmed empirically against real Joomla
 * 6.1.2 and 5.4.7 instances (docs/IMPLEMENTATION_PLAN_V1.md Phase 21) that
 * this path still exists and is readable at the moment `install()` runs,
 * before Joomla's own post-install cleanup deletes it. `seed/` is
 * deliberately never declared in sameviewcomparisons.xml's own `<files>`
 * section, so it is never copied into the permanent installed component
 * directory.
 *
 * Re-confirmed unchanged under the Phase 22 `pkg_sameviewcomparisons`
 * package wrapper (again against real Joomla 6 and Joomla 5 instances):
 * Joomla's own PackageAdapter::copyBaseFiles() installs each bundled child
 * extension via a fresh `Installer` pointed directly at that child's own
 * sub-folder inside the already-extracted package (never a second
 * unpack/copy step) — so this component's own install-time "source" path
 * is exactly `<package source>/com_sameviewcomparisons`, and `seed/`
 * placed as its sibling (`.../com_sameviewcomparisons/seed`,
 * src/lib/generate-joomla-package.ts) resolves through this exact same
 * unchanged code path. No script.php change was needed for the package
 * wrapper.
 *
 * Deliberately a plain global class, not a namespaced one: Joomla loads
 * this file before the component's own PSR-4 namespace is registered with
 * the autoloader (in particular on first install), so a namespaced class
 * here would not reliably resolve. `ComparisonImportHelper` is loaded via
 * an explicit `require_once` by filesystem path instead, which works
 * regardless of autoloader/namespace-map registration state.
 *
 * Uses Joomla\Filesystem\Folder (the framework package), not
 * Joomla\CMS\Filesystem\Folder: confirmed against a real Joomla 6.1.2
 * instance that the CMS-namespaced B/C shim no longer autoloads in this
 * context in Joomla 6 (it only exists via the optional "compat6" behaviour
 * plugin) — using the framework class directly works on both supported
 * major versions.
 *
 * `ComparisonImportHelper.php` is `require_once`'d only from inside
 * `install()`, never at this file's own top level: confirmed empirically
 * against a real Joomla 6.1.2 instance (docs/IMPLEMENTATION_PLAN_V1.md
 * Phase 22) that this same script.php is also `require_once`'d by
 * `uninstall()` — and, under the `pkg_sameviewcomparisons` package wrapper,
 * `PackageAdapter::removeExtensionFiles()` deletes this component's own
 * installed folder (including `admin/src/Helper/ComparisonImportHelper.php`)
 * before invoking this class's own `uninstall()` method. A top-level
 * `require_once` therefore fails with "Failed to open stream" on every
 * uninstall — `uninstall()` never actually needs this class (it only drops
 * the table and removes the media directory), so the require simply moves
 * to the one method that does.
 *
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 22 (update-lifecycle fix):
 * `sameviewcomparisons.xml` now carries `method="upgrade"`, so `update()`
 * fires on every reinstall of an already-installed component — including
 * the one confirmed edge case where the component's own directory exists on
 * disk but no matching #__extensions row does (e.g. a previously
 * interrupted install/uninstall), in which case Joomla forces the update
 * route without ever having run `<install><sql>`, leaving
 * `#__sameview_comparisons` missing. `update()` therefore re-runs the exact
 * same install SQL file every time — safe and idempotent, since it already
 * uses `CREATE TABLE IF NOT EXISTS` for the equivalent reason on a genuine
 * first install, and simplest here since there is no actual schema change
 * to apply, only ever this one table definition. Parsed via Joomla's own
 * `Installer::splitSql()` (the same native helper `Installer::
 * parseSQLFiles()` uses for `<install><sql>`), not a hand-rolled statement
 * splitter.
 */

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\Database\DatabaseDriver;
use Joomla\Filesystem\Folder;

class Com_SameviewcomparisonsInstallerScript
{
	// docs/JOOMLA_INTEGRATION.md "Storage Model": a SameView-owned
	// directory under Joomla's own media/ folder, not under images/
	// (the Media Manager's default scanned root).
	private const ASSET_DIR = 'com_sameviewcomparisons';

	public function install($parent): bool
	{
		require_once __DIR__ . '/admin/src/Helper/ComparisonImportHelper.php';

		$this->createAssetDirectory();
		$this->importBundledSeed($parent);

		return true;
	}

	public function update($parent): bool
	{
		$this->createAssetDirectory();
		$this->ensureComparisonsTable();

		return true;
	}

	public function uninstall($parent): bool
	{
		$this->dropComparisonsTable();
		$this->removeAssetDirectory();

		return true;
	}

	private function importBundledSeed($parent): void
	{
		if (!method_exists($parent, 'getParent')) {
			return;
		}

		$installer = $parent->getParent();
		$sourcePath = $installer->getPath('source');
		$seedDir = $sourcePath . '/seed';

		// An ordinary code-only package (no bundled seed/) is a silent no-op
		// here — not every install package is expected to carry a Comparison.
		if (!is_dir($seedDir)) {
			return;
		}

		\Joomla\Component\Sameviewcomparisons\Administrator\Helper\ComparisonImportHelper::importSeed($seedDir);
	}

	private function createAssetDirectory(): void
	{
		$path = JPATH_ROOT . '/media/' . self::ASSET_DIR;

		if (!is_dir($path)) {
			Folder::create($path);
		}
	}

	private function removeAssetDirectory(): void
	{
		$path = JPATH_ROOT . '/media/' . self::ASSET_DIR;

		if (is_dir($path)) {
			Folder::delete($path);
		}
	}

	private function ensureComparisonsTable(): void
	{
		$sqlFile = __DIR__ . '/admin/sql/install.mysqli.utf8.sql';
		$buffer = file_get_contents($sqlFile);

		if ($buffer === false) {
			return;
		}

		/** @var DatabaseDriver $db */
		$db = Factory::getContainer()->get(DatabaseDriver::class);

		foreach (\Joomla\CMS\Installer\Installer::splitSql($buffer) as $query) {
			$query = trim($query);

			if ($query === '') {
				continue;
			}

			$db->setQuery($query)->execute();
		}
	}

	private function dropComparisonsTable(): void
	{
		/** @var DatabaseDriver $db */
		$db = Factory::getContainer()->get(DatabaseDriver::class);
		$db->setQuery('DROP TABLE IF EXISTS ' . $db->quoteName('#__sameview_comparisons'));
		$db->execute();
	}
}
