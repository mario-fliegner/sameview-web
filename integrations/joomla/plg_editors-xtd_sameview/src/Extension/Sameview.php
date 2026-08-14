<?php

namespace Joomla\Plugin\EditorsXtd\Sameview\Extension;

use Joomla\CMS\Editor\Button\Button;
use Joomla\CMS\Event\Editor\EditorButtonsSetupEvent;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Plugin\CMSPlugin;
use Joomla\CMS\Session\Session;
use Joomla\Event\SubscriberInterface;

// phpcs:disable PSR1.Files.SideEffects
\defined('_JEXEC') or die;
// phpcs:enable PSR1.Files.SideEffects

/**
 * The Editors-XTD button for inserting `{sameview session="SESSION_ID"}`
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 22; docs/JOOMLA_INTEGRATION.md
 * "Placement"). Modeled directly on Joomla's own core
 * plg_editors-xtd_module: `onEditorButtonsSetup` registers a `Button` with
 * `action: 'modal'`, whose `link` opens
 * admin/tmpl/comparisons/modal.php — a native Joomla dialog
 * (media/system/js/editors/editors.js `JoomlaEditorButton.registerAction('modal', ...)`).
 * Selecting a Comparison there inserts it via Joomla's own native
 * `[data-content-select]` / `postMessage()` mechanism
 * (media/system/js/modal-content-select.js) — no custom insertion
 * JavaScript is written here or anywhere else in this plugin.
 *
 * Deliberately no permission check (unlike plg_editors-xtd_module's own
 * `core.create`/`core.edit`/`core.edit.own` check on com_modules):
 * docs/EMBED_IN_WEBSITE.md "Permissions": "Users with ordinary
 * content/editor permissions may select and place already available
 * Comparisons without automatically receiving management rights over the
 * Comparison library" — placement uses Joomla's own existing content/editor
 * permissions (already implied by the user having an editor toolbar at
 * all), never a new SameView-specific ACL permission.
 */
final class Sameview extends CMSPlugin implements SubscriberInterface
{
	public static function getSubscribedEvents(): array
	{
		return ['onEditorButtonsSetup' => 'onEditorButtonsSetup'];
	}

	public function onEditorButtonsSetup(EditorButtonsSetupEvent $event): void
	{
		$subject = $event->getButtonsRegistry();
		$disabled = $event->getDisabledButtons();

		if (\in_array($this->_name, $disabled)) {
			return;
		}

		$this->loadLanguage();

		$link = 'index.php?option=com_sameviewcomparisons&view=comparisons&layout=modal&tmpl=component&'
			. Session::getFormToken() . '=1&editor=' . $event->getEditorId();

		$button = new Button(
			$this->_name,
			[
				'action' => 'modal',
				'link' => $link,
				'text' => Text::_('PLG_EDITORS-XTD_SAMEVIEW_BUTTON'),
				'icon' => 'images',
				'name' => $this->_type . '_' . $this->_name,
			]
		);

		$subject->add($button);
	}
}
