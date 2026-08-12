<?php
/**
 * Shared, validated Comparison seed import — the one place Add/Update/
 * no-op detection and atomic asset replacement happen
 * (docs/EMBED_IN_WEBSITE.md "Comparison Lifecycle", "Atomic Updates",
 * "Asset Replacement"; docs/WORDPRESS_INTEGRATION.md "Storage Model").
 *
 * Called identically from two entry points — never duplicated between them
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 15):
 * - activation-time bootstrap (includes/lifecycle.php), for a bundled seed
 *   found inside this plugin's own directory (First Installation);
 * - the `SameView → Add comparison` admin upload handler
 *   (includes/admin-add-comparison.php), for a later upload.
 *
 * Both hand this file a plain, already-extracted, filesystem directory
 * (`$seed_dir`) containing `comparison.json` plus `reference.jpg`/
 * `capture.jpg`/optional `branding.png` — this file never touches a ZIP or
 * an HTTP upload itself; that is entirely the caller's own responsibility
 * (docs/WORDPRESS_INTEGRATION.md "Permissions and Security": upload
 * handling is validated independently of this shared import logic).
 *
 * This file only defines constants/functions; it never calls them at load
 * time, matching every other includes/*.php file in this plugin.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

// docs/WORDPRESS_INTEGRATION.md "Persistent Integration Versioning": "If a
// newer Comparison format is imported into an older integration that cannot
// fully understand it, the import is rejected completely." Mirrors
// src/lib/generate-wordpress-package.ts `COMPARISON_MANIFEST_FORMAT_VERSION`
// on the SameView Web side — the two are genuinely separate deliverables
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 15) and are kept in sync manually,
// bumped only when the manifest shape itself changes incompatibly.
define( 'SAMEVIEW_MANIFEST_FORMAT_VERSION', 1 );

/**
 * Recursively copies every file from `$from` into `$to`, creating
 * directories as needed. Plain PHP (`scandir`/`copy`/`mkdir`), matching
 * includes/uploads.php's own existing style — no `WP_Filesystem`
 * abstraction: every path here is already a local, already-extracted
 * filesystem path, never a remote one.
 */
function sameview_copy_directory_contents( $from, $to ) {
	if ( ! is_dir( $to ) ) {
		wp_mkdir_p( $to );
	}
	foreach ( scandir( $from ) as $item ) {
		if ( '.' === $item || '..' === $item ) {
			continue;
		}
		$source_path = trailingslashit( $from ) . $item;
		$dest_path   = trailingslashit( $to ) . $item;
		if ( is_dir( $source_path ) ) {
			sameview_copy_directory_contents( $source_path, $dest_path );
		} else {
			copy( $source_path, $dest_path );
		}
	}
}

// `sameview_delete_directory_recursive()` (used below for the temp/old
// directories this file's own atomic update logic creates) is defined in
// includes/uploads.php, already required before this file — see that
// file's own header comment for why it lives there.

// The per-Comparison asset directory is named from a hash of its own
// `session.id` rather than the raw value: `session.id` is an imported
// Android export's directory name (docs/IMPORTED_COMPARISON_V1.md "Session
// Identity") and is not guaranteed to already be a safe filesystem
// component. Deterministic and re-derivable from the stored meta value
// alone — no separate "asset path" meta field is needed.
function sameview_comparison_assets_dir( $session_id ) {
	return trailingslashit( sameview_uploads_dir() ) . md5( $session_id );
}

/**
 * Validates a seed directory's `comparison.json` and asset files. Returns
 * either the decoded manifest (on success) or a WP_Error (on any failure)
 * — never a partial/best-effort result. Every check here runs before
 * `sameview_import_seed()` below ever touches stored state
 * (docs/EMBED_IN_WEBSITE.md "Import Validation": "Invalid, corrupted,
 * manipulated, wrong-platform or unsupported artifacts are rejected before
 * any stored state changes").
 */
function sameview_validate_seed( $seed_dir ) {
	$manifest_path = trailingslashit( $seed_dir ) . 'comparison.json';
	if ( ! is_file( $manifest_path ) ) {
		return new WP_Error( 'sameview_missing_manifest', 'This is not a valid SameView Comparison package.' );
	}

	$raw = file_get_contents( $manifest_path );
	if ( false === $raw ) {
		return new WP_Error( 'sameview_unreadable_manifest', 'This is not a valid SameView Comparison package.' );
	}

	$manifest = json_decode( $raw, true );
	if ( ! is_array( $manifest ) || JSON_ERROR_NONE !== json_last_error() ) {
		return new WP_Error( 'sameview_invalid_manifest', 'This is not a valid SameView Comparison package.' );
	}

	if ( ! isset( $manifest['formatVersion'] ) || ! is_int( $manifest['formatVersion'] ) ) {
		return new WP_Error( 'sameview_invalid_manifest', 'This is not a valid SameView Comparison package.' );
	}
	if ( $manifest['formatVersion'] > SAMEVIEW_MANIFEST_FORMAT_VERSION ) {
		return new WP_Error(
			'sameview_unsupported_format_version',
			'This Comparison was created with a newer version of SameView. Please update the SameView Comparisons plugin first.'
		);
	}

	if ( empty( $manifest['sessionId'] ) || ! is_string( $manifest['sessionId'] ) ) {
		return new WP_Error( 'sameview_invalid_manifest', 'This is not a valid SameView Comparison package.' );
	}
	if ( empty( $manifest['outcomeFingerprint'] ) || ! is_string( $manifest['outcomeFingerprint'] ) ) {
		return new WP_Error( 'sameview_invalid_manifest', 'This is not a valid SameView Comparison package.' );
	}

	foreach ( array( 'reference.jpg', 'capture.jpg' ) as $required_asset ) {
		$asset_path = trailingslashit( $seed_dir ) . $required_asset;
		if ( ! is_file( $asset_path ) || filesize( $asset_path ) <= 0 ) {
			return new WP_Error( 'sameview_missing_asset', 'This is not a valid SameView Comparison package.' );
		}
		// A light sanity check that this is genuinely a decodable image —
		// SameView Web already performs the real privacy processing
		// (docs/DATA_AND_PRIVACY.md); this only guards against a corrupt or
		// non-image file reaching stored state, never re-encodes or otherwise
		// modifies the bytes themselves.
		if ( false === @getimagesize( $asset_path ) ) {
			return new WP_Error( 'sameview_invalid_asset', 'This is not a valid SameView Comparison package.' );
		}
	}

	$branding_path = trailingslashit( $seed_dir ) . 'branding.png';
	if ( is_file( $branding_path ) && false === @getimagesize( $branding_path ) ) {
		return new WP_Error( 'sameview_invalid_asset', 'This is not a valid SameView Comparison package.' );
	}

	return $manifest;
}

/**
 * The one shared Add/Update/no-op entry point
 * (docs/EMBED_IN_WEBSITE.md "Comparison Lifecycle"). `$seed_dir` must
 * already be a plain, extracted, trusted-enough-to-read filesystem
 * directory — validation of its own content still happens here
 * unconditionally, regardless of caller.
 *
 * Returns an associative array: `status` is one of `added`, `updated`,
 * `no-op` or `rejected`; `message` is a short, understandable-language
 * result suitable for display; `post_id` is set for `added`/`updated`.
 */
function sameview_import_seed( $seed_dir ) {
	$manifest = sameview_validate_seed( $seed_dir );
	if ( is_wp_error( $manifest ) ) {
		return array(
			'status'  => 'rejected',
			'message' => $manifest->get_error_message(),
		);
	}

	$session_id = $manifest['sessionId'];
	$existing   = get_posts(
		array(
			'post_type'      => SAMEVIEW_POST_TYPE,
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'meta_key'       => SAMEVIEW_META_SESSION_ID,
			'meta_value'     => $session_id,
			'fields'         => 'ids',
		)
	);
	$existing_post_id = $existing ? $existing[0] : null;

	// docs/EMBED_IN_WEBSITE.md "Comparison Lifecycle": "an existing
	// `session.id` with an unchanged Outcome Fingerprint is a no-op ... no
	// copy is created, assets are not unnecessarily rewritten." Checked
	// before any file/meta write below.
	if ( $existing_post_id ) {
		$existing_fingerprint = get_post_meta( $existing_post_id, SAMEVIEW_META_OUTCOME_FINGERPRINT, true );
		if ( $existing_fingerprint === $manifest['outcomeFingerprint'] ) {
			return array(
				'status'  => 'no-op',
				'message' => 'Comparison already up to date.',
				'post_id' => $existing_post_id,
			);
		}
	}

	// --- Atomic asset replacement (docs/EMBED_IN_WEBSITE.md "Atomic
	// Updates", "Asset Replacement"): write the new version fully into a
	// fresh, uniquely named directory first; only once that has fully
	// succeeded is the previous directory (if any) swapped out and removed.
	// A failure at any point up to the swap leaves the previously working
	// Comparison's own directory completely untouched. ---
	$final_dir = sameview_comparison_assets_dir( $session_id );
	$new_dir   = $final_dir . '.new-' . wp_generate_password( 8, false );

	sameview_copy_directory_contents( $seed_dir, $new_dir );
	foreach ( array( 'reference.jpg', 'capture.jpg' ) as $required_asset ) {
		if ( ! is_file( trailingslashit( $new_dir ) . $required_asset ) ) {
			sameview_delete_directory_recursive( $new_dir );
			return array(
				'status'  => 'rejected',
				'message' => 'Comparison could not be imported. Please try again.',
			);
		}
	}
	// The manifest itself is not a public asset — only the images (and
	// optional branding) belong in the SameView-owned uploads directory.
	$copied_manifest_path = trailingslashit( $new_dir ) . 'comparison.json';
	if ( is_file( $copied_manifest_path ) ) {
		wp_delete_file( $copied_manifest_path );
	}

	$old_dir = null;
	if ( is_dir( $final_dir ) ) {
		$old_dir = $final_dir . '.old-' . wp_generate_password( 8, false );
		rename( $final_dir, $old_dir );
	}
	rename( $new_dir, $final_dir );
	// Superseded assets are removed only after the new version is already
	// safely in place (docs/EMBED_IN_WEBSITE.md "Asset Replacement":
	// "removed rather than accumulated indefinitely") — a failure to delete
	// the old directory at this point leaves an inert leftover, never a
	// broken Comparison.
	if ( $old_dir ) {
		sameview_delete_directory_recursive( $old_dir );
	}

	$manifest_json = wp_json_encode( $manifest );

	if ( $existing_post_id ) {
		wp_update_post(
			array(
				'ID'                => $existing_post_id,
				'post_modified'     => current_time( 'mysql' ),
				'post_modified_gmt' => current_time( 'mysql', true ),
			)
		);
		update_post_meta( $existing_post_id, SAMEVIEW_META_OUTCOME_FINGERPRINT, $manifest['outcomeFingerprint'] );
		update_post_meta( $existing_post_id, SAMEVIEW_META_MANIFEST, $manifest_json );

		return array(
			'status'  => 'updated',
			'message' => 'Comparison updated.',
			'post_id' => $existing_post_id,
		);
	}

	// `isset()` on this nested path never warns even if `presentation` itself
	// is absent from a malformed manifest — direct/`!empty()` access would
	// (docs/AI_ENGINEERING_GUIDE.md "Testing": no PHP warnings/notices during
	// the tested lifecycle, verified by the real wp-env test).
	$title = isset( $manifest['presentation']['title'] ) && is_string( $manifest['presentation']['title'] ) && '' !== $manifest['presentation']['title']
		? sanitize_text_field( $manifest['presentation']['title'] )
		: 'SameView Comparison';

	$new_post_id = wp_insert_post(
		array(
			'post_type'   => SAMEVIEW_POST_TYPE,
			'post_status' => 'publish',
			'post_title'  => $title,
		),
		true
	);
	if ( is_wp_error( $new_post_id ) ) {
		sameview_delete_directory_recursive( $final_dir );
		return array(
			'status'  => 'rejected',
			'message' => 'Comparison could not be imported. Please try again.',
		);
	}

	update_post_meta( $new_post_id, SAMEVIEW_META_SESSION_ID, $session_id );
	update_post_meta( $new_post_id, SAMEVIEW_META_OUTCOME_FINGERPRINT, $manifest['outcomeFingerprint'] );
	update_post_meta( $new_post_id, SAMEVIEW_META_MANIFEST, $manifest_json );

	return array(
		'status'  => 'added',
		'message' => 'Comparison added.',
		'post_id' => $new_post_id,
	);
}
