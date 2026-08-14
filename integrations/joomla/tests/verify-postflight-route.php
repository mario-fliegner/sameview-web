<?php

/**
 * Directly invokes pkg_sameviewcomparisons's own installed postflight()
 * with a given $route, to verify docs/IMPLEMENTATION_PLAN_V1.md Phase 22's
 * placement-plugin auto-enable guard.
 *
 * docs/JOOMLA_INTEGRATION.md "Testing": Docker + Playwright is the primary
 * and default mechanism; a dedicated PHP-level harness is introduced only
 * where a concrete, demonstrated need cannot be met that way.
 *
 * Historical note, since fixed (docs/IMPLEMENTATION_PLAN_V1.md Phase 22
 * update-lifecycle fix): reinstalling the whole already-installed package
 * through Joomla's own native Extensions Manager used to be blocked before
 * `postflight()` was ever reached, because none of com_sameviewcomparisons,
 * pkg_sameviewcomparisons or mod_sameview_comparison carried
 * `method="upgrade"` — `InstallerAdapter::checkExtensionInFilesystem()`
 * (and ComponentAdapter's/PackageAdapter's own overrides) threw an abort
 * for the component the moment the whole package was reinstalled while
 * already registered. All three manifests now carry `method="upgrade"`
 * (confirmed empirically that this does not affect a genuinely fresh
 * install), so a real, native end-to-end path that reaches
 * `$route === 'update'` does exist today — see
 * package-update-lifecycle.test.mjs, which exercises it directly through
 * the Extensions Manager. This harness remains useful as a fast, isolated
 * way to exercise both route branches of `postflight()` in isolation,
 * using Joomla's own real CLI application bootstrap and the real,
 * permanently installed script.php
 * (`administrator/manifests/packages/sameviewcomparisons/script.php`,
 * Joomla's own real, permanent location for a package's own installed
 * script — confirmed empirically), so the exact real code under test still
 * runs unmodified; only the invocation path (direct call vs. the full
 * Installer pipeline) differs.
 *
 * Usage: php verify-postflight-route.php <install|update>
 */

const _JEXEC = 1;
define('JPATH_BASE', '/var/www/html/administrator');
require_once '/var/www/html/administrator/includes/defines.php';
require_once JPATH_BASE . '/includes/framework.php';

$route = $argv[1] ?? null;

if (!in_array($route, ['install', 'update'], true)) {
	fwrite(STDERR, "Usage: php verify-postflight-route.php <install|update>\n");
	exit(1);
}

// Minimal real CLI application bootstrap, mirroring cli/joomla.php's own.
$container = \Joomla\CMS\Factory::getContainer();
$container->alias('session', 'session.cli')
	->alias('JSession', 'session.cli')
	->alias(\Joomla\CMS\Session\Session::class, 'session.cli')
	->alias(\Joomla\Session\Session::class, 'session.cli')
	->alias(\Joomla\Session\SessionInterface::class, 'session.cli');
\Joomla\CMS\Factory::$application = $container->get(\Joomla\Console\Application::class);

require_once '/var/www/html/administrator/manifests/packages/sameviewcomparisons/script.php';

$script = new Pkg_SameviewcomparisonsInstallerScript();
$script->postflight($route, null);

echo "postflight('{$route}') invoked\n";
