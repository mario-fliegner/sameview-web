<?php
/**
 * SameView-owned uploads subdirectory (docs/WORDPRESS_INTEGRATION.md
 * "Storage Model": "stored in a SameView-owned directory under the
 * WordPress uploads directory, not registered in or exposed through the
 * WordPress Media Library"). Exclusion from the Media Library is achieved
 * by omission — this plugin never calls the Media Library APIs
 * (`wp_insert_attachment()` etc.) for these files — not by anything in
 * this file. Phase 14 (docs/IMPLEMENTATION_PLAN_V1.md) only established the
 * directory itself; Phase 15 stores each Comparison's assets in its own
 * subdirectory here (includes/import.php `sameview_comparison_assets_dir()`).
 *
 * This file only defines functions; it never calls them at load time, so
 * uninstall.php can safely `require` it without side effects.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_UPLOADS_SUBDIR', 'sameview-comparisons' );

function sameview_uploads_dir() {
	$upload_dir = wp_upload_dir();
	return trailingslashit( $upload_dir['basedir'] ) . SAMEVIEW_UPLOADS_SUBDIR;
}

function sameview_create_uploads_dir() {
	$dir = sameview_uploads_dir();
	wp_mkdir_p( $dir );

	// Long-standing WordPress convention: an empty index.php prevents raw
	// directory listing on servers with autoindex enabled — a
	// web-server-level precaution, independent of the Media-Library
	// exclusion described above.
	$index_file = trailingslashit( $dir ) . 'index.php';
	if ( ! file_exists( $index_file ) ) {
		file_put_contents( $index_file, "<?php\n// Silence is golden.\n" );
	}
}

/**
 * Recursively deletes a directory and everything inside it. General
 * filesystem infrastructure shared by `sameview_remove_uploads_dir()`
 * below and includes/import.php's own atomic update/cleanup logic (old-
 * and temp-directory removal) — plain PHP (`scandir`/`wp_delete_file`/
 * `rmdir`), never the `WP_Filesystem` abstraction, since every path this
 * plugin ever passes here is already a local filesystem path.
 */
function sameview_delete_directory_recursive( $dir ) {
	if ( ! is_dir( $dir ) ) {
		return;
	}
	foreach ( scandir( $dir ) as $item ) {
		if ( '.' === $item || '..' === $item ) {
			continue;
		}
		$path = trailingslashit( $dir ) . $item;
		if ( is_dir( $path ) ) {
			sameview_delete_directory_recursive( $path );
		} else {
			wp_delete_file( $path );
		}
	}
	rmdir( $dir );
}

/**
 * Removes the entire SameView-owned uploads directory, including every
 * per-Comparison subdirectory it contains (docs/EMBED_IN_WEBSITE.md
 * "Deactivation and Uninstall": "no orphaned data left behind") — Phase 14
 * only ever had the empty top-level directory + its `index.php` guard to
 * remove; Phase 15 added real per-Comparison subdirectories
 * (includes/import.php), so this now delegates to the general recursive
 * helper above rather than only ever deleting top-level files.
 */
function sameview_remove_uploads_dir() {
	sameview_delete_directory_recursive( sameview_uploads_dir() );
}
