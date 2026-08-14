<?php

namespace Joomla\Plugin\Content\Sameview\Extension;

use Joomla\CMS\Event\Content\ContentPrepareEvent;
use Joomla\CMS\Plugin\CMSPlugin;
use Joomla\Component\Sameviewcomparisons\Administrator\Helper\ComparisonRenderHelper;
use Joomla\Event\SubscriberInterface;

// phpcs:disable PSR1.Files.SideEffects
\defined('_JEXEC') or die;
// phpcs:enable PSR1.Files.SideEffects

require_once JPATH_ADMINISTRATOR . '/components/com_sameviewcomparisons/src/Helper/ComparisonRenderHelper.php';

/**
 * Resolves `{sameview session="SESSION_ID"}` wherever it appears in
 * rendered content (docs/IMPLEMENTATION_PLAN_V1.md Phase 22; the primary
 * content-placement path per docs/JOOMLA_INTEGRATION.md "Placement"). The
 * exact same bracket-tag substitution pattern as Joomla's own core
 * plg_content_loadmodule (`{loadmodule ...}` / `{loadposition ...}`) —
 * `onContentPrepare`, one bounded regex/substitution pass over the item's
 * own `text`, never a general template-tag engine.
 *
 * Resolution goes through ComparisonRenderHelper::render(), the one shared
 * render path also used by mod_sameview_comparison's dispatcher — never a
 * second, independently maintained rendering implementation
 * (docs/JOOMLA_INTEGRATION.md "Placement": "Joomla does not implement its
 * own PHP reimplementation of Presentation rendering"). An unresolved
 * `session.id` (deleted or never-imported Comparison) is simply replaced
 * with an empty string — the public "renders nothing, reserves no space"
 * missing state (docs/EMBED_IN_WEBSITE.md "Placement Behavior After
 * Deletion").
 *
 * `require_once`s ComparisonRenderHelper.php by its own filesystem path
 * rather than relying on autoloading: this plugin runs on ordinary frontend
 * (site) requests, which do not reliably have com_sameviewcomparisons's own
 * admin-only PSR-4 namespace registered — the same reasoning already
 * documented on ComparisonImportHelper's own require_once from script.php.
 */
final class Sameview extends CMSPlugin implements SubscriberInterface
{
	private const PATTERN = '/\{sameview\s+session="([^"]*)"\}/i';

	public static function getSubscribedEvents(): array
	{
		return ['onContentPrepare' => 'onContentPrepare'];
	}

	public function onContentPrepare(ContentPrepareEvent $event): void
	{
		if ($this->getApplication()->isClient('api')) {
			return;
		}

		$item = $event->getItem();

		if (!\is_object($item) || !\property_exists($item, 'text') || $item->text === null) {
			return;
		}

		if (!\str_contains($item->text, '{sameview ')) {
			return;
		}

		$item->text = \preg_replace_callback(
			self::PATTERN,
			static function (array $match): string {
				return ComparisonRenderHelper::render($match[1]);
			},
			$item->text
		);
	}
}
