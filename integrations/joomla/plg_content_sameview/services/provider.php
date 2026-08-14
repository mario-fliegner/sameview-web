<?php

\defined('_JEXEC') or die;

use Joomla\CMS\Extension\PluginInterface;
use Joomla\CMS\Factory;
use Joomla\CMS\Plugin\PluginHelper;
use Joomla\DI\Container;
use Joomla\DI\ServiceProviderInterface;
use Joomla\Plugin\Content\Sameview\Extension\Sameview;

// Modeled on the core plg_content_loadmodule's own services/provider.php.
return new class () implements ServiceProviderInterface {
	public function register(Container $container): void
	{
		$container->set(
			PluginInterface::class,
			$container->lazy(Sameview::class, function (Container $container) {
				$plugin = new Sameview((array) PluginHelper::getPlugin('content', 'sameview'));
				$plugin->setApplication(Factory::getApplication());

				return $plugin;
			})
		);
	}
};
