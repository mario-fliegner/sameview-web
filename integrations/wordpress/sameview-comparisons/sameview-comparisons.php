<?php
/**
 * Plugin Name: SameView Comparisons
 * Description: Persistent SameView Comparison storage and Add/Update lifecycle for WordPress (docs/IMPLEMENTATION_PLAN_V1.md Phase 14/15). No Comparison rendering yet (Phase 16).
 * Version: 0.2.0
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * Author: SameView
 * License: GPL-2.0-or-later
 * Text Domain: sameview-comparisons
 *
 * docs/WORDPRESS_INTEGRATION.md; docs/EMBED_IN_WEBSITE.md. Lives inside
 * the sameview-web repository's own dedicated integration area
 * (integrations/wordpress/), isolated from the Astro/React application
 * under src/ — see CLAUDE.md "Hard Constraints" and
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 14.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_COMPARISONS_VERSION', '0.2.0' );
define( 'SAMEVIEW_COMPARISONS_DIR', plugin_dir_path( __FILE__ ) );

require_once SAMEVIEW_COMPARISONS_DIR . 'includes/post-type.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/uploads.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/capabilities.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/import.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/lifecycle.php';
require_once SAMEVIEW_COMPARISONS_DIR . 'includes/admin-add-comparison.php';

register_activation_hook( __FILE__, 'sameview_activate' );
register_deactivation_hook( __FILE__, 'sameview_deactivate' );

add_action( 'init', 'sameview_register_post_type' );
