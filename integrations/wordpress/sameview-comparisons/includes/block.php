<?php
/**
 * The native SameView Gutenberg block (docs/IMPLEMENTATION_PLAN_V1.md Phase
 * 16; docs/WORDPRESS_INTEGRATION.md "Placement"). A dynamic block: `save()`
 * (assets/block/index.js) always returns `null`, and every render — public
 * frontend, and the Block Editor's own interactive preview via
 * `ServerSideRender` — goes through `sameview_render_block_callback()`
 * below, which only ever calls the one shared render path
 * (includes/render.php `sameview_render_comparison_embed()`). This is
 * WordPress's own, real, native mechanism for a dynamic block with a
 * PHP-rendered, genuinely interactive editor preview — not a second data
 * path invented for the editor (docs/IMPLEMENTATION_PLAN_V1.md Phase 16
 * Decision 74 is satisfied because `ServerSideRender` calls the
 * block-renderer REST route WordPress core itself already registers for
 * every block; this neither enables REST for the Comparison CPT nor adds a
 * new custom REST endpoint).
 *
 * The block persists only `session.id` as its one attribute
 * (docs/EMBED_IN_WEBSITE.md "Comparison Identity",
 * "Placement Behavior After Deletion") — never the WordPress post ID.
 *
 * This file only defines functions; the two hook registrations at the very
 * end only ever register callbacks — they do not themselves render anything
 * or touch stored state, so uninstall.php can safely `require` it too.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_BLOCK_NAME', 'sameview/comparison' );
define( 'SAMEVIEW_BLOCK_EDITOR_SCRIPT_HANDLE', 'sameview-comparisons-block-editor' );

function sameview_register_block() {
	register_block_type(
		trailingslashit( SAMEVIEW_COMPARISONS_DIR ) . 'assets/block',
		array(
			'render_callback' => 'sameview_render_block_callback',
		)
	);
}

function sameview_render_block_callback( $attributes ) {
	$session_id = isset( $attributes['sessionId'] ) && is_string( $attributes['sessionId'] )
		? $attributes['sessionId']
		: '';
	if ( '' === $session_id ) {
		return '';
	}
	return sameview_render_comparison_embed( $session_id );
}

/**
 * The Comparison picker's own data source
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 Decision 74: "Provide the
 * available Comparison list server-side when the Block Editor loads. Do not
 * enable the Comparison CPT in REST. Do not add a custom REST endpoint.").
 * A plain `get_posts()` query, localized once per editor screen load — no
 * REST route of any kind, matching the CPT's existing `show_in_rest: false`
 * (includes/post-type.php) unchanged.
 */
function sameview_get_comparison_picker_options() {
	$posts = get_posts(
		array(
			'post_type'      => SAMEVIEW_POST_TYPE,
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => 'modified',
			'order'          => 'DESC',
			'fields'         => 'ids',
		)
	);

	$options = array();
	foreach ( $posts as $post_id ) {
		$session_id = get_post_meta( $post_id, SAMEVIEW_META_SESSION_ID, true );
		if ( ! $session_id ) {
			continue;
		}
		$options[] = array(
			'sessionId' => $session_id,
			'title'     => get_the_title( $post_id ),
		);
	}
	return $options;
}

/**
 * Registers and enqueues the hand-written vanilla editor script — no
 * `@wordpress/scripts`/webpack build step
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 Decision 73): every dependency
 * listed here is a WordPress-core-provided script handle, already bundled
 * with WordPress itself.
 *
 * Also localizes the shared Embed runtime/CSS URLs (never enqueues them
 * here): confirmed empirically against a real `wp-env` instance that neither
 * a top-level `enqueue_block_editor_assets` script nor `ServerSideRender`'s
 * own response reaches the Block Editor's iframed canvas's own document —
 * the editor script itself (assets/block/index.js
 * `ensureEmbedRuntimeLoaded()`) loads the runtime directly into that
 * document once a `ComparisonPreview` actually mounts there, which also
 * keeps this editor-only loading exactly as conditional as the public
 * frontend's own per-render enqueue in includes/render.php
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 "Asset loading").
 */
function sameview_enqueue_block_editor_assets() {
	$script_path = trailingslashit( SAMEVIEW_COMPARISONS_DIR ) . 'assets/block/index.js';
	wp_register_script(
		SAMEVIEW_BLOCK_EDITOR_SCRIPT_HANDLE,
		plugins_url( 'assets/block/index.js', SAMEVIEW_COMPARISONS_FILE ),
		array(
			'wp-blocks',
			'wp-element',
			'wp-block-editor',
			'wp-components',
			'wp-server-side-render',
			'wp-i18n',
		),
		file_exists( $script_path ) ? (string) filemtime( $script_path ) : SAMEVIEW_COMPARISONS_VERSION,
		true
	);
	wp_set_script_translations(
		SAMEVIEW_BLOCK_EDITOR_SCRIPT_HANDLE,
		'sameview-comparisons',
		trailingslashit( SAMEVIEW_COMPARISONS_DIR ) . 'languages'
	);
	wp_localize_script(
		SAMEVIEW_BLOCK_EDITOR_SCRIPT_HANDLE,
		'sameviewComparisonsBlockData',
		array(
			'comparisons' => sameview_get_comparison_picker_options(),
			'embedAssets' => sameview_embed_asset_urls(),
		)
	);
	wp_enqueue_script( SAMEVIEW_BLOCK_EDITOR_SCRIPT_HANDLE );
}

add_action( 'init', 'sameview_register_block' );
add_action( 'enqueue_block_editor_assets', 'sameview_enqueue_block_editor_assets' );
