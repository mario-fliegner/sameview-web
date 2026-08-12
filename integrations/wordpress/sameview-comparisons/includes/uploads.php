<?php
/**
 * SameView-owned uploads subdirectory (docs/WORDPRESS_INTEGRATION.md
 * "Storage Model": "stored in a SameView-owned directory under the
 * WordPress uploads directory, not registered in or exposed through the
 * WordPress Media Library"). Exclusion from the Media Library is achieved
 * by omission — this plugin never calls the Media Library APIs
 * (`wp_insert_attachment()` etc.) for these files — not by anything in
 * this file. No Comparison assets exist yet at Phase 14 (docs/IMPLEMENTATION_PLAN_V1.md);
 * this only establishes the directory itself.
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

function sameview_remove_uploads_dir() {
	$dir = sameview_uploads_dir();
	if ( ! is_dir( $dir ) ) {
		return;
	}

	foreach ( scandir( $dir ) as $item ) {
		if ( '.' === $item || '..' === $item ) {
			continue;
		}
		$path = trailingslashit( $dir ) . $item;
		if ( is_dir( $path ) ) {
			continue; // No subdirectories are ever created by this plugin.
		}
		wp_delete_file( $path );
	}

	rmdir( $dir );
}
