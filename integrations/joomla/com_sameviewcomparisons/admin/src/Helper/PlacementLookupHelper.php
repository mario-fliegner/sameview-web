<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\Helper;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Router\Route;
use Joomla\Database\DatabaseDriver;
use Joomla\Registry\Registry;

/**
 * Read-only placement discovery by session.id (docs/IMPLEMENTATION_PLAN_V1.md
 * Phase 24 Part A; docs/EMBED_IN_WEBSITE.md "Comparison Management": usage
 * count and concrete usages/placements "where reliably available"). Mirrors
 * the WordPress integration's own includes/placements.php
 * `sameview_find_placements()` — a bounded, two-stage lookup per placement
 * path, never a persistent index and never a whole-site scanner:
 *
 * Content placements: Stage 1 is one bounded SQL query against
 * `#__content` for a literal substring, restricted to non-trashed articles.
 * Stage 2 confirms each Stage-1 candidate's `introtext`/`fulltext` against
 * the exact same bracket-tag pattern plg_content_sameview's own
 * `onContentPrepare()` (integrations/joomla/plg_content_sameview/src/Extension/Sameview.php)
 * uses to resolve a placement at render time — never a looser
 * "looks similar" match, so a decoy string that merely resembles the tag
 * (e.g. a missing closing brace, or free text mentioning "sameview
 * session") is never reported as a placement.
 *
 * Module placements: one bounded SQL query against `#__modules`, restricted
 * to this extension's own module type — the real, already-installed
 * `mod_sameview_comparison` instances, identified by either historically
 * observed `#__modules.module` value (confirmed empirically,
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 22/23: "with and without the 'mod_'
 * prefix" — see tests/docker-helpers.mjs `resetExtensionState()`'s own
 * comment for the same finding). Each candidate's own stored `params` is
 * parsed via Joomla's native `Registry` class (the same class Joomla's own
 * module admin/dispatcher code uses to read `#__modules.params`, regardless
 * of its exact serialization) and compared for an exact `session_id` match.
 *
 * Never cached, never persisted — recomputed on every call. Only ever called
 * from the Comparison Library list view (usage count, placement links) —
 * never on every page load or public render, so it never affects
 * docs/EMBED_IN_WEBSITE.md "Performance and Resource Loading".
 *
 * Deliberately a plain, explicitly `require_once`-loaded class alongside
 * ComparisonRenderHelper's own established reasoning, though in practice
 * only ever needed from the admin Comparisons view, which already has this
 * component's own PSR-4 namespace registered — kept consistent with the
 * other admin-only helpers regardless.
 */
final class PlacementLookupHelper
{
	// The exact pattern plg_content_sameview's own onContentPrepare() uses
	// (integrations/joomla/plg_content_sameview/src/Extension/Sameview.php
	// `Sameview::PATTERN`) — duplicated here rather than shared, since the
	// admin component must not depend on a site plugin class; kept in sync
	// deliberately, both being small, stable, already-committed literals.
	private const CONTENT_TAG_PATTERN = '/\{sameview\s+session="([^"]*)"\}/i';

	// Both historically observed #__modules.module values for this module
	// type (see this file's own header comment).
	private const MODULE_ELEMENTS = ['sameview_comparison', 'mod_sameview_comparison'];

	/**
	 * Every confirmed placement of the given session_id, as a plain list of
	 * `{ type: 'article'|'module', id, title, editLink }`. Report only
	 * confirmed usages; zero results means "no placements found", never
	 * "not used" — this is a reliable lower bound, not proof of non-use
	 * (mirrors includes/placements.php's own Phase 18 finding).
	 *
	 * @return array<int, array{type: string, id: int, title: string, editLink: string}>
	 */
	public static function findPlacements(string $sessionId): array
	{
		if ($sessionId === '') {
			return [];
		}

		return array_merge(
			self::findContentPlacements($sessionId),
			self::findModulePlacements($sessionId)
		);
	}

	/**
	 * @return array<int, array{type: string, id: int, title: string, editLink: string}>
	 */
	private static function findContentPlacements(string $sessionId): array
	{
		$db = self::getDatabase();
		$like = '%{sameview%';
		$query = $db->getQuery(true)
			->select($db->quoteName(['id', 'title', 'introtext', 'fulltext']))
			->from($db->quoteName('#__content'))
			->where($db->quoteName('state') . ' != -2')
			->extendWhere(
				'AND',
				[
					$db->quoteName('introtext') . ' LIKE :likeIntrotext',
					$db->quoteName('fulltext') . ' LIKE :likeFulltext',
				],
				'OR'
			)
			->bind(':likeIntrotext', $like)
			->bind(':likeFulltext', $like);
		$db->setQuery($query);
		$candidates = $db->loadObjectList();

		$placements = [];
		foreach ($candidates as $candidate) {
			$text = (string) $candidate->introtext . (string) $candidate->fulltext;

			if (!preg_match_all(self::CONTENT_TAG_PATTERN, $text, $matches)) {
				continue;
			}

			if (!in_array($sessionId, $matches[1], true)) {
				continue;
			}

			$placements[] = [
				'type' => 'article',
				'id' => (int) $candidate->id,
				'title' => (string) $candidate->title,
				'editLink' => Route::_('index.php?option=com_content&task=article.edit&id=' . (int) $candidate->id, false),
			];
		}

		return $placements;
	}

	/**
	 * @return array<int, array{type: string, id: int, title: string, editLink: string}>
	 */
	private static function findModulePlacements(string $sessionId): array
	{
		$db = self::getDatabase();
		$query = $db->getQuery(true)
			->select($db->quoteName(['id', 'title', 'params']))
			->from($db->quoteName('#__modules'))
			->where($db->quoteName('module') . ' IN (' . implode(',', array_map([$db, 'quote'], self::MODULE_ELEMENTS)) . ')');
		$db->setQuery($query);
		$candidates = $db->loadObjectList();

		$placements = [];
		foreach ($candidates as $candidate) {
			$params = new Registry((string) $candidate->params);

			if ($params->get('session_id', '') !== $sessionId) {
				continue;
			}

			$placements[] = [
				'type' => 'module',
				'id' => (int) $candidate->id,
				'title' => (string) $candidate->title,
				'editLink' => Route::_('index.php?option=com_modules&task=module.edit&id=' . (int) $candidate->id . '&client_id=0', false),
			];
		}

		return $placements;
	}

	private static function getDatabase(): DatabaseDriver
	{
		/** @var DatabaseDriver $db */
		$db = Factory::getContainer()->get(DatabaseDriver::class);

		return $db;
	}
}
