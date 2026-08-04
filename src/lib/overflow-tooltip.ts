// Framework-independent Overflow Tooltip interaction
// (docs/COMPARISON_PRESENTATION.md Part 2 "Overflow Tooltip"; Part 1
// "Interaction Parity": "Presentation interaction is defined once, by the
// presentation model. It is never redefined separately by an individual
// output type"). Deliberately has no dependency on React, on
// src/components/WorkspaceActive.tsx, on the Current Working State, on
// import/export code, on translations, or on any other application-specific
// concern — only the shared `data-overflow-tooltip` markup attribute
// contract below and standard DOM APIs. This is what makes it reusable
// unchanged by a future Output Preview, Standalone HTML export or Microsite
// renderer: each of them only needs to call
// `attachPresentationOverflowTooltips` once on its own root, once its own
// markup (carrying the same attribute) exists — no second implementation.
//
// React's only responsibility (src/components/ComparisonPresentationInfo.tsx)
// is rendering that markup contract and calling/cleaning up this function
// once. Every dynamic behavior after that point — measuring, opening,
// closing, repositioning — is owned entirely by this module, reacting to
// real DOM mutations rather than to React re-renders, exactly like a plain
// script would in a static HTML document with no framework at all.
//
// Markup contract: any element carrying the boolean attribute
// `data-overflow-tooltip` becomes a trigger. Its own already-rendered text
// content is the tooltip's content — no separate/duplicated text attribute
// exists. Whether it is checked as single-line (`scrollWidth`/`clientWidth`)
// or multi-line (`scrollHeight`/`clientHeight`) is read directly from its
// own computed `white-space` value, not from a second attribute that could
// drift out of sync with the actual CSS truncation mechanism.

import {
	computeTooltipPlacement,
	type Rect,
} from "./overflow-tooltip-geometry";

const TRIGGER_SELECTOR = "[data-overflow-tooltip]";
const TOOLTIP_CLASS = "presentation-tooltip";

// docs/COMPARISON_PRESENTATION.md "Overflow Tooltip": "only while the
// renderer genuinely cannot display the item's complete text" — a small
// tolerance absorbs sub-pixel layout rounding without ever creating a false
// positive from an item that is, for all practical purposes, fully visible.
const TRUNCATION_TOLERANCE_PX = 1;

// A small, fixed margin kept clear of every viewport edge, and the small
// gap kept between the trigger and the tooltip itself.
const VIEWPORT_INSET_PX = 8;
const TRIGGER_GAP_PX = 6;

function isSingleLineTrigger(element: HTMLElement): boolean {
	return getComputedStyle(element).whiteSpace === "nowrap";
}

function isElementTruncated(element: HTMLElement): boolean {
	if (isSingleLineTrigger(element)) {
		return element.scrollWidth > element.clientWidth + TRUNCATION_TOLERANCE_PX;
	}
	return element.scrollHeight > element.clientHeight + TRUNCATION_TOLERANCE_PX;
}

function toRect(domRect: DOMRect): Rect {
	return {
		top: domRect.top,
		left: domRect.left,
		right: domRect.right,
		bottom: domRect.bottom,
		width: domRect.width,
		height: domRect.height,
	};
}

interface TriggerState {
	isTruncated: boolean;
	isOpen: boolean;
	// Captured on `pointerdown`, read on the same tap's `pointerup` — see
	// `handlePointerUp` below for why this single snapshot is what
	// prevents one tap from opening (via the `focus` that same tap
	// produces) and immediately closing the tooltip again.
	wasOpenAtPointerDown: boolean;
	resizeObserver: ResizeObserver;
	mutationObserver: MutationObserver;
}

// docs/COMPARISON_PRESENTATION.md "Overflow Tooltip" positioning: "no
// concrete size is defined here" — every call site measures the tooltip's
// real, already-rendered bounding box before positioning it; no size is
// ever estimated.
export function attachPresentationOverflowTooltips(
	root: ParentNode,
): () => void {
	if (typeof document === "undefined") return () => {};

	const triggers = new Map<HTMLElement, TriggerState>();
	let openElement: HTMLElement | null = null;
	let tooltip: HTMLDivElement | null = null;
	let repositionListenersAttached = false;

	function ensureTooltipElement(): HTMLDivElement {
		if (tooltip) return tooltip;
		const element = document.createElement("div");
		element.className = TOOLTIP_CLASS;
		element.dataset.testid = "presentation-overflow-tooltip";
		// The affected item's own trigger element already carries its
		// complete, unclamped text content — this visual bubble only ever
		// repeats that same text, so it is hidden from assistive technology
		// rather than announced a second time (docs/COMPARISON_PRESENTATION.md
		// "Overflow Tooltip": "never causes the same text to be announced
		// twice"). No `role="tooltip"` is added on purpose: that role would
		// claim an accessible presence this element deliberately does not
		// have.
		element.setAttribute("aria-hidden", "true");
		element.hidden = true;
		document.body.appendChild(element);
		tooltip = element;
		return element;
	}

	function positionTooltip(
		triggerElement: HTMLElement,
		tooltipElement: HTMLDivElement,
	) {
		const placement = computeTooltipPlacement(
			toRect(triggerElement.getBoundingClientRect()),
			toRect(tooltipElement.getBoundingClientRect()),
			{ width: window.innerWidth, height: window.innerHeight },
			VIEWPORT_INSET_PX,
			TRIGGER_GAP_PX,
		);
		tooltipElement.style.top = `${placement.top}px`;
		tooltipElement.style.left = `${placement.left}px`;
	}

	function reposition() {
		if (!openElement || !tooltip) return;
		positionTooltip(openElement, tooltip);
	}

	function attachRepositionListeners() {
		if (repositionListenersAttached) return;
		window.addEventListener("resize", reposition);
		// `capture: true` — `scroll` does not bubble, but this still needs
		// to react to a nested scroll container (not only `window` itself)
		// scrolling while a tooltip is open.
		window.addEventListener("scroll", reposition, true);
		repositionListenersAttached = true;
	}

	function detachRepositionListeners() {
		if (!repositionListenersAttached) return;
		window.removeEventListener("resize", reposition);
		window.removeEventListener("scroll", reposition, true);
		repositionListenersAttached = false;
	}

	function openTooltip(triggerElement: HTMLElement) {
		const state = triggers.get(triggerElement);
		if (!state?.isTruncated) return;
		if (openElement === triggerElement && state.isOpen) return;
		if (openElement && openElement !== triggerElement) {
			closeTooltip(openElement);
		}

		const tooltipElement = ensureTooltipElement();
		tooltipElement.dataset.overflowTooltipFor =
			triggerElement.getAttribute("data-testid") ?? "";
		// Step order (docs/COMPARISON_PRESENTATION.md "Overflow Tooltip"
		// positioning requirement): set the real content and make the node
		// measurable first, still invisible; only then measure its real
		// bounding box and compute the final position; only after that is
		// applied does it become visible.
		tooltipElement.textContent = triggerElement.textContent ?? "";
		tooltipElement.style.visibility = "hidden";
		tooltipElement.hidden = false;
		positionTooltip(triggerElement, tooltipElement);
		tooltipElement.style.visibility = "visible";

		openElement = triggerElement;
		state.isOpen = true;
		attachRepositionListeners();
	}

	function closeTooltip(triggerElement: HTMLElement) {
		const state = triggers.get(triggerElement);
		if (state) state.isOpen = false;
		if (openElement !== triggerElement) return;
		openElement = null;
		if (tooltip) {
			tooltip.hidden = true;
			tooltip.style.removeProperty("visibility");
		}
		detachRepositionListeners();
	}

	function handleMouseEnter(event: MouseEvent) {
		openTooltip(event.currentTarget as HTMLElement);
	}
	function handleMouseLeave(event: MouseEvent) {
		closeTooltip(event.currentTarget as HTMLElement);
	}
	function handleFocus(event: FocusEvent) {
		openTooltip(event.currentTarget as HTMLElement);
	}
	function handleBlur(event: FocusEvent) {
		closeTooltip(event.currentTarget as HTMLElement);
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key !== "Escape") return;
		// "Escape closes an open tooltip without moving focus away from the
		// item" — closes only the visual bubble, never calls `.blur()`.
		closeTooltip(event.currentTarget as HTMLElement);
	}
	function handlePointerDown(event: PointerEvent) {
		if (event.pointerType !== "touch") return;
		const state = triggers.get(event.currentTarget as HTMLElement);
		if (!state) return;
		state.wasOpenAtPointerDown = state.isOpen;
	}
	function handlePointerUp(event: PointerEvent) {
		if (event.pointerType !== "touch") return;
		const element = event.currentTarget as HTMLElement;
		const state = triggers.get(element);
		if (!state) return;
		// `wasOpenAtPointerDown`, captured on `pointerdown` before this same
		// tap can change anything, distinguishes a first tap (opens) from a
		// further, later tap on an already-open trigger (closes). Opening
		// calls `element.focus()` explicitly rather than relying on the
		// browser's own default tap-to-focus behavior — deterministic
		// across touch browsers, and it naturally opens the tooltip through
		// the same `focus` handler keyboard users already go through, so
		// there is exactly one code path that opens it, not two.
		if (state.wasOpenAtPointerDown) {
			closeTooltip(element);
		} else if (state.isTruncated) {
			element.focus();
		}
	}

	function handleDocumentPointerDown(event: PointerEvent) {
		if (!openElement) return;
		const target = event.target;
		if (target instanceof Node) {
			// Neither the trigger itself (its own pointerup/focus handlers
			// own that decision) nor the tooltip bubble itself (its content
			// may need to be scrolled — see the "extremely long content"
			// case in global.css — a tap starting a scroll gesture inside
			// it must not immediately close it) count as "outside".
			if (openElement.contains(target)) return;
			if (tooltip?.contains(target)) return;
		}
		closeTooltip(openElement);
	}

	function evaluateTrigger(element: HTMLElement) {
		const state = triggers.get(element);
		if (!state) return;
		const truncated = isElementTruncated(element);
		if (truncated === state.isTruncated) return;
		state.isTruncated = truncated;
		if (truncated) {
			element.tabIndex = 0;
		} else {
			// docs/COMPARISON_PRESENTATION.md "Overflow Tooltip": "If a
			// previously truncated item becomes fully visible … its
			// Overflow Tooltip closes and stops being available."
			element.removeAttribute("tabindex");
			if (state.isOpen) closeTooltip(element);
		}
	}

	function setupTrigger(element: HTMLElement) {
		if (triggers.has(element)) return;

		const resizeObserver = new ResizeObserver(() => evaluateTrigger(element));
		resizeObserver.observe(element);

		// `ResizeObserver` alone does not fire when only the element's text
		// content changes without its own box size changing (e.g. editing
		// replaces a truncated value with an equally long one) — this
		// observer covers exactly that gap, and also the Standard/Compact
		// class swap as a second, redundant signal alongside the resulting
		// height change `ResizeObserver` already reports.
		const mutationObserver = new MutationObserver(() =>
			evaluateTrigger(element),
		);
		mutationObserver.observe(element, {
			characterData: true,
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});

		const state: TriggerState = {
			isTruncated: false,
			isOpen: false,
			wasOpenAtPointerDown: false,
			resizeObserver,
			mutationObserver,
		};
		triggers.set(element, state);

		element.addEventListener("mouseenter", handleMouseEnter);
		element.addEventListener("mouseleave", handleMouseLeave);
		element.addEventListener("focus", handleFocus);
		element.addEventListener("blur", handleBlur);
		element.addEventListener("keydown", handleKeyDown);
		element.addEventListener("pointerdown", handlePointerDown);
		element.addEventListener("pointerup", handlePointerUp);

		evaluateTrigger(element);
	}

	function teardownTrigger(element: HTMLElement) {
		const state = triggers.get(element);
		if (!state) return;
		state.resizeObserver.disconnect();
		state.mutationObserver.disconnect();
		element.removeEventListener("mouseenter", handleMouseEnter);
		element.removeEventListener("mouseleave", handleMouseLeave);
		element.removeEventListener("focus", handleFocus);
		element.removeEventListener("blur", handleBlur);
		element.removeEventListener("keydown", handleKeyDown);
		element.removeEventListener("pointerdown", handlePointerDown);
		element.removeEventListener("pointerup", handlePointerUp);
		if (openElement === element) closeTooltip(element);
		triggers.delete(element);
	}

	// Picks up items appearing/disappearing later (docs/
	// COMPARISON_PRESENTATION.md "Overflow Tooltip" re-evaluation trigger
	// "visibility change") — e.g. Description toggling on/off entirely
	// removes/re-adds its trigger element.
	function scan() {
		const found = new Set(root.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR));
		for (const element of found) setupTrigger(element);
		for (const element of triggers.keys()) {
			if (!found.has(element)) teardownTrigger(element);
		}
	}

	scan();

	const rootObserver = new MutationObserver(scan);
	rootObserver.observe(root, { childList: true, subtree: true });

	document.addEventListener("pointerdown", handleDocumentPointerDown);

	// "Font-Ready" re-evaluation trigger: a no-op today (BRAND_GUIDE.md:
	// system font stack only, nothing to wait for) but kept for the
	// documented future case of a custom web font being introduced —
	// re-measuring after fonts settle is otherwise cheap and harmless.
	void document.fonts.ready.then(() => {
		for (const element of triggers.keys()) evaluateTrigger(element);
	});

	return function destroy() {
		rootObserver.disconnect();
		document.removeEventListener("pointerdown", handleDocumentPointerDown);
		detachRepositionListeners();
		for (const element of Array.from(triggers.keys())) {
			teardownTrigger(element);
		}
		if (tooltip) {
			tooltip.remove();
			tooltip = null;
		}
	};
}
