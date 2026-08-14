<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\View\Upload;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\MVC\View\HtmlView as BaseHtmlView;
use Joomla\CMS\Toolbar\ToolbarHelper;

/**
 * `Add comparison` upload form (docs/EMBED_IN_WEBSITE.md "Comparison
 * Lifecycle") — a single upload field, no separate Import/Update choice:
 * Controller\ComparisonsController::upload() decides Add vs. Update vs.
 * no-op from the uploaded package's own `session.id`/Outcome Fingerprint.
 */
class HtmlView extends BaseHtmlView
{
	public function display($tpl = null): void
	{
		if (!Factory::getApplication()->getIdentity()->authorise('core.manage', 'com_sameviewcomparisons')) {
			throw new \Exception(Text::_('JERROR_ALERTNOAUTHOR'), 403);
		}

		ToolbarHelper::title(Text::_('COM_SAMEVIEWCOMPARISONS_TITLE_ADD_COMPARISON'), 'upload');
		ToolbarHelper::back('JTOOLBAR_BACK', 'index.php?option=com_sameviewcomparisons&view=comparisons');

		parent::display($tpl);
	}
}
