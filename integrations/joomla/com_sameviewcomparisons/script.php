<?php

/**
 * Install/update/uninstall lifecycle for com_sameviewcomparisons.
 *
 * docs/JOOMLA_INTEGRATION.md "Persistent Integration": installation and
 * full removal are the two native lifecycle actions Joomla applies to a
 * component; short of full removal, no native Joomla action discards
 * SameView-owned data.
 *
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 19 scope: lifecycle only — creates
 * the SameView-owned media/ storage directory on install/update and
 * removes it, together with the component's own database table, on full
 * uninstall. No seed import, no Add comparison, no placement.
 *
 * Deliberately a plain global class, not a namespaced one: Joomla loads
 * this file before the component's own PSR-4 namespace is registered with
 * the autoloader (in particular on first install), so a namespaced class
 * here would not reliably resolve.
 *
 * Uses Joomla\Filesystem\Folder (the framework package), not
 * Joomla\CMS\Filesystem\Folder: confirmed against a real Joomla 6.1.2
 * instance that the CMS-namespaced B/C shim no longer autoloads in this
 * context in Joomla 6 (it only exists via the optional "compat6" behaviour
 * plugin) — using the framework class directly works on both supported
 * major versions.
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
		$this->createAssetDirectory();

		return true;
	}

	public function update($parent): bool
	{
		$this->createAssetDirectory();

		return true;
	}

	public function uninstall($parent): bool
	{
		$this->dropComparisonsTable();
		$this->removeAssetDirectory();

		return true;
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

	private function dropComparisonsTable(): void
	{
		/** @var DatabaseDriver $db */
		$db = Factory::getContainer()->get(DatabaseDriver::class);
		$db->setQuery('DROP TABLE IF EXISTS ' . $db->quoteName('#__sameview_comparisons'));
		$db->execute();
	}
}
