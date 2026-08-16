<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\Model;

defined('_JEXEC') or die;

use Joomla\CMS\MVC\Model\ListModel;
use Joomla\Database\ParameterType;

/**
 * Read-only listing of the com_sameviewcomparisons storage table.
 *
 * Phase 19 scope: no create/update/delete here — docs/IMPLEMENTATION_PLAN_V1.md
 * Phase 19 "Not included" excludes the Add comparison workflow (Phase 21)
 * and placement (Phase 22). This model exists so the storage model set up
 * by this phase (docs/JOOMLA_INTEGRATION.md "Storage Model") is visibly
 * exercised by a manually inserted row, per Phase 19's Definition of Done.
 */
class ComparisonsModel extends ListModel
{
	public function __construct($config = [])
	{
		if (empty($config['filter_fields'])) {
			$config['filter_fields'] = ['id', 'session_id', 'title', 'modified'];
		}

		parent::__construct($config);
	}

	protected function getListQuery()
	{
		$db = $this->getDatabase();
		$query = $db->getQuery(true)
			->select(
				$db->quoteName(
					// docs/IMPLEMENTATION_PLAN_V1.md Phase 24 Part A: `manifest_json`
					// added so the list view can derive the reference-to-capture
					// period label (ComparisonRenderHelper::periodLabelFor()) —
					// the same already-stored value the picker already uses,
					// never recomputed from raw dates.
					['id', 'session_id', 'outcome_fingerprint', 'title', 'manifest_json', 'created', 'modified']
				)
			)
			->from($db->quoteName('#__sameview_comparisons'))
			->order($db->quoteName('modified') . ' DESC');

		return $query;
	}
}
