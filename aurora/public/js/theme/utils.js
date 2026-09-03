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

/** Convert HSL hue (0..360) with standard sat=84% and lightness=60% to Hex string (#rrggbb) */
export function hue_to_hex(h, s = 84, l = 60) {
	h = (Number(h) || 0) % 360;
	if (h < 0) h += 360;
	const s_frac = s / 100;
	const l_frac = l / 100;
	const a = s_frac * Math.min(l_frac, 1 - l_frac);
	const f = (n) => {
		const k = (n + h / 30) % 12;
		const color = l_frac - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}

/** Get hex representation of current theme settings */
export function get_current_hex(s) {
	if (!s) return "#4f46e5";
	if (s.custom_hex) return s.custom_hex;
	return hue_to_hex(s.hue, s.sat ?? 84, s.custom_lightness ?? 60);
}

/** Convert Hex color string (#rrggbb, rrggbb, #rgb, rgb) or Hue string to color object (or null if invalid) */
export function parse_hue_or_hex(val) {
	if (val === null || val === undefined) return null;
	const trimmed = String(val).trim();
	if (!trimmed) return null;

	// Check if direct number (hue degree 0..360)
	if (/^\d+$/.test(trimmed)) {
		const num = parseInt(trimmed, 10);
		if (num >= 0 && num <= 360) {
			const res = {
				hue: num,
				sat: 84,
				custom_lightness: null,
				custom_hex: "",
				hex: hue_to_hex(num, 84, 60),
				valueOf() {
					return this.hue;
				},
			};
			return res;
		}
	}

	// Check if hex code
	let clean = trimmed.replace(/^#/, "");
	if (clean.length === 3) {
		clean = clean
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
		return null;
	}

	const formattedHex = `#${clean.toUpperCase()}`;
	const num = parseInt(clean, 16);
	const r = ((num >> 16) & 255) / 255;
	const g = ((num >> 8) & 255) / 255;
	const b = (num & 255) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;

	const lightness = (max + min) / 2;
	let sat = 0;
	if (d !== 0) {
		sat = lightness > 0.5 ? d / (2 - max - min) : d / (max + min);
	}

	let h = 0;
	if (d !== 0) {
		if (max === r) {
			h = ((g - b) / d) % 6;
		} else if (max === g) {
			h = (b - r) / d + 2;
		} else {
			h = (r - g) / d + 4;
		}
		h = Math.round(h * 60);
		if (h < 0) h += 360;
	}

	const res = {
		hue: h,
		sat: Math.round(sat * 100),
		custom_lightness: Math.round(lightness * 100),
		custom_hex: formattedHex,
		hex: formattedHex,
		valueOf() {
			return this.hue;
		},
	};
	return res;
}


