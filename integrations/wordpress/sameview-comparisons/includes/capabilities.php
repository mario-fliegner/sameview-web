<?php
/**
 * Native WordPress capability foundation for the administrative
 * Comparison-library actions (docs/WORDPRESS_INTEGRATION.md "Permissions
 * and Security"; docs/EMBED_IN_WEBSITE.md "Permissions"). No separate
 * SameView user/role system is introduced — this grants one ordinary
 * WordPress capability to the existing `administrator` role.
 *
 * Phase 14 (docs/IMPLEMENTATION_PLAN_V1.md) only establishes the
 * capability itself; no admin action exists yet to gate behind it (Add
 * comparison, Update, Delete are Phase 15+).
 *
 * This file only defines a constant/functions; it never calls them at
 * load time, so uninstall.php can safely `require` it without side
 * effects.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_CAPABILITY', 'manage_sameview_comparisons' );

function sameview_grant_capabilities() {
	$role = get_role( 'administrator' );
	if ( $role && ! $role->has_cap( SAMEVIEW_CAPABILITY ) ) {
		$role->add_cap( SAMEVIEW_CAPABILITY );
	}
}

function sameview_revoke_capabilities() {
	foreach ( wp_roles()->role_objects as $role ) {
		if ( $role->has_cap( SAMEVIEW_CAPABILITY ) ) {
			$role->remove_cap( SAMEVIEW_CAPABILITY );
		}
	}
}
