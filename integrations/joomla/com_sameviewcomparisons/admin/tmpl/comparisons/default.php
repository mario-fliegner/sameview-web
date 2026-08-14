<?php

defined('_JEXEC') or die;

use Joomla\CMS\HTML\HTMLHelper;
use Joomla\CMS\Language\Text;

/** @var array $this->items */
?>
<form action="index.php?option=com_sameviewcomparisons&view=comparisons" method="post" name="adminForm" id="adminForm">
	<div class="sameview-comparisons-list">
		<?php if (empty($this->items)) : ?>
			<p><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_NO_ITEMS'); ?></p>
		<?php else : ?>
			<table class="table" data-testid="sameview-comparisons-list">
				<thead>
					<tr>
						<th class="w-1 text-center">
							<?php echo HTMLHelper::_('grid.checkall'); ?>
						</th>
						<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_TITLE'); ?></th>
						<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_SESSION_ID'); ?></th>
						<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_MODIFIED'); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ($this->items as $i => $item) : ?>
						<tr data-testid="sameview-comparison-row" data-session-id="<?php echo htmlspecialchars((string) $item->session_id, ENT_QUOTES, 'UTF-8'); ?>">
							<td class="text-center">
								<?php echo HTMLHelper::_('grid.id', $i, $item->id, false, 'cid', 'cb', (string) $item->title); ?>
							</td>
							<td><?php echo htmlspecialchars((string) $item->title, ENT_QUOTES, 'UTF-8'); ?></td>
							<td><?php echo htmlspecialchars((string) $item->session_id, ENT_QUOTES, 'UTF-8'); ?></td>
							<td><?php echo htmlspecialchars((string) $item->modified, ENT_QUOTES, 'UTF-8'); ?></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
	<input type="hidden" name="task" value="">
	<input type="hidden" name="boxchecked" value="0">
	<input type="hidden" name="option" value="com_sameviewcomparisons">
	<?php echo HTMLHelper::_('form.token'); ?>
</form>
