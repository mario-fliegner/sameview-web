<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\Helper;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Uri\Uri;
use Joomla\Database\DatabaseDriver;

/**
 * The one shared render path for placing a stored Comparison
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 22 "a common Comparison-render
 * path"), used identically by plg_content_sameview's `onContentPrepare`
 * substitution and mod_sameview_comparison's dispatcher — never a second,
 * independently maintained rendering implementation. Mirrors the WordPress
 * integration's own includes/render.php `sameview_render_comparison_embed()`
 * line for line: resolves `session.id` to the current stored row (never a
 * stored database id, so a delete/re-import under the same `session.id`
 * keeps existing placements working automatically, per
 * docs/EMBED_IN_WEBSITE.md "Placement Behavior After Deletion"), reads the
 * already-validated stored manifest, resolves asset URLs and localized copy
 * strings, and hands all of it to the shared JS renderer
 * (src/lib/comparison-embed-runtime-entry.ts, bundled at
 * media/com_sameviewcomparisons/js/) as one plain JSON payload per
 * placement. Never builds Presentation markup itself
 * (docs/JOOMLA_INTEGRATION.md "Placement": "no PHP reimplementation of
 * Presentation rendering").
 *
 * Returns an empty string when the referenced Comparison cannot be found —
 * the public "renders nothing, reserves no space" missing state
 * (docs/EMBED_IN_WEBSITE.md "Placement Behavior After Deletion").
 *
 * Deliberately a plain, explicitly `require_once`-loaded class, like
 * ComparisonImportHelper: plg_content_sameview and mod_sameview_comparison
 * are separate extensions whose own frontend (site) requests never reliably
 * have this admin-only component's own PSR-4 namespace registered, so both
 * callers `require_once` this file by its own filesystem path
 * (JPATH_ADMINISTRATOR . '/components/com_sameviewcomparisons/src/Helper/ComparisonRenderHelper.php')
 * rather than depending on autoloading.
 */
final class ComparisonRenderHelper
{
	private const ASSET_BASE_DIR = 'com_sameviewcomparisons/comparisons';

	private const EMBED_ASSET_NAME = 'com_sameviewcomparisons.embed';

	/**
	 * Renders one placement, or '' if `sessionId` does not resolve to a
	 * currently stored Comparison.
	 */
	public static function render(string $sessionId): string
	{
		if ($sessionId === '') {
			return '';
		}

		$row = self::findBySessionId($sessionId);

		if ($row === null) {
			return '';
		}

		$manifest = json_decode((string) $row->manifest_json, true);

		if (!is_array($manifest)) {
			return '';
		}

		self::enqueueEmbedAssets();

		$assetsUrl = self::assetsUrlFor($sessionId);
		$hasBrandingAsset = is_file(self::assetDirFor($sessionId) . '/branding.png');

		// docs/IMPLEMENTATION_PLAN_V1.md Phase 17/22 cache/versioning contract
		// (mirrored from the WordPress integration unchanged): the stored,
		// deterministic Outcome Fingerprint as the `?v=` token, so a browser
		// or intermediary cache reliably picks up updated image bytes after
		// an atomic Comparison update even though the asset path itself never
		// changes.
		$fingerprint = (string) $row->outcome_fingerprint;
		$versionArg = $fingerprint !== '' ? '?v=' . rawurlencode($fingerprint) : '';

		$payload = [
			'presentation' => $manifest['presentation'] ?? new \stdClass(),
			'visibility' => $manifest['visibility'] ?? new \stdClass(),
			'configuration' => $manifest['configuration'] ?? new \stdClass(),
			'branding' => $manifest['branding'] ?? ['kind' => 'none'],
			'initialSliderPosition' => $manifest['initialSliderPosition'] ?? 0.5,
			'assets' => [
				'referenceSrc' => $assetsUrl . '/reference.jpg' . $versionArg,
				'captureSrc' => $assetsUrl . '/capture.jpg' . $versionArg,
				'brandingSrc' => $hasBrandingAsset ? $assetsUrl . '/branding.png' . $versionArg : null,
			],
			'copy' => self::embedCopyStrings(),
		];

		$jsRequiredText = self::text('COM_SAMEVIEWCOMPARISONS_EMBED_JS_REQUIRED', 'JavaScript is required to view this SameView Comparison.');

		return sprintf(
			'<div class="sameview-comparison-embed" data-sameview-embed="%1$s"><noscript>%2$s</noscript></div>',
			htmlspecialchars(json_encode($payload), ENT_QUOTES, 'UTF-8'),
			htmlspecialchars($jsRequiredText, ENT_QUOTES, 'UTF-8')
		);
	}

	/**
	 * Every currently stored Comparison, identified by title and
	 * reference-to-capture period label only (docs/JOOMLA_INTEGRATION.md
	 * "No Editor Preview": "Selecting a Comparison for placement is by
	 * identifying information only ... never by rendering its content") — the
	 * one shared data source for both the editor-button modal picker and the
	 * module's own field picker.
	 *
	 * @return array<int, array{sessionId: string, title: string, periodLabel: string}>
	 */
	public static function findActiveComparisons(): array
	{
		$db = self::getDatabase();
		$query = $db->getQuery(true)
			->select($db->quoteName(['session_id', 'title', 'manifest_json']))
			->from($db->quoteName('#__sameview_comparisons'))
			->order($db->quoteName('modified') . ' DESC');
		$db->setQuery($query);
		$rows = $db->loadObjectList();

		$comparisons = [];
		foreach ($rows as $row) {
			$manifest = json_decode((string) $row->manifest_json, true);

			$comparisons[] = [
				'sessionId' => (string) $row->session_id,
				'title' => (string) $row->title,
				'periodLabel' => self::periodLabelFor(is_array($manifest) ? $manifest : []),
			];
		}

		return $comparisons;
	}

	/**
	 * The "reference → capture" period label, from the same already-localized
	 * labels the Outcome Snapshot derived at generation time — never
	 * recomputed from raw dates here (docs/EMBED_IN_WEBSITE.md "Editing
	 * Boundary": Joomla is not a second SameView editor). Shared by
	 * findActiveComparisons() above (the picker) and, as of
	 * docs/IMPLEMENTATION_PLAN_V1.md Phase 24 Part A, the Comparison Library
	 * list view — the exact same value, never computed twice.
	 */
	public static function periodLabelFor(array $manifest): string
	{
		$presentation = $manifest['presentation'] ?? [];
		$referenceLabel = is_string($presentation['referenceLabel'] ?? null) ? $presentation['referenceLabel'] : '';
		$captureLabel = is_string($presentation['captureLabel'] ?? null) ? $presentation['captureLabel'] : '';

		return trim($referenceLabel . ($referenceLabel !== '' && $captureLabel !== '' ? ' – ' : '') . $captureLabel);
	}

	/**
	 * Registers and conditionally loads the shared Embed runtime script via
	 * Joomla's own native Web Asset system (docs/JOOMLA_INTEGRATION.md
	 * "Frontend Delivery": "Assets are registered and loaded through Joomla's
	 * own native web-asset system"). Called only from inside render() above —
	 * i.e. only when a placement is actually about to be rendered on the
	 * current page — never unconditionally, so a page without any SameView
	 * placement never loads these assets
	 * (docs/EMBED_IN_WEBSITE.md "Performance and Resource Loading").
	 *
	 * No corresponding useStyle(): like the WordPress integration
	 * (Phase 17 Decision 76), the Embed CSS is fetched and injected as a
	 * `<style>` element inside each placement's own Shadow Root by the
	 * runtime script itself — a `<link>` in the page's own `<head>` could
	 * never reach inside a Shadow Root anyway.
	 *
	 * `addExtensionRegistryFile('com_sameviewcomparisons')` is required
	 * before `useScript()` here: confirmed against a real Joomla 6.1.2
	 * instance that Joomla's own SiteApplication/AdministratorApplication
	 * only auto-registers the *currently active* component's own
	 * `media/<name>/joomla.asset.json` (libraries/src/Application/SiteApplication.php,
	 * AdministratorApplication.php) — never an unrelated component's, such
	 * as ours being rendered from inside a com_content article or an
	 * arbitrary module position. Without this explicit call, `useScript()`
	 * throws `UnknownAssetException` ("There is no
	 * "com_sameviewcomparisons.embed" asset ... in the registry"), the same
	 * pattern core Joomla itself uses for a field layout needing another
	 * component's assets (administrator/components/com_scheduler/layouts/form/field/webcron_link.php).
	 *
	 * docs/IMPLEMENTATION_PLAN_V1.md Phase 23 (Frontend Delivery
	 * verification): this script's own `joomla.asset.json` entry declares no
	 * per-asset `"version"`, so `WebAssetItem::getVersion()` defaults to
	 * `'auto'`. Confirmed against real Joomla 6.1.2 core source
	 * (`Document\Renderer\Html\ScriptsRenderer`) and empirically against a
	 * real instance that this resolves to the site's own, globally cached
	 * Joomla media version (`Version::getMediaVersion()`), appended as
	 * `?<token>` — never a per-extension value of ours. That cache is
	 * refreshed automatically by Joomla itself on every successful extension
	 * install (`Installer::install()` → `Application::flushAssets()` →
	 * `Version::refreshMediaVersion()`), so a genuine code-only update of
	 * this package (Phase 22 update-lifecycle fix) already changes this
	 * script's own effective URL with no extra logic needed here — see
	 * frontend-delivery-lifecycle.test.mjs for the real-instance proof.
	 */
	private static function enqueueEmbedAssets(): void
	{
		$wa = Factory::getApplication()->getDocument()->getWebAssetManager();
		$wa->getRegistry()->addExtensionRegistryFile('com_sameviewcomparisons');
		$wa->useScript(self::EMBED_ASSET_NAME);
	}

	private static function embedCopyStrings(): array
	{
		return [
			'referenceAlt' => self::text('COM_SAMEVIEWCOMPARISONS_EMBED_REFERENCE_ALT', 'Reference photo'),
			'captureAlt' => self::text('COM_SAMEVIEWCOMPARISONS_EMBED_CAPTURE_ALT', 'Capture photo'),
			'sliderLabel' => self::text('COM_SAMEVIEWCOMPARISONS_EMBED_SLIDER_LABEL', 'Comparison position'),
			'loadingLabel' => self::text('COM_SAMEVIEWCOMPARISONS_EMBED_LOADING_LABEL', 'Loading comparison…'),
		];
	}

	/**
	 * docs/EMBED_IN_WEBSITE.md "Localization": frontend/system text follows
	 * the current frontend page language at render time, never the SameView
	 * Web generation-time locale. The component's own admin-side language
	 * files (integrations/joomla/com_sameviewcomparisons/admin/language/)
	 * are the one place these strings are translated; a site-context caller
	 * (content plugin, module) never has them auto-loaded the way an admin
	 * request does, so they are loaded explicitly here, against whichever
	 * language is already active for the current request.
	 */
	private static function text(string $key, string $fallback): string
	{
		Factory::getLanguage()->load('com_sameviewcomparisons', JPATH_ADMINISTRATOR);
		$translated = Text::_($key);

		return $translated === $key ? $fallback : $translated;
	}

	private static function findBySessionId(string $sessionId): ?object
	{
		$db = self::getDatabase();
		$query = $db->getQuery(true)
			->select($db->quoteName(['title', 'outcome_fingerprint', 'manifest_json']))
			->from($db->quoteName('#__sameview_comparisons'))
			->where($db->quoteName('session_id') . ' = :sessionId')
			->bind(':sessionId', $sessionId);
		$db->setQuery($query);

		$row = $db->loadObject();

		return $row ?: null;
	}

	/**
	 * Public since docs/IMPLEMENTATION_PLAN_V1.md Phase 24 Part A: the
	 * Comparison Library list view reuses this exact path to check for and
	 * link a Comparison's already-stored reference.jpg as its thumbnail —
	 * never a second, separately-maintained asset-path computation.
	 */
	public static function assetDirFor(string $sessionId): string
	{
		return JPATH_ROOT . '/media/' . self::ASSET_BASE_DIR . '/' . md5($sessionId);
	}

	public static function assetsUrlFor(string $sessionId): string
	{
		return rtrim(Uri::root(), '/') . '/media/' . self::ASSET_BASE_DIR . '/' . md5($sessionId);
	}

	private static function getDatabase(): DatabaseDriver
	{
		/** @var DatabaseDriver $db */
		$db = Factory::getContainer()->get(DatabaseDriver::class);

		return $db;
	}
}
