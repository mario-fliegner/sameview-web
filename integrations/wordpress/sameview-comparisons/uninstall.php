<?php
/**
 * WordPress's own special uninstall entry point — invoked by WordPress
 * core only when this plugin is removed via `wp plugin delete`/the admin
 * "Delete" action, never on ordinary deactivation
 * (docs/EMBED_IN_WEBSITE.md "Deactivation and Uninstall": "Full
 * uninstall/removal deletes all data owned by the integration ... with no
 * orphaned data left behind").
 *
 * Deletes every stored Comparison post (which cascades its own Post Meta,
 * per WordPress's own `wp_delete_post()` behavior), the SameView-owned
 * uploads directory, and the granted capability from every role that has
 * it.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit; // Disallow direct access outside WordPress's own uninstall flow.
}

require_once __DIR__ . '/includes/post-type.php';
require_once __DIR__ . '/includes/uploads.php';
require_once __DIR__ . '/includes/capabilities.php';

$comparison_ids = get_posts(
	array(
		'post_type'   => SAMEVIEW_POST_TYPE,
		'post_status' => 'any',
		'numberposts' => -1,
		'fields'      => 'ids',
	)
);

foreach ( $comparison_ids as $comparison_id ) {
	wp_delete_post( $comparison_id, true );
}

sameview_remove_uploads_dir();
sameview_revoke_capabilities();
