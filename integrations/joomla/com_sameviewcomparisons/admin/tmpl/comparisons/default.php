<?php

defined('_JEXEC') or die;

use Joomla\CMS\Language\Text;

/** @var array $this->items */
?>
<div class="sameview-comparisons-list">
	<?php if (empty($this->items)) : ?>
		<p><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_NO_ITEMS'); ?></p>
	<?php else : ?>
		<table class="table" data-testid="sameview-comparisons-list">
			<thead>
				<tr>
					<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_TITLE'); ?></th>
					<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_SESSION_ID'); ?></th>
					<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_MODIFIED'); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ($this->items as $item) : ?>
					<tr>
						<td><?php echo htmlspecialchars((string) $item->title, ENT_QUOTES, 'UTF-8'); ?></td>
						<td><?php echo htmlspecialchars((string) $item->session_id, ENT_QUOTES, 'UTF-8'); ?></td>
						<td><?php echo htmlspecialchars((string) $item->modified, ENT_QUOTES, 'UTF-8'); ?></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
	<?php endif; ?>
</div>
