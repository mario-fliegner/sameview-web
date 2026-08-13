<?php
/**
 * Verification-only harness (docs/IMPLEMENTATION_PLAN_V1.md Phase 17) — NOT
 * part of the sameview-comparisons plugin, never packaged, never installed
 * on a real site. Mounted only into this isolated, disposable wp-env
 * instance's `wp-content/mu-plugins/` (see ../.wp-env.json), to simulate a
 * realistic, aggressively-styled WordPress theme for host-isolation
 * verification — deliberately not the sole proof (an `all: unset !important`
 * variant is available separately, behind a query param, per the approved
 * Phase 17 verification instructions: "do not make an unrealistic
 * `all: unset !important` rule the sole isolation proof").
 */

add_action(
	'wp_head',
	function () {
		if ( isset( $_GET['sameview_hostile_extreme'] ) ) {
			echo '<style id="sameview-test-hostile-extreme">*, *::before, *::after { all: unset !important; }</style>';
			return;
		}
		echo '<style id="sameview-test-hostile-realistic">
			* { box-sizing: content-box; margin: 4px; padding: 4px; }
			html { font-size: 20px; line-height: 2.4; }
			body { font-family: Georgia, serif; color: #c026d3; background: #fef08a; }
			img { max-width: 50%; height: auto; display: inline; border: 5px solid blue; filter: grayscale(1); }
			button { all: unset; cursor: pointer; background: #16a34a; color: #ffffff; padding: 12px; border-radius: 999px; font-weight: 900; }
			h1, h2, h3, p, span, div { font-family: "Comic Sans MS", cursive; color: #7e22ce; text-transform: uppercase; line-height: 3; }
			:root { --wp--preset--color--primary: hotpink; --sameview-hostile-probe: 1; }
		</style>';
	}
);
