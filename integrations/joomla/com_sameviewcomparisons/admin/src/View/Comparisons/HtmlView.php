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

		parent::display($tpl);
	}
}
