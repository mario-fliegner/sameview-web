<?php

/**
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 24 Part B (I fix):
 * docs/EMBED_IN_WEBSITE.md "Placement Behavior After Deletion": "a
 * placement retains its referenced session.id ... If a Comparison with the
 * same session.id is later imported again, existing placements referencing
 * it automatically become functional again." Joomla's own native
 * `Joomla\CMS\Form\Field\SqlField` (previously used directly via
 * `type="sql"` in mod_sameview_comparison.xml) populates its `<option>`
 * list purely from the live query result — when the module's own stored
 * `session_id` no longer matches any row (the referenced Comparison was
 * deleted), the rendered `<select>` silently falls back to its first
 * option, and — confirmed empirically against real Joomla 6.1.2 and 5.4.7
 * instances — submitting the form again (even only changing an unrelated
 * field, e.g. the module title) then overwrites the stored `session_id`
 * with that fallback's own empty value, permanently losing the placement's
 * reference well before any re-import could restore it.
 *
 * This subclass fixes that by overriding `getOptions()`: if the field's own
 * current value is not among the live query results, it is added back as
 * one additional, genuinely selectable option — clearly labelled as
 * missing, still carrying the real session_id — so the browser keeps it
 * selected, a plain re-save round-trips the exact same value unchanged, and
 * once a Comparison with that session_id exists again (a real row is back
 * in the live query), this override no longer adds anything and the normal
 * Comparison title reappears automatically. No new persistence, no new
 * table, no change to the placement contract — purely a presentation-layer
 * fix using Joomla's own established `SqlField` extension point.
 *
 * Deliberately a plain global class registered via the classic
 * `addfieldpath` manifest attribute (mod_sameview_comparison.xml's own
 * `<fields addfieldpath="...">`), not a namespaced PSR-4 class: confirmed
 * against real Joomla 6.1.2 core source
 * (`Joomla\CMS\Form\FormHelper::loadClass()`) that a module's own params
 * form (edited from inside com_modules, not this module's own namespace
 * context) resolves an unrecognised `type="..."` first through registered
 * PSR-4 field-namespace prefixes — none of which apply here — and only
 * then falls back to the legacy `JFormField<Type>` global-class-plus-
 * `addfieldpath` convention, which is therefore the one reliable way to
 * register a custom field type for a module's own configuration form.
 *
 * Phase 24 Part B follow-up (real manual-sandbox finding, not caught by the
 * automated suite): the getOptions() override above renders the missing
 * option correctly, but re-saving an already-missing module through
 * Joomla's own real `module.save` admin path failed with "Invalid field:
 * Comparison". Root cause, confirmed against real Joomla 6.1.2 and 5.4.7
 * core source: `Joomla\CMS\MVC\Controller\FormController::save()` loads the
 * validation-time Form via `$model->getForm($data, false)` —
 * `load_data=false` — and `Joomla\CMS\MVC\Model\FormBehaviorTrait::
 * loadForm()` then binds that Form to an empty array, never the submitted
 * or stored data ("Sometimes the form needs some posted data, such as for
 * plugins and modules" — Joomla core's own comment). Both
 * `Form::loadField()` (used internally by `Form::validate()`) and
 * `Joomla\CMS\Form\Rule\OptionsRule::test()` (via
 * `$form->getField($name, $group)`) each derive a *fresh* field instance
 * from that same empty-bound Form, so `$this->value` is always '' at save
 * time — regardless of what was actually stored or submitted. The original
 * getOptions() only added the missing option when `$this->value` was
 * non-empty, so it never fired during save, and OptionsRule then rejected
 * the correctly-resubmitted, unchanged missing session_id as not among the
 * live options. currentSessionId() below fixes this by falling back, only
 * when `$this->value` is empty, to the value already persisted in
 * `#__modules.params` for the module currently being edited/saved — its
 * `id` arrives as a plain top-level request parameter (not nested under
 * `jform`), so it survives the empty Form binding above and is present on
 * both the GET edit request and the POST save request. This re-admits only
 * a value the site itself already stored, never an arbitrary client-
 * supplied string, so `validate="options"` keeps rejecting every other
 * unknown value exactly as before.
 *
 * Phase 24 audit follow-up: docs/JOOMLA_INTEGRATION.md "No Editor Preview"
 * requires every regular (non-missing) option here to identify its
 * Comparison "by title and reference-to-capture period label" — the same
 * bar the Editors-XTD picker (tmpl/comparisons/modal.php) already meets via
 * its own separate table column. Joomla's native SqlField only supports one
 * `text` value per `<option>`, so appendPeriodLabels() below enriches each
 * regular option's already-resolved title with the same period label
 * ComparisonRenderHelper::periodLabelFor() already computes for the Library
 * list and the Editors-XTD picker — never a second, independently
 * maintained period computation. The missing option built further down is
 * deliberately excluded: docs/JOOMLA_INTEGRATION.md's own carve-out for the
 * missing state ("identified by title only") stays title/session_id-only,
 * unchanged.
 */

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Form\Field\SqlField;
use Joomla\CMS\Language\Text;
use Joomla\Component\Sameviewcomparisons\Administrator\Helper\ComparisonRenderHelper;
use Joomla\Database\ParameterType;
use Joomla\Registry\Registry;

require_once JPATH_ADMINISTRATOR . '/components/com_sameviewcomparisons/src/Helper/ComparisonRenderHelper.php';

class JFormFieldSameviewcomparison extends SqlField
{
	protected function getOptions()
	{
		$options = parent::getOptions();
		$this->appendPeriodLabels($options);
		$currentValue = $this->currentSessionId();

		if ($currentValue === '') {
			return $options;
		}

		foreach ($options as $option) {
			if ((string) $option->value === $currentValue) {
				return $options;
			}
		}

		$missingOption = (object) [
			'value' => $currentValue,
			'text' => Text::sprintf('MOD_SAMEVIEW_COMPARISON_FIELD_SESSION_MISSING', $currentValue),
			'disable' => false,
		];

		array_unshift($options, $missingOption);

		return $options;
	}

	/**
	 * Enriches every regular (non-empty-value) option's already-resolved
	 * title with its reference-to-capture period label, in place — the
	 * `<option>` objects parent::getOptions() returns are mutated directly,
	 * never replaced, so the header option (empty value, no Comparison to
	 * describe) and any later-added missing option are both left untouched.
	 */
	private function appendPeriodLabels(array $options): void
	{
		$sessionIds = [];
		foreach ($options as $option) {
			if ((string) $option->value !== '') {
				$sessionIds[] = (string) $option->value;
			}
		}

		if (!$sessionIds) {
			return;
		}

		$db = $this->getDatabase();
		$query = $db->getQuery(true)
			->select($db->quoteName(['session_id', 'manifest_json']))
			->from($db->quoteName('#__sameview_comparisons'))
			->whereIn($db->quoteName('session_id'), $sessionIds, ParameterType::STRING);
		$db->setQuery($query);
		$rows = $db->loadObjectList('session_id');

		foreach ($options as $option) {
			$sessionId = (string) $option->value;
			if ($sessionId === '' || !isset($rows[$sessionId])) {
				continue;
			}

			$manifest = json_decode((string) $rows[$sessionId]->manifest_json, true);
			$periodLabel = ComparisonRenderHelper::periodLabelFor(is_array($manifest) ? $manifest : []);

			if ($periodLabel !== '') {
				$option->text = $option->text . ' (' . $periodLabel . ')';
			}
		}
	}

	/**
	 * The value to treat as "currently selected" for missing-option
	 * purposes. Prefers $this->value (reliable when the field was set up
	 * from real bound data, e.g. rendering the edit form). Falls back to
	 * the module's own already-persisted params.session_id, read directly
	 * from #__modules, only when $this->value is empty — the save-time gap
	 * documented in this file's own header comment. A brand-new, not-yet-
	 * saved module (id=0) has no persisted row to fall back to and
	 * correctly resolves to '', unchanged from before this fix.
	 */
	private function currentSessionId(): string
	{
		if ((string) $this->value !== '') {
			return (string) $this->value;
		}

		$id = (int) Factory::getApplication()->getInput()->getInt('id');

		if ($id <= 0) {
			return '';
		}

		$db = $this->getDatabase();
		$query = $db->getQuery(true)
			->select($db->quoteName('params'))
			->from($db->quoteName('#__modules'))
			->where($db->quoteName('id') . ' = :id')
			->bind(':id', $id, ParameterType::INTEGER);
		$db->setQuery($query);
		$params = $db->loadResult();

		if (!$params) {
			return '';
		}

		return (string) (new Registry($params))->get('session_id', '');
	}
}
