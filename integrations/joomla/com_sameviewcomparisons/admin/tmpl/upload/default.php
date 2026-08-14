<?php

defined('_JEXEC') or die;

use Joomla\CMS\HTML\HTMLHelper;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Uri\Uri;
?>
<div class="sameview-comparisons-upload">
	<form
		action="<?php echo htmlspecialchars(Uri::base() . 'index.php', ENT_QUOTES, 'UTF-8'); ?>"
		method="post"
		enctype="multipart/form-data"
		data-testid="sameview-upload-form"
	>
		<p><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_ADD_HELP'); ?></p>
		<div class="control-group">
			<label for="sameview_package"><?php echo Text::_('COM_SAMEVIEWCOMPARISONS_ADD_FILE_LABEL'); ?></label>
			<input
				type="file"
				name="sameview_package"
				id="sameview_package"
				accept=".zip"
				required
				data-testid="sameview-upload-file-input"
			>
		</div>
		<div class="form-actions">
			<button type="submit" class="btn btn-primary" data-testid="sameview-upload-submit">
				<?php echo Text::_('COM_SAMEVIEWCOMPARISONS_ADD_SUBMIT'); ?>
			</button>
		</div>
		<input type="hidden" name="option" value="com_sameviewcomparisons">
		<input type="hidden" name="task" value="comparisons.upload">
		<?php echo HTMLHelper::_('form.token'); ?>
	</form>
</div>
