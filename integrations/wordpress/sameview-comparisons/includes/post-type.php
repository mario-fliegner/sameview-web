<?php
/**
 * Custom Post Type + Post Meta registration for stored Comparisons
 * (docs/WORDPRESS_INTEGRATION.md "Storage Model").
 *
 * Phase 14 (docs/IMPLEMENTATION_PLAN_V1.md) scope: registration only — no
 * Comparison-facing UI and no Add/Update/Delete workflow yet (Phase 15+).
 * `public`/`show_ui`/`show_in_menu` stay false so this post type is
 * reachable only through code (WP-CLI today; the future admin workflow
 * later), never through any WordPress admin screen at this phase.
 *
 * The first two registered meta keys mirror docs/IMPORTED_COMPARISON_V1.md
 * "Comparison Identity (`session.id`)" and "Outcome Fingerprint" —
 * WordPress only ever stores and compares these values, never computes or
 * interprets them (docs/WORDPRESS_INTEGRATION.md "Storage Model"). The third
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 15) holds the full validated
 * Comparison manifest JSON (includes/import.php `sameview_import_seed()`) —
 * additive Post Meta storage, not a redesign of Phase 14's schema.
 *
 * This file only defines constants/functions; it never calls them at load
 * time, so uninstall.php can safely `require` it without re-registering
 * the post type or triggering any hook.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_POST_TYPE', 'sameview_comparison' );
define( 'SAMEVIEW_META_SESSION_ID', '_sameview_session_id' );
define( 'SAMEVIEW_META_OUTCOME_FINGERPRINT', '_sameview_outcome_fingerprint' );
define( 'SAMEVIEW_META_MANIFEST', '_sameview_manifest_json' );

function sameview_register_post_type() {
	register_post_type(
		SAMEVIEW_POST_TYPE,
		array(
			'label'               => 'SameView Comparisons',
			'public'              => false,
			'show_ui'             => false,
			'show_in_menu'        => false,
			'show_in_rest'        => false,
			'publicly_queryable'  => false,
			'exclude_from_search' => true,
			'hierarchical'        => false,
			'supports'            => array( 'title' ),
		)
	);

	register_post_meta(
		SAMEVIEW_POST_TYPE,
		SAMEVIEW_META_SESSION_ID,
		array(
			'type'         => 'string',
			'single'       => true,
			'show_in_rest' => false,
		)
	);

	register_post_meta(
		SAMEVIEW_POST_TYPE,
		SAMEVIEW_META_OUTCOME_FINGERPRINT,
		array(
			'type'         => 'string',
			'single'       => true,
			'show_in_rest' => false,
		)
	);

	register_post_meta(
		SAMEVIEW_POST_TYPE,
		SAMEVIEW_META_MANIFEST,
		array(
			'type'         => 'string',
			'single'       => true,
			'show_in_rest' => false,
		)
	);
}
