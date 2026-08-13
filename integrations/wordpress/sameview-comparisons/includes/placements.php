<?php
/**
 * Read-only placement discovery by session.id (docs/EMBED_IN_WEBSITE.md
 * "Comparison Management": usage count and concrete usages/placements
 * "where reliably available"; docs/IMPLEMENTATION_PLAN_V1.md Phase 18).
 *
 * A two-stage lookup, never a persistent index (docs/IMPLEMENTATION_PLAN_V1.md
 * Phase 18: "no persistent placement index"):
 *
 * Stage 1 is one bounded SQL query against $wpdb->posts for a literal
 * marker substring, restricted to post statuses that are actually live
 * content and post types that can contain block/shortcode markup at all —
 * never every post on the site parsed one by one.
 *
 * Stage 2 confirms each Stage-1 candidate exactly, using WordPress's own
 * parsers — parse_blocks() and the core shortcode regex/attribute parser —
 * rather than assuming a particular JSON/whitespace serialization shape.
 *
 * This intentionally does not resolve indirection through Synced
 * Patterns/reusable blocks (`wp_block` posts referenced elsewhere via
 * `wp:block {"ref":ID}`) or legacy widget-area content stored in wp_options
 * rather than wp_posts — both are unreachable without an unbounded,
 * disallowed whole-site scanner (docs/EMBED_IN_WEBSITE.md "Comparison
 * Management": "No unreliable whole-site scanner is introduced solely to
 * approximate usage"). A Comparison found only inside a pattern is reported
 * as used by that pattern post itself, not by every page that transcludes
 * it. See this repository's own Phase 18 analysis for the full reasoning.
 *
 * $wpdb is used directly only for the one bounded, literal-substring
 * candidate query in sameview_placement_candidates() below — WordPress core
 * exposes no public API for "find posts whose content contains this exact
 * string" (WP_Query's own `s` parameter performs relevance-ranked full-text
 * SEARCH, not a literal substring match, and accepts no raw LIKE pattern).
 *
 * This file only defines functions; it never calls them at load time, so
 * uninstall.php can safely `require` it without side effects. Depends on
 * SAMEVIEW_BLOCK_NAME (includes/block.php) and SAMEVIEW_SHORTCODE_TAG
 * (includes/shortcode.php) — required after both in sameview-comparisons.php.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

/**
 * Post types able to contain block/shortcode markup in their own
 * post_content: those declaring 'editor' support — the same signal
 * WordPress itself uses to decide whether a post type gets a content
 * editor — self-maintaining for any custom post type a site adds, plus the
 * two core block-theme post types (docs/WORDPRESS_INTEGRATION.md "Frontend
 * Delivery": "placements outside ordinary singular post content ...
 * block-theme template parts"), which store block markup in post_content
 * without declaring conventional 'editor' support.
 */
function sameview_placement_candidate_post_types() {
	$types = array();
	foreach ( get_post_types( array( 'show_ui' => true ) ) as $post_type ) {
		if ( post_type_supports( $post_type, 'editor' ) ) {
			$types[] = $post_type;
		}
	}
	foreach ( array( 'wp_template', 'wp_template_part' ) as $fse_type ) {
		if ( post_type_exists( $fse_type ) && ! in_array( $fse_type, $types, true ) ) {
			$types[] = $fse_type;
		}
	}
	return $types;
}

/**
 * Stage 1: candidate rows whose post_content contains either marker,
 * restricted to non-trash/non-auto-draft posts of a content-bearing post
 * type. One bounded query, never a per-post loop over the whole site.
 */
function sameview_placement_candidates() {
	global $wpdb;
	$post_types = sameview_placement_candidate_post_types();
	if ( empty( $post_types ) ) {
		return array();
	}

	$placeholders   = implode( ', ', array_fill( 0, count( $post_types ), '%s' ) );
	$like_block     = '%' . $wpdb->esc_like( 'wp:' . SAMEVIEW_BLOCK_NAME ) . '%';
	$like_shortcode = '%' . $wpdb->esc_like( SAMEVIEW_SHORTCODE_TAG ) . '%';

	// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- built entirely
	// from $wpdb->prepare() placeholders below; no raw value is concatenated
	// directly into the SQL string.
	$sql = $wpdb->prepare(
		"SELECT ID, post_content, post_type, post_status, post_title FROM {$wpdb->posts}
		 WHERE post_status NOT IN ('trash', 'auto-draft')
		 AND post_type IN ( $placeholders )
		 AND (post_content LIKE %s OR post_content LIKE %s)",
		array_merge( $post_types, array( $like_block, $like_shortcode ) )
	);
	return $wpdb->get_results( $sql );
}

/**
 * Stage 2a: does this candidate's post_content contain a
 * `sameview/comparison` block whose own `sessionId` attribute exactly
 * matches? Uses parse_blocks() — WordPress's own block parser — rather than
 * any string-format assumption; walks inner blocks too (a placement nested
 * inside a Group/Columns block is still found).
 */
function sameview_content_has_block_placement( $post_content, $session_id ) {
	foreach ( parse_blocks( $post_content ) as $block ) {
		if ( sameview_block_tree_has_placement( $block, $session_id ) ) {
			return true;
		}
	}
	return false;
}

function sameview_block_tree_has_placement( $block, $session_id ) {
	if (
		isset( $block['blockName'] ) && SAMEVIEW_BLOCK_NAME === $block['blockName']
		&& isset( $block['attrs']['sessionId'] ) && $block['attrs']['sessionId'] === $session_id
	) {
		return true;
	}
	if ( ! empty( $block['innerBlocks'] ) ) {
		foreach ( $block['innerBlocks'] as $inner_block ) {
			if ( sameview_block_tree_has_placement( $inner_block, $session_id ) ) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Stage 2b: does this candidate's post_content contain a
 * `[sameview_comparison session_id="..."]` shortcode whose own attribute
 * exactly matches? Uses WordPress's own shortcode regex/attribute parser
 * (get_shortcode_regex(), shortcode_parse_atts()) so either quoting style
 * WordPress itself accepts is handled correctly.
 */
function sameview_content_has_shortcode_placement( $post_content, $session_id ) {
	$pattern = '/' . get_shortcode_regex( array( SAMEVIEW_SHORTCODE_TAG ) ) . '/';
	if ( ! preg_match_all( $pattern, $post_content, $matches, PREG_SET_ORDER ) ) {
		return false;
	}
	foreach ( $matches as $match ) {
		$atts = shortcode_parse_atts( $match[3] );
		if ( is_array( $atts ) && isset( $atts['session_id'] ) && $atts['session_id'] === $session_id ) {
			return true;
		}
	}
	return false;
}

/**
 * The one public entry point: every confirmed placement of the given
 * session_id, as a plain list of { post_id, title, edit_link, status, kind }.
 * Never cached, never persisted — recomputed on every call. Only ever
 * called from the admin library screen (usage badge, delete-confirmation
 * warning) — never on every page load or public render.
 */
function sameview_find_placements( $session_id ) {
	if ( empty( $session_id ) || ! is_string( $session_id ) ) {
		return array();
	}
	$placements = array();
	foreach ( sameview_placement_candidates() as $candidate ) {
		$has_block     = sameview_content_has_block_placement( $candidate->post_content, $session_id );
		$has_shortcode = ! $has_block && sameview_content_has_shortcode_placement( $candidate->post_content, $session_id );
		if ( $has_block || $has_shortcode ) {
			$placements[] = array(
				'post_id'   => (int) $candidate->ID,
				'title'     => $candidate->post_title ? $candidate->post_title : __( '(no title)', 'sameview-comparisons' ),
				'edit_link' => get_edit_post_link( $candidate->ID, 'raw' ),
				'status'    => $candidate->post_status,
				'kind'      => $has_block ? 'block' : 'shortcode',
			);
		}
	}
	return $placements;
}
