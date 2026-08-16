<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\View\Comparisons;

defined('_JEXEC') or die;

use Joomla\CMS\Language\Text;
use Joomla\CMS\MVC\View\HtmlView as BaseHtmlView;
use Joomla\CMS\Toolbar\ToolbarHelper;
use Joomla\Component\Sameviewcomparisons\Administrator\Helper\ComparisonRenderHelper;
use Joomla\Component\Sameviewcomparisons\Administrator\Helper\PlacementLookupHelper;

class HtmlView extends BaseHtmlView
{
	/** @var array */
	protected $items = [];

	public function display($tpl = null): void
	{
		$this->items = $this->get('Items');

		// docs/IMPLEMENTATION_PLAN_V1.md Phase 24 Part A: decorate each row
		// with the Comparison Management data docs/EMBED_IN_WEBSITE.md
		// "Comparison Management" requires — thumbnail, reference-to-capture
		// period, usage count and concrete placements. Only ever computed for
		// this main list; the Editors-XTD picker (tmpl/comparisons/modal.php)
		// calls ComparisonRenderHelper::findActiveComparisons() directly and
		// never touches $this->items, so the picker's own render cost is
		// unaffected by the placement lookups added here.
		if ($this->getLayout() !== 'modal') {
			$this->decorateItemsWithLibraryData();
		}

		// docs/IMPLEMENTATION_PLAN_V1.md Phase 22: the `layout=modal` template
		// (tmpl/comparisons/modal.php) reuses this same view/controller for
		// the Editors-XTD button's picker dialog — a `tmpl=component` request
		// per Joomla's own native modal convention (mirrors
		// administrator/components/com_modules/tmpl/modules/modal.php, which
		// likewise renders no toolbar). The ordinary admin toolbar (Add
		// comparison, Delete) is never shown inside that dialog.
		if ($this->getLayout() !== 'modal') {
			ToolbarHelper::title(Text::_('COM_SAMEVIEWCOMPARISONS_TITLE_COMPARISONS'), 'list');
			// docs/EMBED_IN_WEBSITE.md "Comparison Management": Add comparison
			// and Delete are the two administrative library actions beyond
			// viewing.
			ToolbarHelper::link(
				'index.php?option=com_sameviewcomparisons&view=upload',
				Text::_('COM_SAMEVIEWCOMPARISONS_ADD_COMPARISON'),
				'upload'
			);
			if (!empty($this->items)) {
				ToolbarHelper::deleteList(
					Text::_('COM_SAMEVIEWCOMPARISONS_DELETE_CONFIRM'),
					'comparisons.delete',
					'JTOOLBAR_DELETE'
				);
			}
		}

		parent::display($tpl);
	}

	/**
	 * docs/IMPLEMENTATION_PLAN_V1.md Phase 24 Part A. Each item gains:
	 * `thumbnailUrl` (empty string if the reference asset is missing),
	 * `periodLabel`, `placements` (PlacementLookupHelper::findPlacements()'s
	 * own array, never cached/persisted) and `usageLabel` (already-resolved
	 * display text for the 0/1/many cases, per
	 * docs/EMBED_IN_WEBSITE.md "Comparison Management" "usage count").
	 */
	private function decorateItemsWithLibraryData(): void
	{
		foreach ($this->items as $item) {
			$sessionId = (string) $item->session_id;
			$manifest = json_decode((string) $item->manifest_json, true);

			$item->periodLabel = ComparisonRenderHelper::periodLabelFor(is_array($manifest) ? $manifest : []);

			$referenceImage = ComparisonRenderHelper::assetDirFor($sessionId) . '/reference.jpg';
			$item->thumbnailUrl = is_file($referenceImage)
				? ComparisonRenderHelper::assetsUrlFor($sessionId) . '/reference.jpg'
				: '';

			$item->placements = PlacementLookupHelper::findPlacements($sessionId);

			$count = count($item->placements);
			$item->usageLabel = match (true) {
				$count === 0 => Text::_('COM_SAMEVIEWCOMPARISONS_USAGE_NONE'),
				$count === 1 => Text::_('COM_SAMEVIEWCOMPARISONS_USAGE_ONE'),
				default => Text::sprintf('COM_SAMEVIEWCOMPARISONS_USAGE_MANY', $count),
			};
		}
	}
}
