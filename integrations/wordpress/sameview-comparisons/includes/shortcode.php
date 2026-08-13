<?php
/**
 * The shortcode compatibility path
 * (docs/WORDPRESS_INTEGRATION.md "Placement": "A shortcode is an additional
 * compatibility path, for contexts without Block Editor support ... rendered
 * through the same underlying renderer as the block — never a second,
 * independently maintained rendering implementation"). Calls the exact same
 * shared render path as includes/block.php's `render_callback`
 * (includes/render.php `sameview_render_comparison_embed()`).
 *
 * Usage: `[sameview_comparison session_id="..."]` — `session_id`, never a
 * WordPress post ID (docs/EMBED_IN_WEBSITE.md "Comparison Identity").
 *
 * This file only defines functions; the one hook registration at the end
 * only registers a callback — it does not itself render anything or touch
 * stored state, so uninstall.php can safely `require` it too.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_SHORTCODE_TAG', 'sameview_comparison' );

function sameview_render_shortcode( $atts ) {
	$atts = shortcode_atts( array( 'session_id' => '' ), $atts, SAMEVIEW_SHORTCODE_TAG );
	$session_id = is_string( $atts['session_id'] ) ? $atts['session_id'] : '';
	if ( '' === $session_id ) {
		return '';
	}
	return sameview_render_comparison_embed( $session_id );
}

add_shortcode( SAMEVIEW_SHORTCODE_TAG, 'sameview_render_shortcode' );
