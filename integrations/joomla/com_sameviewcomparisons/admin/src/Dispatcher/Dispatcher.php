<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\Dispatcher;

defined('_JEXEC') or die;

use Joomla\CMS\Dispatcher\ComponentDispatcher;

/**
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 24 Part B (H fix):
 * docs/EMBED_IN_WEBSITE.md "Permissions" requires the Editors-XTD picker
 * (tmpl/comparisons/modal.php, `layout=modal`) to remain usable by any user
 * who already holds ordinary Joomla content-editing rights, without
 * receiving Comparison-library management rights
 * (docs/JOOMLA_INTEGRATION.md "Permissions and Security").
 *
 * The actual blocking gate is here, not in Controller/DisplayController.php:
 * confirmed empirically against real Joomla 6.1.2 and 5.4.7 instances that
 * `Joomla\CMS\Dispatcher\ComponentDispatcher::checkAccess()` — Joomla's own
 * core dispatcher, used automatically for any component with no dispatcher
 * class of its own (`Joomla\CMS\Dispatcher\ComponentDispatcherFactory`'s
 * own `\<namespace>\Administrator\Dispatcher\Dispatcher` convention,
 * confirmed against that same core source) — enforces `core.manage`
 * unconditionally for every backend request to this component, *before*
 * any controller (including DisplayController's own, matching check) is
 * ever reached. Overriding `checkAccess()` here is the one place that
 * exemption can actually take effect; DisplayController's own identical
 * `layout !== 'modal'` check remains required too, as the second,
 * independent gate a request must still pass once this one lets it
 * through — see that class's own header comment.
 *
 * No new permission is introduced, and every other layout (the full
 * management list, Add, Delete) is unaffected: this override only ever
 * widens access for the one already-read-only, already-Joomla-content-ACL-
 * gated picker context, never narrows or replaces the existing
 * `core.manage` requirement for anything else.
 */
class Dispatcher extends ComponentDispatcher
{
	protected function checkAccess()
	{
		if ($this->input->getCmd('layout', '') === 'modal') {
			return;
		}

		parent::checkAccess();
	}
}
