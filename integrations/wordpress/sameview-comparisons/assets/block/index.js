/**
 * The SameView block's editor registration (docs/IMPLEMENTATION_PLAN_V1.md
 * Phase 16; docs/WORDPRESS_INTEGRATION.md "Placement"). Hand-written vanilla
 * JavaScript against WordPress-provided global APIs only — no
 * `@wordpress/scripts`, no webpack, no JSX/build step
 * (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 Decision 73).
 *
 * A dynamic block: `save()` always returns `null`; `edit()` shows a
 * Comparison picker (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 Decision 74 —
 * `window.sameviewComparisonsBlockData.comparisons`, localized server-side
 * once per editor load by includes/block.php, never fetched via REST) and,
 * once a Comparison is selected, a genuinely interactive preview via
 * `ServerSideRender` — WordPress core's own real mechanism for a dynamic
 * block's editor preview, calling the exact same PHP render path
 * (includes/render.php `sameview_render_comparison_embed()`, via
 * includes/block.php's `render_callback`) the public frontend uses. No
 * second data path, no PHP rendering clone.
 *
 * `ServerSideRender`'s returned HTML embeds one
 * `[data-sameview-embed]` container per docs/IMPLEMENTATION_PLAN_V1.md Phase
 * 16's own shared JS renderer contract
 * (src/lib/comparison-embed-runtime-entry.ts, enqueued into the editor by
 * includes/block.php unconditionally so it is present in whichever document
 * the Block Editor renders block content into — the top-level admin document
 * or, for an iframed canvas, the iframe's own document). `ComparisonPreview`
 * below re-runs that shared runtime's own `mountAll()` against the correct
 * `ownerDocument` after every `ServerSideRender` update — a `MutationObserver`
 * is used rather than a plain effect because `ServerSideRender` fetches and
 * swaps its own content asynchronously, on a timeline independent of this
 * component's own render.
 */

( function () {
	var el = wp.element.createElement;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;
	var __ = wp.i18n.__;
	var registerBlockType = wp.blocks.registerBlockType;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var Placeholder = wp.components.Placeholder;
	var SelectControl = wp.components.SelectControl;
	var Notice = wp.components.Notice;
	var ServerSideRender = wp.serverSideRender;

	var comparisons =
		( window.sameviewComparisonsBlockData &&
			window.sameviewComparisonsBlockData.comparisons ) ||
		[];

	function findComparison( sessionId ) {
		for ( var i = 0; i < comparisons.length; i++ ) {
			if ( comparisons[ i ].sessionId === sessionId ) {
				return comparisons[ i ];
			}
		}
		return null;
	}

	function buildOptions() {
		var options = [
			{
				label: __( 'Select a Comparison…', 'sameview-comparisons' ),
				value: '',
			},
		];
		for ( var i = 0; i < comparisons.length; i++ ) {
			options.push( {
				label: comparisons[ i ].title,
				value: comparisons[ i ].sessionId,
			} );
		}
		return options;
	}

	var embedAssets =
		( window.sameviewComparisonsBlockData &&
			window.sameviewComparisonsBlockData.embedAssets ) ||
		null;

	// Confirmed empirically against a real `wp-env` instance: neither a
	// top-level `enqueue_block_editor_assets` script nor `ServerSideRender`'s
	// own response reaches the Block Editor's iframed canvas's own document —
	// only the editor's own top-level admin document. This loads the exact
	// same Embed runtime/CSS URLs includes/render.php's own frontend enqueue
	// uses (`sameview_embed_asset_urls()`) directly into `doc`, once, keyed by
	// the script/style's own handle-equivalent id so a second
	// `ComparisonPreview` instance on the same page never loads it twice.
	function ensureEmbedRuntimeLoaded( doc ) {
		var win = doc.defaultView;
		if ( win && win.SameViewComparisonEmbed ) {
			return Promise.resolve( win );
		}
		if ( ! embedAssets ) {
			return Promise.resolve( win );
		}
		var existing = doc.getElementById( 'sameview-comparisons-embed-js' );
		if ( existing ) {
			return new Promise( function ( resolve ) {
				existing.addEventListener( 'load', function () {
					resolve( doc.defaultView );
				} );
			} );
		}
		if ( ! doc.getElementById( 'sameview-comparisons-embed-css' ) ) {
			var link = doc.createElement( 'link' );
			link.id = 'sameview-comparisons-embed-css';
			link.rel = 'stylesheet';
			link.href = embedAssets.style;
			doc.head.appendChild( link );
		}
		return new Promise( function ( resolve ) {
			var script = doc.createElement( 'script' );
			script.id = 'sameview-comparisons-embed-js';
			script.src = embedAssets.script;
			script.addEventListener( 'load', function () {
				resolve( doc.defaultView );
			} );
			doc.head.appendChild( script );
		} );
	}

	function ComparisonPreview( props ) {
		var sessionId = props.sessionId;
		var wrapperRef = useRef( null );

		useEffect(
			function () {
				var node = wrapperRef.current;
				if ( ! node ) {
					return;
				}
				var doc = node.ownerDocument;
				var cancelled = false;

				function mount() {
					if ( cancelled ) {
						return;
					}
					var win = doc.defaultView;
					if ( win && win.SameViewComparisonEmbed ) {
						win.SameViewComparisonEmbed.mountAll( doc );
					}
				}

				var observer = new MutationObserver( mount );
				observer.observe( node, { childList: true, subtree: true } );
				ensureEmbedRuntimeLoaded( doc ).then( mount );

				return function () {
					cancelled = true;
					observer.disconnect();
				};
			},
			[ sessionId ]
		);

		return el(
			'div',
			{ ref: wrapperRef },
			el( ServerSideRender, {
				block: 'sameview/comparison',
				attributes: { sessionId: sessionId },
			} )
		);
	}

	registerBlockType( 'sameview/comparison', {
		edit: function ( editProps ) {
			var attributes = editProps.attributes;
			var setAttributes = editProps.setAttributes;
			var sessionId = attributes.sessionId;
			var blockProps = useBlockProps();
			var selected = sessionId ? findComparison( sessionId ) : null;
			var options = buildOptions();

			function onChange( value ) {
				setAttributes( { sessionId: value } );
			}

			if ( selected ) {
				return el(
					'div',
					blockProps,
					el( ComparisonPreview, { sessionId: sessionId } ),
					el( SelectControl, {
						label: __( 'Comparison', 'sameview-comparisons' ),
						value: sessionId,
						options: options,
						onChange: onChange,
						__next40pxDefaultSize: true,
					} )
				);
			}

			return el(
				'div',
				blockProps,
				el(
					Placeholder,
					{
						icon: 'images-alt2',
						label: __( 'SameView Comparison', 'sameview-comparisons' ),
						instructions: comparisons.length
							? __(
									'Select a Comparison to display.',
									'sameview-comparisons'
							  )
							: __(
									'No SameView Comparisons are available yet.',
									'sameview-comparisons'
							  ),
					},
					sessionId
						? el(
								Notice,
								{ status: 'warning', isDismissible: false },
								__(
									'This Comparison is no longer available. Choose another.',
									'sameview-comparisons'
								)
						  )
						: null,
					comparisons.length
						? el( SelectControl, {
								value: sessionId || '',
								options: options,
								onChange: onChange,
								__next40pxDefaultSize: true,
						  } )
						: null
				)
			);
		},
		save: function () {
			return null;
		},
	} );
} )();
