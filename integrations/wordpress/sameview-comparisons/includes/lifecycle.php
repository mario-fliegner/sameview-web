<?php
/**
 * Activation/deactivation lifecycle (docs/WORDPRESS_INTEGRATION.md
 * "Persistent Integration"; docs/EMBED_IN_WEBSITE.md "Deactivation and
 * Uninstall"). Phase 14 (docs/IMPLEMENTATION_PLAN_V1.md) scope only: the
 * structural foundation (CPT, uploads directory, capability) — never the
 * Comparison seed-bootstrap (docs/WORDPRESS_INTEGRATION.md "First
 * Installation", Phase 15).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

function sameview_activate() {
	sameview_register_post_type();
	sameview_create_uploads_dir();
	sameview_grant_capabilities();
	flush_rewrite_rules();
}

/**
 * Deliberately does nothing beyond the standard rewrite-rule cleanup:
 * deactivation must preserve every stored Comparison, its Post Meta and
 * the uploads directory unchanged (docs/EMBED_IN_WEBSITE.md "Deactivation
 * and Uninstall": "deactivation preserves all stored Comparisons and
 * placement relationships"). Registered explicitly, rather than left
 * unregistered, so that intent is visible in code and verifiable by the
 * Phase 14 wp-env test.
 */
function sameview_deactivate() {
	flush_rewrite_rules();
}
