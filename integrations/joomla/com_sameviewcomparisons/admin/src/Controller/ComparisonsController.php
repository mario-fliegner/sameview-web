<?php

namespace Joomla\Component\Sameviewcomparisons\Administrator\Controller;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Installer\InstallerHelper;
use Joomla\CMS\Language\Text;
use Joomla\CMS\MVC\Controller\BaseController;
use Joomla\CMS\Router\Route;
use Joomla\CMS\Session\Session;
use Joomla\Component\Sameviewcomparisons\Administrator\Helper\ComparisonImportHelper;
use Joomla\Filesystem\File;
use Joomla\Filesystem\Folder;

/**
 * `Add comparison` upload and `Delete` — the two administrative
 * Comparison-library actions beyond viewing the list
 * (docs/EMBED_IN_WEBSITE.md "Comparison Management"), both gated by the
 * same single `core.manage` permission as the list view itself
 * (docs/JOOMLA_INTEGRATION.md "Permissions and Security").
 *
 * `upload()` accepts the same unified package artifact
 * (`sameview-comparisons-joomla.zip`) used for first installation
 * (src/lib/generate-joomla-package.ts) and imports only its `seed/`
 * subdirectory — never touching the installed extension's own PHP files
 * (docs/JOOMLA_INTEGRATION.md "First Installation": "never by reinstalling
 * or replacing the integration through the Extensions Manager"). Uses
 * `InstallerHelper::unpack()`, the same native extraction utility Joomla's
 * own Extensions Manager install path already uses
 * (confirmed against real Joomla 6.1.2/5.4.7 instances,
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 19/21) — not a custom archive
 * parser.
 */
class ComparisonsController extends BaseController
{
	// Mirrors the WordPress integration's own upload limit
	// (includes/admin-add-comparison.php SAMEVIEW_MAX_PACKAGE_BYTES).
	private const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

	public function upload()
	{
		Session::checkToken() or jexit(Text::_('JINVALID_TOKEN'));
		$this->assertManageAllowed();

		$app = Factory::getApplication();
		// Confirmed against a real Joomla 5.4.7 instance: the default filter
		// ('cmd') runs InputFilter::isSafeFile(), which rejects a .zip
		// upload outright — 'raw' is required here since this controller
		// does its own complete validation afterward
		// (ComparisonImportHelper::importSeed()) anyway.
		$file = $app->getInput()->files->get('sameview_package', null, 'raw');

		if (
			!is_array($file)
			|| ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
			|| empty($file['tmp_name'])
			|| !is_uploaded_file($file['tmp_name'])
		) {
			$this->redirectToUpload(Text::_('COM_SAMEVIEWCOMPARISONS_ADD_ERROR_NO_FILE'), 'error');

			return;
		}

		if ((int) $file['size'] > self::MAX_UPLOAD_BYTES || (int) $file['size'] <= 0) {
			$this->redirectToUpload(Text::_('COM_SAMEVIEWCOMPARISONS_ADD_ERROR_TOO_LARGE'), 'error');

			return;
		}

		if (strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION)) !== 'zip') {
			$this->redirectToUpload(Text::_('COM_SAMEVIEWCOMPARISONS_ADD_ERROR_INVALID_FILE'), 'error');

			return;
		}

		$tmpPath = Factory::getApplication()->get('tmp_path') . '/sameview_upload_' . uniqid('', true) . '.zip';

		if (!move_uploaded_file($file['tmp_name'], $tmpPath)) {
			$this->redirectToUpload(Text::_('COM_SAMEVIEWCOMPARISONS_ADD_ERROR_INVALID_FILE'), 'error');

			return;
		}

		$package = InstallerHelper::unpack($tmpPath, true);
		File::delete($tmpPath);

		if (empty($package['extractdir']) || !is_dir($package['extractdir'])) {
			$this->redirectToUpload(Text::_('COM_SAMEVIEWCOMPARISONS_ADD_ERROR_INVALID_FILE'), 'error');

			return;
		}

		$seedDir = $package['extractdir'] . '/seed';
		$result = is_dir($seedDir)
			? ComparisonImportHelper::importSeed($seedDir)
			: ['status' => 'rejected', 'message' => Text::_('COM_SAMEVIEWCOMPARISONS_ADD_ERROR_INVALID_FILE')];

		Folder::delete($package['extractdir']);

		$messageType = $result['status'] === 'rejected' ? 'error' : 'message';
		$message = match ($result['status']) {
			'added' => Text::_('COM_SAMEVIEWCOMPARISONS_ADD_SUCCESS_ADDED'),
			'updated' => Text::_('COM_SAMEVIEWCOMPARISONS_ADD_SUCCESS_UPDATED'),
			'no-op' => Text::_('COM_SAMEVIEWCOMPARISONS_ADD_SUCCESS_NOOP'),
			default => Text::_('COM_SAMEVIEWCOMPARISONS_ADD_ERROR_INVALID_FILE'),
		};

		if ($result['status'] === 'rejected') {
			$this->redirectToUpload($message, $messageType);

			return;
		}

		$this->setRedirect(
			Route::_('index.php?option=com_sameviewcomparisons&view=comparisons', false),
			$message,
			$messageType
		);
	}

	public function delete()
	{
		Session::checkToken() or jexit(Text::_('JINVALID_TOKEN'));
		$this->assertManageAllowed();

		$app = Factory::getApplication();
		$ids = $app->getInput()->get('cid', [], 'array');
		$ids = array_filter(array_map('intval', $ids));

		foreach ($ids as $id) {
			ComparisonImportHelper::deleteComparison($id);
		}

		$message = count($ids) === 1
			? Text::_('COM_SAMEVIEWCOMPARISONS_DELETE_SUCCESS_ONE')
			: Text::sprintf('COM_SAMEVIEWCOMPARISONS_DELETE_SUCCESS_MANY', count($ids));

		$this->setRedirect(
			Route::_('index.php?option=com_sameviewcomparisons&view=comparisons', false),
			$message
		);
	}

	private function redirectToUpload(string $message, string $messageType): void
	{
		$this->setRedirect(
			Route::_('index.php?option=com_sameviewcomparisons&view=upload', false),
			$message,
			$messageType
		);
	}

	private function assertManageAllowed(): void
	{
		if (!Factory::getApplication()->getIdentity()->authorise('core.manage', 'com_sameviewcomparisons')) {
			throw new \Exception(Text::_('JERROR_ALERTNOAUTHOR'), 403);
		}
	}
}
