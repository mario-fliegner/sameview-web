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
 *
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 24 Part B (H fix): the one
 * deliberate exception is `layout=modal` — the Editors-XTD picker
 * (tmpl/comparisons/modal.php) reuses this same view/controller, but
 * docs/EMBED_IN_WEBSITE.md "Permissions" requires it to remain usable by
 * any user who already holds ordinary Joomla content-editing rights,
 * "without receiving Comparison-library management rights, since placement
 * uses Joomla's own existing content/module permissions, not a
 * SameView-specific one" (docs/JOOMLA_INTEGRATION.md "Permissions and
 * Security"). No new permission is introduced: every other layout (the full
 * management list, `layout=default`) still requires core.manage unchanged,
 * and Add/Delete (ComparisonsController) are untouched.
 *
 * This exemption alone is not sufficient by itself: confirmed empirically
 * against real Joomla 6.1.2 and 5.4.7 instances that
 * `Joomla\CMS\Dispatcher\ComponentDispatcher::checkAccess()` enforces the
 * exact same unconditional `core.manage` check *before* this controller's
 * own `display()` is ever reached, for every backend request to this
 * component. The matching exemption in
 * ../Dispatcher/Dispatcher.php (this component's own dispatcher override)
 * is required first to let a `layout=modal` request reach this class at
 * all; this check here is the second, independent gate a request must also
 * pass once it does.
 */
class DisplayController extends BaseController
{
	protected $default_view = 'comparisons';

	public function display($cachable = false, $urlparams = [])
	{
		$layout = Factory::getApplication()->getInput()->getCmd('layout', '');

		if ($layout !== 'modal' && !Factory::getApplication()->getIdentity()->authorise('core.manage', 'com_sameviewcomparisons')) {
			throw new \Exception(Text::_('JERROR_ALERTNOAUTHOR'), 403);
		}

		return parent::display($cachable, $urlparams);
	}
}
