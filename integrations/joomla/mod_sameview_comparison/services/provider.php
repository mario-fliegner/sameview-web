<?php

\defined('_JEXEC') or die;

use Joomla\CMS\Extension\Service\Provider\Module;
use Joomla\CMS\Extension\Service\Provider\ModuleDispatcherFactory;
use Joomla\DI\Container;
use Joomla\DI\ServiceProviderInterface;

// Modeled on the core mod_custom's own services/provider.php.
return new class () implements ServiceProviderInterface {
	public function register(Container $container): void
	{
		$container->registerServiceProvider(new ModuleDispatcherFactory('\\Joomla\\Module\\SameviewComparison'));
		$container->registerServiceProvider(new Module());
	}
};
