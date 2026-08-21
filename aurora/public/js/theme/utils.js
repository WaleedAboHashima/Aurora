/** Aurora — shared helpers. */

/** True when the user (or the theme setting) has asked for less motion. */
export function motion_off() {
	const root = document.documentElement;
	if (root.getAttribute("data-aurora-motion") === "off") return true;
	return (
		root.getAttribute("data-aurora-motion") !== "on" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/** Stamp `--aurora-i` on a node list so CSS can stagger by index. */
export function stamp_index(nodes, { start = 0, max = 24 } = {}) {
	Array.prototype.forEach.call(nodes, (node, i) => {
		node.style.setProperty("--aurora-i", String(Math.min(start + i, max)));
	});
}

/** requestAnimationFrame-throttled wrapper. */
export function raf_throttle(fn) {
	let queued = false;
	let last_args;
	return function (...args) {
		last_args = args;
		if (queued) return;
		queued = true;
		window.requestAnimationFrame(() => {
			queued = false;
			fn.apply(this, last_args);
		});
	};
}

export function debounce(fn, wait = 120) {
	let t;
	return function (...args) {
		clearTimeout(t);
		t = setTimeout(() => fn.apply(this, args), wait);
	};
}

/** Small inline icon set — keeps the theme independent of frappe's sprite. */
const ICONS = {
	sparkles: `<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/>`,
	sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
	moon: `<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>`,
	command: `<path d="M6 3a3 3 0 013 3v12a3 3 0 11-3-3h12a3 3 0 11-3 3V6a3 3 0 113 3H6a3 3 0 01-3-3z"/>`,
	search: `<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>`,
	arrow_up: `<path d="M12 19V5M5 12l7-7 7 7"/>`,
	close: `<path d="M18 6L6 18M6 6l12 12"/>`,
	chart: `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
};

export function icon(name, size = 18) {
	return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
		stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
		stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

/** Run `fn` once the desk has booted (or immediately if it already has). */
export function on_app_ready(fn) {
	if (window.frappe?.app) {
		fn();
		return;
	}
	$(document).on("app_ready", () => fn());
}
