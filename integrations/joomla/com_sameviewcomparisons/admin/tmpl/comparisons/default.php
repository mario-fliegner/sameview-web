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
						<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_PERIOD'); ?></th>
						<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_SESSION_ID'); ?></th>
						<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_USAGE'); ?></th>
						<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_PLACEMENTS'); ?></th>
						<th><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_COLUMN_MODIFIED'); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ($this->items as $i => $item) : ?>
						<tr data-testid="sameview-comparison-row" data-session-id="<?php echo htmlspecialchars((string) $item->session_id, ENT_QUOTES, 'UTF-8'); ?>">
							<td class="text-center">
								<?php echo HTMLHelper::_('grid.id', $i, $item->id, false, 'cid', 'cb', (string) $item->title); ?>
							</td>
							<td>
								<?php if (!empty($item->thumbnailUrl)) : ?>
									<img
										src="<?php echo htmlspecialchars($item->thumbnailUrl, ENT_QUOTES, 'UTF-8'); ?>"
										alt=""
										data-testid="sameview-comparison-thumbnail"
										style="width:64px;height:64px;object-fit:cover;vertical-align:middle;margin-inline-end:8px;"
									>
								<?php endif; ?>
								<?php echo htmlspecialchars((string) $item->title, ENT_QUOTES, 'UTF-8'); ?>
							</td>
							<td data-testid="sameview-comparison-period"><?php echo htmlspecialchars((string) $item->periodLabel, ENT_QUOTES, 'UTF-8'); ?></td>
							<td><?php echo htmlspecialchars((string) $item->session_id, ENT_QUOTES, 'UTF-8'); ?></td>
							<td data-testid="sameview-comparison-usage"><?php echo htmlspecialchars((string) $item->usageLabel, ENT_QUOTES, 'UTF-8'); ?></td>
							<td data-testid="sameview-comparison-placements">
								<?php if (empty($item->placements)) : ?>
									&#8212;
								<?php else : ?>
									<ul class="list-unstyled mb-0">
										<?php foreach ($item->placements as $placement) : ?>
											<li data-testid="sameview-comparison-placement" data-placement-type="<?php echo htmlspecialchars($placement['type'], ENT_QUOTES, 'UTF-8'); ?>">
												<span class="small text-muted"><?php echo Text::_($placement['type'] === 'module' ? 'COM_SAMEVIEWCOMPARISONS_PLACEMENT_TYPE_MODULE' : 'COM_SAMEVIEWCOMPARISONS_PLACEMENT_TYPE_ARTICLE'); ?>:</span>
												<a href="<?php echo htmlspecialchars($placement['editLink'], ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars($placement['title'], ENT_QUOTES, 'UTF-8'); ?></a>
											</li>
										<?php endforeach; ?>
									</ul>
								<?php endif; ?>
							</td>
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
