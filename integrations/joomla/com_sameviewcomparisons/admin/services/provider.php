<?php

defined('_JEXEC') or die;

use Joomla\CMS\Dispatcher\ComponentDispatcherFactoryInterface;
use Joomla\CMS\Extension\ComponentInterface;
use Joomla\CMS\Extension\Service\Provider\ComponentDispatcherFactory;
use Joomla\CMS\Extension\Service\Provider\MVCFactory;
use Joomla\CMS\MVC\Factory\MVCFactoryInterface;
use Joomla\Component\Sameviewcomparisons\Administrator\Extension\SameviewcomparisonsComponent;
use Joomla\DI\Container;
use Joomla\DI\ServiceProviderInterface;

return new class implements ServiceProviderInterface {
	public function register(Container $container): void
	{
		$container->registerServiceProvider(new MVCFactory('\\Joomla\\Component\\Sameviewcomparisons'));
		$container->registerServiceProvider(new ComponentDispatcherFactory('\\Joomla\\Component\\Sameviewcomparisons'));

		$container->set(
			ComponentInterface::class,
			function (Container $container) {
				$component = new SameviewcomparisonsComponent(
					$container->get(ComponentDispatcherFactoryInterface::class)
				);
				// Confirmed against a real Joomla 6.1.2 instance: registering
				// the MVCFactory service provider above is not by itself
				// enough — MVCComponent (via MVCFactoryServiceTrait) throws
				// "MVC factory not set" unless setMVCFactory() is called
				// explicitly here.
				$component->setMVCFactory($container->get(MVCFactoryInterface::class));

				return $component;
			}
		);
	}
};
