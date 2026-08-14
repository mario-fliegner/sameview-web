<?php

namespace Joomla\Module\SameviewComparison\Site\Dispatcher;

use Joomla\CMS\Dispatcher\AbstractModuleDispatcher;

// phpcs:disable PSR1.Files.SideEffects
\defined('_JEXEC') or die;
// phpcs:enable PSR1.Files.SideEffects

/**
 * Dispatcher for mod_sameview_comparison (docs/IMPLEMENTATION_PLAN_V1.md
 * Phase 22). Passes the module's own stored `session_id` parameter through
 * unchanged to tmpl/default.php, which resolves it via the one shared
 * ComparisonRenderHelper::render() also used by plg_content_sameview — never
 * a second, independently maintained rendering implementation.
 */
class Dispatcher extends AbstractModuleDispatcher
{
	protected function getLayoutData()
	{
		$data = parent::getLayoutData();
		$data['sessionId'] = (string) $data['params']->get('session_id', '');

		return $data;
	}
}
