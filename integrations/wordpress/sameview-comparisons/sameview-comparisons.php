<?php
/**
 * Plugin Name: SameView Comparisons
 * Plugin URI: https://sameview.app/wordpress/
 * Description: Embed interactive SameView comparisons on your WordPress website.
 * Version: 0.4.0
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * Author: SameView.app
 * Author URI: https://sameview.app/
 * License: GPL-2.0-or-later
 * Text Domain: sameview-comparisons
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_COMPARISONS_VERSION', '0.4.0' );
define( 'SAMEVIEW_COMPARISONS_FILE', __FILE__ );
define( 'SAMEVIEW_COMPARISONS_DIR', plugin_dir_path( __FILE__ ) );

require_once SAMEVIEW_COMPARISONS_DIR . 'includes/post-type.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/uploads.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/capabilities.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/comparison-lookup.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/import.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/lifecycle.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/admin-add-comparison.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/render.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/block.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/shortcode.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/placements.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/admin-library.php';

register_activation_hook( __FILE__, 'sameview_activate' );
register_deactivation_hook( __FILE__, 'sameview_deactivate' );

add_action( 'init', 'sameview_register_post_type' );

/**
 * WordPress-native localization (docs/IMPLEMENTATION_PLAN_V1.md Phase 16;
 * docs/WORDPRESS_INTEGRATION.md "Localization": "platform-native
 * internationalization mechanisms are used"). Loads
 * languages/sameview-comparisons-{locale}.mo when present; English is the
 * built-in fallback (every `__()` call's own default string) when no
 * translation file matches.
 */
function sameview_load_textdomain() {
	load_plugin_textdomain(
		'sameview-comparisons',
		false,
		basename( SAMEVIEW_COMPARISONS_DIR ) . '/languages'
	);
}
add_action( 'init', 'sameview_load_textdomain' );
