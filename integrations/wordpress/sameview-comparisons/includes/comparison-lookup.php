<?php
/**
 * The one shared `session.id` → stored Comparison post lookup
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 "WordPress implementation": "Use
 * one shared Comparison lookup helper by session.id for: import; block
 * rendering; shortcode rendering"). `session.id` — never the WordPress post
 * ID — is the one stable identity a placement may persist
 * (docs/EMBED_IN_WEBSITE.md "Comparison Identity",
 * "Placement Behavior After Deletion": a placement whose Comparison was
 * deleted and later re-imported under the same `session.id` becomes
 * functional again without resaving the post, which only works if every
 * lookup resolves the *current* post by this value at call time rather than
 * trusting a previously stored post ID).
 *
 * Extracted from includes/import.php's own pre-existing inline `get_posts()`
 * call (docs/IMPLEMENTATION_PLAN_V1.md Phase 15) once a second and third
 * caller (Phase 16 block/shortcode rendering) needed the exact same lookup —
 * never duplicated between them.
 *
 * This file only defines a function; it never calls it at load time, so
 * uninstall.php can safely `require` it without side effects.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

/**
 * Returns the post ID of the stored Comparison with this `session.id`, or
 * `null` if none exists. `post_status => 'any'` reproduces
 * includes/import.php's own pre-existing lookup exactly, byte-for-byte
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 "Scope discipline": extracting
 * this helper must not change Phase 15's already-verified import lifecycle
 * behavior) — every Comparison this plugin ever creates is `'publish'`
 * anyway (no status-changing admin UI exists yet), so this is a no-op
 * distinction in practice today.
 */
function sameview_find_comparison_by_session_id( $session_id ) {
	if ( empty( $session_id ) || ! is_string( $session_id ) ) {
		return null;
	}
	$posts = get_posts(
		array(
			'post_type'      => SAMEVIEW_POST_TYPE,
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'meta_key'       => SAMEVIEW_META_SESSION_ID,
			'meta_value'     => $session_id,
			'fields'         => 'ids',
		)
	);
	return $posts ? (int) $posts[0] : null;
}
