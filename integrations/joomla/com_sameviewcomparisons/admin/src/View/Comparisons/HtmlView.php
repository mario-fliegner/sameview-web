<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\View\Comparisons;

defined('_JEXEC') or die;

use Joomla\CMS\Language\Text;
use Joomla\CMS\MVC\View\HtmlView as BaseHtmlView;
use Joomla\CMS\Toolbar\ToolbarHelper;

class HtmlView extends BaseHtmlView
{
	/** @var array */
	protected $items = [];

	public function display($tpl = null): void
	{
		$this->items = $this->get('Items');

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
}
