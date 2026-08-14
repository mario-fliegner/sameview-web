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

		ToolbarHelper::title(Text::_('COM_SAMEVIEWCOMPARISONS_TITLE_COMPARISONS'), 'list');
		// docs/EMBED_IN_WEBSITE.md "Comparison Management": Add comparison and
		// Delete are the two administrative library actions beyond viewing.
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

		parent::display($tpl);
	}
}
