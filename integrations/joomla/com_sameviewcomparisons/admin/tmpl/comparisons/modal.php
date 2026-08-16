<?php

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\Component\Sameviewcomparisons\Administrator\Helper\ComparisonRenderHelper;

/** @var array $this->items */

// docs/JOOMLA_INTEGRATION.md "No Editor Preview": the Editors-XTD button's
// own picker dialog (plg_editors-xtd_sameview), opened as a native Joomla
// modal (`layout=modal&tmpl=component`) exactly like
// administrator/components/com_modules/tmpl/modules/modal.php. Selecting a
// Comparison is by title and reference-to-capture period label only — no
// preview of any kind is rendered here.
//
// Insertion into the editor uses Joomla's own native mechanism, not custom
// JavaScript (confirmed against real Joomla 6.1.2 core source,
// media/system/js/editors/editors.js `JoomlaEditorButton.registerAction('modal', ...)`
// and media/system/js/modal-content-select.js): a `[data-content-select]`
// button's own `data-html` attribute is `postMessage()`d to the parent
// window, which inserts it via `editor.replaceSelection(...)` — the exact
// same mechanism com_modules's own `{loadmoduleid ...}`/`{loadposition ...}`
// insertion buttons use.
$wa = $this->getDocument()->getWebAssetManager();
$wa->useScript('modal-content-select');

$comparisons = ComparisonRenderHelper::findActiveComparisons();
$editor = Factory::getApplication()->getInput()->getCmd('editor', '');
?>
<div class="container-popup">
	<?php if (empty($comparisons)) : ?>
		<p><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_PICKER_NO_COMPARISONS'); ?></p>
	<?php else : ?>
		<table class="table" data-testid="sameview-picker-list">
			<caption class="visually-hidden"><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_PICKER_TITLE'); ?></caption>
			<thead>
				<tr>
					<th scope="col"><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_TITLE'); ?></th>
					<th scope="col"><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_PERIOD'); ?></th>
					<th scope="col"></th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ($comparisons as $comparison) : ?>
					<?php
					$reference = '{sameview session="' . $comparison['sessionId'] . '"}';
					?>
					<tr data-testid="sameview-picker-row" data-session-id="<?php echo htmlspecialchars($comparison['sessionId'], ENT_QUOTES, 'UTF-8'); ?>">
						<td><?php echo htmlspecialchars($comparison['title'], ENT_QUOTES, 'UTF-8'); ?></td>
						<td><?php echo htmlspecialchars($comparison['periodLabel'], ENT_QUOTES, 'UTF-8'); ?></td>
						<td class="text-end">
							<button
								type="button"
								class="btn btn-sm btn-success"
								data-testid="sameview-picker-insert"
								data-content-select
								data-content-type="com_sameviewcomparisons.comparison"
								data-editor="<?php echo htmlspecialchars($editor, ENT_QUOTES, 'UTF-8'); ?>"
								data-html="<?php echo htmlspecialchars($reference, ENT_QUOTES, 'UTF-8'); ?>"
							>
								<?php echo Text::_('COM_SAMEVIEWCOMPARISONS_PICKER_INSERT'); ?>
							</button>
						</td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
	<?php endif; ?>
</div>
