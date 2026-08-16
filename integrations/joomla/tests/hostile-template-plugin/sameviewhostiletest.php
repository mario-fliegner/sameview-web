<?php

/**
 * Test-only host-isolation stress fixture (docs/IMPLEMENTATION_PLAN_V1.md
 * Phase 23) — see sameviewhostiletest.xml's own header comment for full
 * context. Never shipped as part of pkg_sameviewcomparisons.
 *
 * The injected rule set deliberately mirrors
 * integrations/wordpress/tests/fresh-install/mu-plugins/hostile-theme-simulation.php's
 * own "realistic hostile theme" block verbatim (font-family, color,
 * text-transform, box-sizing, a `button { all: unset; ... }` reset) so both
 * platforms are stress-tested against the same comparison baseline.
 *
 * Site-only (`isClient('site')`): the admin app never renders a SameView
 * placement, so there is nothing to isolate there, and polluting the admin
 * UI's own styling would only make the rest of a test run harder to debug.
 */

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Plugin\CMSPlugin;

class PlgSystemSameviewhostiletest extends CMSPlugin
{
	public function onBeforeCompileHead(): void
	{
		$app = Factory::getApplication();

		if (!$app->isClient('site')) {
			return;
		}

		$doc = $app->getDocument();

		if (!method_exists($doc, 'addStyleDeclaration')) {
			return;
		}

		$doc->addStyleDeclaration(
			'* { box-sizing: content-box; margin: 4px; padding: 4px; }' .
			'html { font-size: 20px; line-height: 2.4; }' .
			'body { font-family: Georgia, serif; color: #c026d3; background: #fef08a; }' .
			'img { max-width: 50%; height: auto; display: inline; border: 5px solid blue; filter: grayscale(1); }' .
			'button { all: unset; cursor: pointer; background: #16a34a; color: #ffffff; padding: 12px; border-radius: 999px; font-weight: 900; }' .
			'h1, h2, h3, p, span, div { font-family: "Comic Sans MS", cursive; color: #7e22ce; text-transform: uppercase; line-height: 3; }'
		);
	}
}
