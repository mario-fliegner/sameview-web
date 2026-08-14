<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\Controller;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\MVC\Controller\BaseController;

/**
 * docs/JOOMLA_INTEGRATION.md "Permissions and Security": the single native
 * Joomla access-control permission (core.manage) gates access to the
 * Comparison library itself, not only Add/Update/Delete.
 */
class DisplayController extends BaseController
{
	protected $default_view = 'comparisons';

	public function display($cachable = false, $urlparams = [])
	{
		if (!Factory::getApplication()->getIdentity()->authorise('core.manage', 'com_sameviewcomparisons')) {
			throw new \Exception(Text::_('JERROR_ALERTNOAUTHOR'), 403);
		}

		return parent::display($cachable, $urlparams);
	}
}
