<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\Helper;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\Database\DatabaseDriver;
use Joomla\Database\ParameterType;
use Joomla\Filesystem\Folder;

/**
 * The single Add/Update/no-op Comparison import engine
 * (docs/EMBED_IN_WEBSITE.md "Comparison Lifecycle"), used identically by
 * the first-installation seed bootstrap (script.php `install()`) and the
 * `Add comparison` admin upload controller
 * (Controller\ComparisonsController::upload()) — never a second,
 * independently maintained import implementation, mirroring the WordPress
 * integration's own `sameview_import_seed()` used by both its activation
 * hook and its admin upload handler.
 *
 * Deliberately a plain, explicitly `require_once`-loaded, namespaced class
 * rather than relying on Joomla's own PSR-4 autoloading for it: script.php
 * runs before this component's own namespace is registered with the
 * autoloader (docs/IMPLEMENTATION_PLAN_V1.md Phase 19), so script.php
 * `require_once`s this file by its own filesystem path instead — this still
 * makes the fully qualified class name available for the rest of that
 * request, with no dependency on autoloading having run first.
 */
final class ComparisonImportHelper
{
	// Bumped only if comparison.json's own shape changes in a way this
	// integration could not safely interpret — must stay in sync with
	// src/lib/comparison-manifest.ts COMPARISON_MANIFEST_FORMAT_VERSION.
	public const MANIFEST_FORMAT_VERSION = 1;

	// docs/JOOMLA_INTEGRATION.md "Storage Model": under Joomla's own media/
	// folder, not images/ (the Media Manager's default scanned root).
	private const ASSET_BASE_DIR = 'com_sameviewcomparisons/comparisons';

	private const REQUIRED_ASSET_FILES = ['reference.jpg', 'capture.jpg'];

	/**
	 * Imports a seed/ directory (comparison.json + reference.jpg + capture.jpg
	 * + optional branding.png) — unknown session.id adds a new Comparison,
	 * changed Outcome Fingerprint atomically updates it, unchanged is a
	 * no-op, per docs/EMBED_IN_WEBSITE.md "Comparison Lifecycle".
	 *
	 * @return array{status: 'added'|'updated'|'no-op'|'rejected', message: string, id?: int}
	 */
	public static function importSeed(string $seedDir): array
	{
		$validated = self::validateSeed($seedDir);

		if ($validated === null) {
			return [
				'status' => 'rejected',
				'message' => 'Invalid SameView Comparison package, or the SameView integration must be updated first.',
			];
		}

		[$manifest, $manifestJson] = $validated;
		$sessionId = (string) $manifest['sessionId'];
		$outcomeFingerprint = (string) $manifest['outcomeFingerprint'];
		$title = self::resolveTitle($manifest);

		$db = self::getDatabase();
		$existingId = self::findBySessionId($db, $sessionId);

		if ($existingId !== null) {
			$currentFingerprint = self::getFingerprint($db, $existingId);

			// docs/EMBED_IN_WEBSITE.md "Comparison Lifecycle": "For an exact
			// duplicate, no copy is created, assets are not unnecessarily
			// rewritten, and placements remain unchanged."
			if ($currentFingerprint === $outcomeFingerprint) {
				return ['status' => 'no-op', 'message' => 'Comparison already up to date.'];
			}
		}

		try {
			self::replaceAssets($sessionId, $seedDir);
		} catch (\RuntimeException $e) {
			return ['status' => 'rejected', 'message' => $e->getMessage()];
		}

		$now = Factory::getDate()->toSql();

		if ($existingId !== null) {
			$query = $db->getQuery(true)
				->update($db->quoteName('#__sameview_comparisons'))
				->set($db->quoteName('outcome_fingerprint') . ' = :fingerprint')
				->set($db->quoteName('title') . ' = :title')
				->set($db->quoteName('manifest_json') . ' = :manifestJson')
				->set($db->quoteName('modified') . ' = :modified')
				->where($db->quoteName('id') . ' = :id')
				->bind(':fingerprint', $outcomeFingerprint)
				->bind(':title', $title)
				->bind(':manifestJson', $manifestJson)
				->bind(':modified', $now)
				->bind(':id', $existingId, ParameterType::INTEGER);
			$db->setQuery($query)->execute();

			return ['status' => 'updated', 'message' => 'Comparison updated.', 'id' => $existingId];
		}

		$query = $db->getQuery(true)
			->insert($db->quoteName('#__sameview_comparisons'))
			->columns(
				$db->quoteName(
					['session_id', 'outcome_fingerprint', 'title', 'manifest_json', 'created', 'modified']
				)
			)
			->values(':sessionId, :fingerprint, :title, :manifestJson, :created, :modified')
			->bind(':sessionId', $sessionId)
			->bind(':fingerprint', $outcomeFingerprint)
			->bind(':title', $title)
			->bind(':manifestJson', $manifestJson)
			->bind(':created', $now)
			->bind(':modified', $now);
		$db->setQuery($query)->execute();

		return ['status' => 'added', 'message' => 'Comparison added.', 'id' => (int) $db->insertid()];
	}

	/**
	 * Deletes a stored Comparison's database row and stored assets
	 * (docs/EMBED_IN_WEBSITE.md "Comparison Management": Delete). Never
	 * touches any placement — none exist yet (docs/IMPLEMENTATION_PLAN_V1.md
	 * Phase 21 "Not included"; Phase 22 introduces placements).
	 */
	public static function deleteComparison(int $id): bool
	{
		$db = self::getDatabase();
		$query = $db->getQuery(true)
			->select($db->quoteName('session_id'))
			->from($db->quoteName('#__sameview_comparisons'))
			->where($db->quoteName('id') . ' = :id')
			->bind(':id', $id, ParameterType::INTEGER);
		$db->setQuery($query);
		$sessionId = $db->loadResult();

		if ($sessionId === null) {
			return false;
		}

		$deleteQuery = $db->getQuery(true)
			->delete($db->quoteName('#__sameview_comparisons'))
			->where($db->quoteName('id') . ' = :id')
			->bind(':id', $id, ParameterType::INTEGER);
		$db->setQuery($deleteQuery)->execute();

		$assetDir = self::assetDirFor($sessionId);
		if (is_dir($assetDir)) {
			Folder::delete($assetDir);
		}

		return true;
	}

	/**
	 * @return array{0: array, 1: string}|null Decoded manifest + its own
	 *   original, unmodified JSON text (stored verbatim, never re-encoded).
	 */
	private static function validateSeed(string $seedDir): ?array
	{
		$manifestPath = $seedDir . '/comparison.json';

		if (!is_file($manifestPath)) {
			return null;
		}

		$manifestJson = file_get_contents($manifestPath);

		if ($manifestJson === false || $manifestJson === '') {
			return null;
		}

		$manifest = json_decode($manifestJson, true);

		if (!is_array($manifest)) {
			return null;
		}

		if (!isset($manifest['formatVersion']) || !is_int($manifest['formatVersion'])) {
			return null;
		}

		// docs/JOOMLA_INTEGRATION.md "Persistent Integration Versioning": a
		// newer format than this integration understands is rejected
		// completely, never partially interpreted.
		if ($manifest['formatVersion'] > self::MANIFEST_FORMAT_VERSION) {
			return null;
		}

		if (empty($manifest['sessionId']) || !is_string($manifest['sessionId'])) {
			return null;
		}

		if (empty($manifest['outcomeFingerprint']) || !is_string($manifest['outcomeFingerprint'])) {
			return null;
		}

		foreach (self::REQUIRED_ASSET_FILES as $requiredFile) {
			$path = $seedDir . '/' . $requiredFile;

			if (!is_file($path) || filesize($path) === 0 || @getimagesize($path) === false) {
				return null;
			}
		}

		$brandingPath = $seedDir . '/branding.png';
		if (is_file($brandingPath) && @getimagesize($brandingPath) === false) {
			return null;
		}

		return [$manifest, $manifestJson];
	}

	private static function resolveTitle(array $manifest): string
	{
		$title = $manifest['presentation']['title'] ?? null;

		if (is_string($title) && $title !== '') {
			return $title;
		}

		return 'SameView Comparison';
	}

	private static function findBySessionId(DatabaseDriver $db, string $sessionId): ?int
	{
		$query = $db->getQuery(true)
			->select($db->quoteName('id'))
			->from($db->quoteName('#__sameview_comparisons'))
			->where($db->quoteName('session_id') . ' = :sessionId')
			->bind(':sessionId', $sessionId);
		$db->setQuery($query);
		$id = $db->loadResult();

		return $id !== null ? (int) $id : null;
	}

	private static function getFingerprint(DatabaseDriver $db, int $id): ?string
	{
		$query = $db->getQuery(true)
			->select($db->quoteName('outcome_fingerprint'))
			->from($db->quoteName('#__sameview_comparisons'))
			->where($db->quoteName('id') . ' = :id')
			->bind(':id', $id, ParameterType::INTEGER);
		$db->setQuery($query);

		return $db->loadResult();
	}

	private static function assetDirFor(string $sessionId): string
	{
		return JPATH_ROOT . '/media/' . self::ASSET_BASE_DIR . '/' . md5($sessionId);
	}

	/**
	 * Atomic asset replacement (docs/EMBED_IN_WEBSITE.md "Asset Replacement"):
	 * copy into a fresh temp directory, archive the previous directory aside,
	 * activate the new one, then delete the archived one — mirrors the
	 * WordPress integration's own rename-based atomic swap. A failure at any
	 * point before the final rename leaves the previously working directory
	 * completely untouched.
	 */
	private static function replaceAssets(string $sessionId, string $seedDir): void
	{
		$finalDir = self::assetDirFor($sessionId);
		$newDir = $finalDir . '.new-' . substr(md5(uniqid('', true)), 0, 8);

		if (!Folder::create($newDir)) {
			throw new \RuntimeException('Could not create a temporary asset directory.');
		}

		foreach (self::REQUIRED_ASSET_FILES as $requiredFile) {
			if (!copy($seedDir . '/' . $requiredFile, $newDir . '/' . $requiredFile)) {
				Folder::delete($newDir);

				throw new \RuntimeException('Could not copy a required Comparison asset.');
			}
		}

		$brandingSource = $seedDir . '/branding.png';
		if (is_file($brandingSource) && !copy($brandingSource, $newDir . '/branding.png')) {
			Folder::delete($newDir);

			throw new \RuntimeException('Could not copy the branding asset.');
		}

		if (!is_dir($finalDir)) {
			if (!rename($newDir, $finalDir)) {
				Folder::delete($newDir);

				throw new \RuntimeException('Could not activate the new Comparison assets.');
			}

			return;
		}

		$oldDir = $finalDir . '.old-' . substr(md5(uniqid('', true)), 0, 8);

		if (!rename($finalDir, $oldDir)) {
			Folder::delete($newDir);

			throw new \RuntimeException('Could not archive the existing Comparison assets.');
		}

		if (!rename($newDir, $finalDir)) {
			// Restore the previously working directory — the update must
			// never leave the Comparison without any working assets.
			rename($oldDir, $finalDir);

			throw new \RuntimeException('Could not activate the new Comparison assets.');
		}

		Folder::delete($oldDir);
	}

	private static function getDatabase(): DatabaseDriver
	{
		/** @var DatabaseDriver $db */
		$db = Factory::getContainer()->get(DatabaseDriver::class);

		return $db;
	}
}
