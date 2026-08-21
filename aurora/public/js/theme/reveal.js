/**
 * Aurora — staggered reveal.
 *
 * List rows, workspace widgets and timeline entries fade up in sequence as they
 * enter the viewport. One IntersectionObserver watches everything; a
 * MutationObserver picks up rows that frappe renders after the first paint
 * (infinite scroll, filter changes, refreshes).
 */
import { motion_off, debounce } from "./utils";

const TARGETS = [
	".frappe-list .list-row-container",
	".widget-group .widget",
	".new-timeline .timeline-item",
	".navbar-breadcrumbs li",
	".body-sidebar .sidebar-items > .sidebar-item-container",
];

let observer = null;

function reveal(entries) {
	entries.forEach((entry) => {
		if (!entry.isIntersecting) return;
		entry.target.classList.add("aurora-revealed");
		observer.unobserve(entry.target);
	});
}

/** Give each element its position within its own group for the stagger delay. */
function index_group(nodes) {
	nodes.forEach((node, i) => {
		node.style.setProperty("--aurora-i", String(Math.min(i, 14)));
	});
}

const scan = debounce(() => {
	if (motion_off() || !observer) return;

	TARGETS.forEach((selector) => {
		const nodes = Array.from(document.querySelectorAll(selector)).filter(
			(n) => !n.classList.contains("aurora-reveal")
		);
		if (!nodes.length) return;

		index_group(nodes);
		nodes.forEach((node) => {
			node.classList.add("aurora-reveal");
			observer.observe(node);
		});
	});
}, 60);

export function init() {
	if (!("IntersectionObserver" in window)) return;

	observer = new IntersectionObserver(reveal, {
		rootMargin: "0px 0px -6% 0px",
		threshold: 0.02,
	});

	const mutations = new MutationObserver(scan);
	mutations.observe(document.body, { childList: true, subtree: true });

	$(document).on("page-change", scan);
	scan();
}
