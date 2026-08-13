<?php
/**
 * The one shared render path for placing a stored Comparison
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 "WordPress implementation": "The
 * block and shortcode must use one shared render path"). Used identically by
 * includes/block.php's `render_callback` (including the Block Editor's own
 * ServerSideRender-driven interactive preview — WordPress's own real, native
 * dynamic-block mechanism, not a second data path) and includes/shortcode.php.
 *
 * This function never builds Presentation markup itself
 * (docs/WORDPRESS_INTEGRATION.md "Placement": "no PHP reimplementation of
 * Presentation rendering"). It only resolves `session.id` to the current
 * stored post (includes/comparison-lookup.php — never a stored post ID, so
 * an update or a delete/re-import under the same `session.id` keeps working
 * automatically, docs/EMBED_IN_WEBSITE.md "Placement Behavior After
 * Deletion"), reads the already-validated stored manifest, resolves asset
 * URLs and WordPress-native localized copy strings, and hands all of that to
 * the shared JS renderer (src/lib/comparison-embed-runtime-entry.ts,
 * packaged at sameview-comparisons/assets/embed/) as one plain JSON payload
 * per placement.
 *
 * Returns an empty string when the referenced Comparison cannot be found —
 * the public "renders nothing, reserves no space" missing state
 * (docs/EMBED_IN_WEBSITE.md "Placement Behavior After Deletion"). The Block
 * Editor's own separate missing-Comparison state (a picker to choose another)
 * is a client-side editor concern (includes/block.php's editor script), not
 * this function's.
 *
 * This file only defines functions; it never calls them at load time, so
 * uninstall.php can safely `require` it without side effects.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_EMBED_ASSET_HANDLE', 'sameview-comparisons-embed' );

/**
 * Enqueues the shared Embed runtime script/CSS
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 "Asset loading": "the simplest
 * WordPress-native enqueue behavior that loads the renderer when a SameView
 * block/shortcode actually requires it"). Called only from inside
 * `sameview_render_comparison_embed()` below — i.e. only when a placement is
 * actually about to be rendered on the current page — never unconditionally
 * on every request, so an unrelated public page never loads these assets.
 * `wp_enqueue_script()`/`wp_enqueue_style()` register-then-enqueue in one
 * call and safely dedupe across multiple placements on the same page.
 */
function sameview_enqueue_embed_assets() {
	$urls = sameview_embed_asset_urls();
	wp_enqueue_script(
		SAMEVIEW_EMBED_ASSET_HANDLE,
		$urls['script'],
		array(),
		SAMEVIEW_COMPARISONS_VERSION,
		true
	);
	wp_enqueue_style(
		SAMEVIEW_EMBED_ASSET_HANDLE,
		$urls['style'],
		array(),
		SAMEVIEW_COMPARISONS_VERSION
	);
}

/**
 * The Embed runtime/CSS URLs, also handed to the Block Editor
 * (includes/block.php) as plain data: the Block Editor's own iframed canvas
 * (confirmed empirically against a real `wp-env` instance: WordPress does
 * *not* automatically mirror a top-level `enqueue_block_editor_assets` script
 * into that iframe's own document, and `ServerSideRender` does not inject a
 * render's own `wp_enqueue_script()` calls into it either) needs to load
 * this script into its own document itself — see assets/block/index.js
 * `ensureEmbedRuntimeLoaded()`. Both callers resolve the exact same URLs
 * this way, never a second hardcoded path.
 */
function sameview_embed_asset_urls() {
	return array(
		'script' => plugins_url( 'assets/embed/comparison-embed-runtime.js', SAMEVIEW_COMPARISONS_FILE ),
		'style'  => plugins_url( 'assets/embed/comparison-embed.css', SAMEVIEW_COMPARISONS_FILE ),
	);
}

/**
 * The WordPress-native localized copy the shared JS renderer needs
 * (docs/EMBED_IN_WEBSITE.md "Localization": resolved from the current
 * frontend page language at render time, never frozen to SameView Web's own
 * generation-time locale — WordPress's own `__()` already does exactly this,
 * per docs/WORDPRESS_INTEGRATION.md "Where possible, platform-native
 * internationalization mechanisms are used").
 */
function sameview_embed_copy_strings() {
	return array(
		'referenceAlt' => __( 'Reference photo', 'sameview-comparisons' ),
		'captureAlt'   => __( 'Capture photo', 'sameview-comparisons' ),
		'sliderLabel'  => __( 'Comparison position', 'sameview-comparisons' ),
		'loadingLabel' => __( 'Loading comparison…', 'sameview-comparisons' ),
	);
}

function sameview_render_comparison_embed( $session_id ) {
	$post_id = sameview_find_comparison_by_session_id( $session_id );
	if ( ! $post_id ) {
		return '';
	}

	$manifest_json = get_post_meta( $post_id, SAMEVIEW_META_MANIFEST, true );
	$manifest      = json_decode( (string) $manifest_json, true );
	if ( ! is_array( $manifest ) || JSON_ERROR_NONE !== json_last_error() ) {
		return '';
	}

	$assets_dir         = sameview_comparison_assets_dir( $session_id );
	$has_branding_asset = is_file( trailingslashit( $assets_dir ) . 'branding.png' );
	$assets_url         = trailingslashit( sameview_uploads_url() ) . md5( $session_id );

	$payload = array(
		'presentation'          => isset( $manifest['presentation'] ) ? $manifest['presentation'] : new stdClass(),
		'visibility'            => isset( $manifest['visibility'] ) ? $manifest['visibility'] : new stdClass(),
		'configuration'         => isset( $manifest['configuration'] ) ? $manifest['configuration'] : new stdClass(),
		'branding'              => isset( $manifest['branding'] ) ? $manifest['branding'] : array( 'kind' => 'none' ),
		'initialSliderPosition' => isset( $manifest['initialSliderPosition'] ) ? $manifest['initialSliderPosition'] : 0.5,
		'assets'                => array(
			'referenceSrc' => $assets_url . '/reference.jpg',
			'captureSrc'   => $assets_url . '/capture.jpg',
			'brandingSrc'  => $has_branding_asset ? $assets_url . '/branding.png' : null,
		),
		'copy'                  => sameview_embed_copy_strings(),
	);

	sameview_enqueue_embed_assets();

	$js_required_text = __( 'JavaScript is required to view this SameView Comparison.', 'sameview-comparisons' );

	return sprintf(
		'<div class="sameview-comparison-embed" data-sameview-embed="%1$s"><noscript>%2$s</noscript></div>',
		esc_attr( wp_json_encode( $payload ) ),
		esc_html( $js_required_text )
	);
}
