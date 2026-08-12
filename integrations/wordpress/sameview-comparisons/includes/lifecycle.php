<?php
/**
 * Activation/deactivation lifecycle (docs/WORDPRESS_INTEGRATION.md
 * "Persistent Integration"; docs/EMBED_IN_WEBSITE.md "Deactivation and
 * Uninstall"). Phase 14 (docs/IMPLEMENTATION_PLAN_V1.md) established the
 * structural foundation (CPT, uploads directory, capability); Phase 15
 * additionally imports a bundled Comparison seed on activation, if this
 * package was built with one (docs/WORDPRESS_INTEGRATION.md "First
 * Installation").
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

function sameview_activate() {
	sameview_register_post_type();
	sameview_create_uploads_dir();
	sameview_grant_capabilities();
	sameview_import_bundled_seed();
	flush_rewrite_rules();
}

/**
 * docs/WORDPRESS_INTEGRATION.md "First Installation": "Installing that
 * package ... on a site with no SameView plugin yet, both installs the
 * plugin and makes the currently generated Comparison immediately
 * available, without a separate manual import step." Reuses the exact same
 * includes/import.php `sameview_import_seed()` the admin upload handler
 * calls (docs/WORDPRESS_INTEGRATION.md: "SameView Web never asks or infers
 * whether this is the first Comparison for a given site" — activation
 * applies the same Add/Update/no-op decision uniformly, so a plugin
 * update or a deactivate/reactivate cycle never re-adds a duplicate).
 *
 * A package built without a bundled seed (an ordinary plugin-code update,
 * not a first install) simply has no `seed/` directory here — a normal,
 * silent no-op, not an error.
 */
function sameview_import_bundled_seed() {
	$seed_dir = trailingslashit( SAMEVIEW_COMPARISONS_DIR ) . 'seed';
	if ( ! is_dir( $seed_dir ) ) {
		return;
	}
	sameview_import_seed( $seed_dir );
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
