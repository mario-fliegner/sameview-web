<?php
/**
 * The Comparison Library admin screen (docs/EMBED_IN_WEBSITE.md "Comparison
 * Management": "a library for completed Comparisons, not an editor ...
 * preview/thumbnail, Comparison title, reference-to-capture period, usage
 * count, concrete usages/placements where reliably available, `Add
 * comparison` and `Delete`. No rename, Presentation settings, metadata
 * editing, branding controls or separate manual update workflow are
 * provided."; docs/IMPLEMENTATION_PLAN_V1.md Phase 18).
 *
 * Deliberately minimal, matching that boundary exactly: list, a link to the
 * existing includes/admin-add-comparison.php upload screen (left otherwise
 * unchanged), and Delete. Nothing else.
 *
 * Delete follows the same nonce'd-GET-link-through-admin-post.php pattern
 * WordPress core itself uses for single-item destructive admin actions
 * (e.g. the Plugins/Themes screens' own "Delete" links), and the same
 * gated-capability + redirect-with-result shape
 * includes/admin-add-comparison.php's own upload handler already
 * established — never a second, differently-shaped admin workflow.
 *
 * This file only defines functions; the two hook registrations at the very
 * end only ever register callbacks — they do not themselves render anything
 * or touch stored state, so uninstall.php can safely `require` it too.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'SAMEVIEW_DELETE_COMPARISON_ACTION', 'sameview_delete_comparison' );

function sameview_register_library_menu() {
	add_management_page(
		__( 'SameView Comparisons', 'sameview-comparisons' ),
		__( 'SameView', 'sameview-comparisons' ),
		SAMEVIEW_CAPABILITY,
		'sameview-comparisons',
		'sameview_render_library_page'
	);
}

/**
 * "Reference → capture" period, from the already-localized labels the
 * Outcome Snapshot derived at generation time
 * (src/lib/comparison-presentation.ts `referenceLabel`/`captureLabel`) —
 * carried unchanged through the WordPress package manifest, never
 * recomputed here (docs/EMBED_IN_WEBSITE.md "Editing Boundary": WordPress
 * is not a second SameView editor).
 */
function sameview_library_period_label( $manifest ) {
	$reference = isset( $manifest['presentation']['referenceLabel'] ) && is_string( $manifest['presentation']['referenceLabel'] )
		? $manifest['presentation']['referenceLabel']
		: '';
	$capture = isset( $manifest['presentation']['captureLabel'] ) && is_string( $manifest['presentation']['captureLabel'] )
		? $manifest['presentation']['captureLabel']
		: '';
	if ( '' === $reference && '' === $capture ) {
		return '';
	}
	return trim( $reference . ' → ' . $capture );
}

/**
 * The stored reference image's own already-public URL
 * (includes/render.php's own $assets_url construction, reused identically)
 * — no separate thumbnail asset is generated or stored.
 */
function sameview_library_thumbnail_url( $session_id ) {
	$assets_dir = sameview_comparison_assets_dir( $session_id );
	if ( ! is_file( trailingslashit( $assets_dir ) . 'reference.jpg' ) ) {
		return '';
	}
	return trailingslashit( sameview_uploads_url() ) . md5( $session_id ) . '/reference.jpg';
}

/**
 * docs/IMPLEMENTATION_PLAN_V1.md Phase 18: "report only confirmed usages;
 * zero results means 'No placements found', never 'Not used'" — usage
 * discovery (includes/placements.php) is a reliable lower bound, never
 * proof of non-use.
 */
function sameview_library_usage_label( $placements ) {
	$count = count( $placements );
	if ( 0 === $count ) {
		return __( 'No placements found', 'sameview-comparisons' );
	}
	/* translators: %d: number of confirmed placements found. */
	return sprintf( _n( 'Used in %d place', 'Used in %d places', $count, 'sameview-comparisons' ), $count );
}

/**
 * docs/EMBED_IN_WEBSITE.md "Placement Behavior After Deletion": "If it has
 * active placements, deletion requires a clear warning and explicit
 * confirmation; where reliably available, the warning identifies the
 * affected placements." When none are found, the message is honest about
 * the limits of detection rather than implying deletion is provably safe.
 */
function sameview_library_delete_confirm_message( $title, $placements ) {
	if ( empty( $placements ) ) {
		return sprintf(
			/* translators: %s: Comparison title. */
			__( 'Delete "%s"? No placements were found, but it may still be used somewhere this check cannot see (for example inside a reusable block or a widget area). This cannot be undone.', 'sameview-comparisons' ),
			$title
		);
	}
	$titles = wp_list_pluck( $placements, 'title' );
	return sprintf(
		/* translators: 1: Comparison title, 2: comma-separated list of pages/posts using it. */
		__( 'Delete "%1$s"? It is currently used on: %2$s. This cannot be undone.', 'sameview-comparisons' ),
		$title,
		implode( ', ', $titles )
	);
}

function sameview_render_library_page() {
	if ( ! current_user_can( SAMEVIEW_CAPABILITY ) ) {
		wp_die( esc_html__( 'You do not have permission to manage SameView Comparisons.', 'sameview-comparisons' ) );
	}

	$status  = isset( $_GET['sameview_status'] ) ? sanitize_key( wp_unslash( $_GET['sameview_status'] ) ) : '';
	$message = isset( $_GET['sameview_message'] ) ? sanitize_text_field( wp_unslash( $_GET['sameview_message'] ) ) : '';

	echo '<div class="wrap"><h1>' . esc_html__( 'SameView Comparisons', 'sameview-comparisons' ) . '</h1>';

	if ( $status && $message ) {
		$notice_class = in_array( $status, array( 'deleted' ), true ) ? 'notice-success' : 'notice-error';
		echo '<div class="notice ' . esc_attr( $notice_class ) . '"><p>' . esc_html( $message ) . '</p></div>';
	}

	echo '<p><a href="' . esc_url( admin_url( 'tools.php?page=sameview-add-comparison' ) ) . '" class="page-title-action">' . esc_html__( 'Add comparison', 'sameview-comparisons' ) . '</a></p>';

	$posts = get_posts(
		array(
			'post_type'      => SAMEVIEW_POST_TYPE,
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'orderby'        => 'modified',
			'order'          => 'DESC',
		)
	);

	if ( empty( $posts ) ) {
		echo '<p>' . esc_html__( 'No Comparisons yet.', 'sameview-comparisons' ) . '</p></div>';
		return;
	}

	echo '<table class="wp-list-table widefat fixed striped" data-testid="sameview-library-table"><thead><tr>';
	echo '<th>' . esc_html__( 'Comparison', 'sameview-comparisons' ) . '</th>';
	echo '<th>' . esc_html__( 'Reference → capture', 'sameview-comparisons' ) . '</th>';
	echo '<th>' . esc_html__( 'Usage', 'sameview-comparisons' ) . '</th>';
	echo '<th>' . esc_html__( 'Actions', 'sameview-comparisons' ) . '</th>';
	echo '</tr></thead><tbody>';

	foreach ( $posts as $post ) {
		$session_id    = get_post_meta( $post->ID, SAMEVIEW_META_SESSION_ID, true );
		$manifest_json = get_post_meta( $post->ID, SAMEVIEW_META_MANIFEST, true );
		$manifest      = json_decode( (string) $manifest_json, true );
		$manifest      = is_array( $manifest ) ? $manifest : array();

		$placements    = $session_id ? sameview_find_placements( $session_id ) : array();
		$thumbnail_url = $session_id ? sameview_library_thumbnail_url( $session_id ) : '';
		$period        = sameview_library_period_label( $manifest );
		$title         = $post->post_title ? $post->post_title : __( '(no title)', 'sameview-comparisons' );

		$delete_url = wp_nonce_url(
			add_query_arg(
				array(
					'action'  => SAMEVIEW_DELETE_COMPARISON_ACTION,
					'post_id' => $post->ID,
				),
				admin_url( 'admin-post.php' )
			),
			SAMEVIEW_DELETE_COMPARISON_ACTION . '_' . $post->ID
		);
		$confirm_message = sameview_library_delete_confirm_message( $title, $placements );

		echo '<tr data-testid="sameview-library-row">';
		echo '<td>';
		if ( $thumbnail_url ) {
			echo '<img src="' . esc_url( $thumbnail_url ) . '" alt="" style="width:64px;height:64px;object-fit:cover;vertical-align:middle;margin-right:8px;">';
		}
		echo esc_html( $title );
		echo '</td>';
		echo '<td>' . esc_html( $period ) . '</td>';
		echo '<td data-testid="sameview-library-usage">' . esc_html( sameview_library_usage_label( $placements ) ) . '</td>';
		echo '<td><a href="' . esc_url( $delete_url ) . '" class="submitdelete" data-testid="sameview-library-delete" onclick="return confirm(' . esc_attr( wp_json_encode( $confirm_message ) ) . ');">' . esc_html__( 'Delete', 'sameview-comparisons' ) . '</a></td>';
		echo '</tr>';
	}

	echo '</tbody></table></div>';
}

function sameview_handle_delete_comparison() {
	if ( ! isset( $_GET['post_id'] ) ) {
		wp_die( esc_html__( 'Missing Comparison.', 'sameview-comparisons' ) );
	}
	$post_id = (int) $_GET['post_id'];

	if (
		! isset( $_GET['_wpnonce'] )
		|| ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), SAMEVIEW_DELETE_COMPARISON_ACTION . '_' . $post_id )
	) {
		wp_die( esc_html__( 'Security check failed.', 'sameview-comparisons' ) );
	}
	if ( ! current_user_can( SAMEVIEW_CAPABILITY ) ) {
		wp_die( esc_html__( 'You do not have permission to manage SameView Comparisons.', 'sameview-comparisons' ) );
	}

	$post = get_post( $post_id );
	if ( ! $post || SAMEVIEW_POST_TYPE !== $post->post_type ) {
		sameview_library_redirect_with_result( 'error', __( 'Comparison not found.', 'sameview-comparisons' ) );
	}

	// docs/EMBED_IN_WEBSITE.md "Placement Behavior After Deletion": "Deleting
	// a Comparison does not automatically remove or rewrite its placements —
	// a placement retains its referenced session.id." Only the stored
	// Comparison post/meta and its own assets are removed here; placements
	// found by includes/placements.php are left exactly as they are, so a
	// later re-import under the same session.id makes them work again
	// automatically (includes/render.php resolves session.id at render
	// time, never a stored post ID).
	$session_id = get_post_meta( $post_id, SAMEVIEW_META_SESSION_ID, true );

	wp_delete_post( $post_id, true );
	if ( $session_id ) {
		sameview_delete_directory_recursive( sameview_comparison_assets_dir( $session_id ) );
	}

	sameview_library_redirect_with_result( 'deleted', __( 'Comparison deleted.', 'sameview-comparisons' ) );
}

function sameview_library_redirect_with_result( $status, $message ) {
	$url = add_query_arg(
		array(
			'page'             => 'sameview-comparisons',
			'sameview_status'  => $status,
			'sameview_message' => rawurlencode( $message ),
		),
		admin_url( 'tools.php' )
	);
	wp_safe_redirect( $url );
	exit;
}

add_action( 'admin_menu', 'sameview_register_library_menu' );
add_action( 'admin_post_' . SAMEVIEW_DELETE_COMPARISON_ACTION, 'sameview_handle_delete_comparison' );
