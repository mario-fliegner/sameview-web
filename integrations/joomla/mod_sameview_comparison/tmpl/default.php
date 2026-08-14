<?php

defined('_JEXEC') or die;

use Joomla\Component\Sameviewcomparisons\Administrator\Helper\ComparisonRenderHelper;

/** @var string $sessionId */

require_once JPATH_ADMINISTRATOR . '/components/com_sameviewcomparisons/src/Helper/ComparisonRenderHelper.php';

// docs/EMBED_IN_WEBSITE.md "Placement Behavior After Deletion": an
// unconfigured or no-longer-resolvable session_id renders nothing and
// reserves no space — ComparisonRenderHelper::render() already returns ''
// for both cases, so no separate empty-state markup is needed here.
echo ComparisonRenderHelper::render($sessionId);
