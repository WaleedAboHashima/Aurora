/**
 * Aurora — appearance settings.
 *
 * Three layers, in priority order:
 *   1. the server copy   (frappe.boot.aurora_theme, saved per user in user
 *                         defaults) — so a user's theme follows them to any
 *                         browser or device;
 *   2. localStorage      — read synchronously at import time, before first
 *                         paint, so there is no flash while boot data loads;
 *   3. built-in defaults.
 *
 * Writes go to localStorage immediately and to the server debounced, so
 * dragging the hue slider repaints at 60fps without a request per frame.
 * Nothing here is shared between users: one person's accent is their own.
 */

const STORAGE_KEY = "aurora:settings";
const SAVE_METHOD = "aurora.api.save_theme";
const SAVE_DEBOUNCE = 700;

export const FEATURES = [
	{ key: "page_transitions", label: "Page transitions", hint: "Animate route changes" },
	{ key: "progress_bar", label: "Loading bar", hint: "Top progress indicator" },
	{ key: "ripple", label: "Click ripples", hint: "Touch feedback on buttons" },
	{ key: "reveal", label: "Staggered lists", hint: "Rows fade in as you scroll" },
	{ key: "tilt", label: "Card sheen", hint: "Cards light up under the cursor" },
	{ key: "counters", label: "Number count-up", hint: "Animate dashboard figures" },
	{ key: "condensed_header", label: "Condensing header", hint: "Header lifts on scroll" },
	{ key: "back_to_top", label: "Back to top", hint: "Scroll button with progress ring" },
	{ key: "toast_timers", label: "Toast timers", hint: "Show how long a message stays" },
	{ key: "save_pulse", label: "Save feedback", hint: "Pulse the status pill on save" },
	{ key: "palette", label: "Quick actions", hint: "Ctrl+Shift+K command palette" },
	{ key: "charts", label: "Chart theming", hint: "Recolour charts to your accent" },
	{ key: "cards", label: "Card styling", hint: "Accent edge, halo and hover lift" },
	{ key: "app_icons", label: "Tint app icons", hint: "Recolour app logos to your accent" },
	{ key: "dock_autohide", label: "Auto-hide dock", hint: "Retract these buttons until hovered" },
	{ key: "gradients", label: "Gradients", hint: "Off = flat accent on buttons, checkboxes" },
	{ key: "quicklook", label: "Quick Look", hint: "Hover to peek, Space to open" },
	{ key: "signin_entrance", label: "Sign-in entrance", hint: "Animate the way into the desk" },
];

const DEFAULT_FEATURES = FEATURES.reduce((acc, f) => ({ ...acc, [f.key]: true }), {});

const DEFAULTS = {
	hue: 256,
	sat: 84,
	custom_hex: "",
	custom_lightness: null,
	shape: "soft", // sharp | soft | round
	density: "cozy", // compact | cozy | roomy
	font: "system", // system | inter | rounded | custom
	font_custom: "", // family name used when font === "custom"
	motion: "on", // on | off
	ambient: "subtle", // off | subtle | vivid
	// where toasts fire: {top|bottom}-{left|center|right}
	toast_position: "bottom-right",
	features: { ...DEFAULT_FEATURES },
};

export const TOAST_POSITIONS = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
];

export const ACCENTS = [
	{ label: "Indigo", hue: 256 },
	{ label: "Violet", hue: 282 },
	{ label: "Fuchsia", hue: 316 },
	{ label: "Rose", hue: 346 },
	{ label: "Amber", hue: 32 },
	{ label: "Emerald", hue: 158 },
	{ label: "Teal", hue: 186 },
	{ label: "Ocean", hue: 212 },
];

let state = { ...DEFAULTS, features: { ...DEFAULT_FEATURES } };
let save_timer = null;

function merge(base, patch) {
	if (!patch || typeof patch !== "object") return base;
	return {
		...base,
		...patch,
		features: { ...base.features, ...(patch.features || {}) },
	};
}

function migrate(saved) {
	// `backdrop: true|false` became `ambient: off|subtle|vivid`
	if (saved && typeof saved.backdrop === "boolean" && !saved.ambient) {
		saved = { ...saved, ambient: saved.backdrop ? "subtle" : "off" };
		delete saved.backdrop;
	}
	return saved;
}

function read_local() {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw) state = merge(state, migrate(JSON.parse(raw)));
	} catch (e) {
		// private mode or a corrupt value — defaults are a fine outcome
	}
}

function write_local() {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		/* non-fatal */
	}
}

function write_server() {
	clearTimeout(save_timer);
	save_timer = setTimeout(() => {
		if (!window.frappe?.xcall || frappe.session?.user === "Guest") return;
		frappe.xcall(SAVE_METHOD, { settings: JSON.stringify(state) }).catch(() => {
			// offline, or the app isn't installed on this site — the local copy stands
		});
	}, SAVE_DEBOUNCE);
}

export function get() {
	return { ...state, features: { ...state.features } };
}

export function feature(key) {
	return state.features[key] !== false;
}

export function apply() {
	const root = document.documentElement;
	if (!root) return;

	root.style.setProperty("--aurora-h", String(state.hue));
	root.style.setProperty("--aurora-s", `${state.sat}%`);
	if (state.custom_lightness !== undefined && state.custom_lightness !== null) {
		root.style.setProperty("--aurora-l", `${state.custom_lightness}%`);
	} else {
		root.style.removeProperty("--aurora-l");
	}
	root.setAttribute("data-aurora-shape", state.shape);
	root.setAttribute("data-aurora-density", state.density);
	root.setAttribute("data-aurora-font", state.font);
	// quoted so multi-word family names stay one token in the stack
	root.style.setProperty(
		"--aurora-font-custom",
		state.font_custom ? `"${String(state.font_custom).replace(/"/g, "")}"` : ""
	);
	root.setAttribute("data-aurora-motion", state.motion);
	root.setAttribute("data-aurora-ambient", state.ambient);
	// guard against a stale or hand-edited value reaching CSS as a broken corner
	root.setAttribute(
		"data-aurora-toast-pos",
		TOAST_POSITIONS.includes(state.toast_position)
			? state.toast_position
			: DEFAULTS.toast_position
	);

	// expose feature flags to CSS too, for the parts that are pure style
	FEATURES.forEach(({ key }) => {
		root.setAttribute(`data-aurora-${key.replace(/_/g, "-")}`, feature(key) ? "1" : "0");
	});

	document.dispatchEvent(new CustomEvent("aurora:settings", { detail: get() }));
}

export function set(patch, { persist = true, sync = true } = {}) {
	state = merge(state, patch);
	if (persist) write_local();
	if (persist && sync) write_server();
	apply();
	return get();
}

export function set_feature(key, on) {
	return set({ features: { [key]: !!on } });
}

export function reset() {
	state = { ...DEFAULTS, features: { ...DEFAULT_FEATURES } };
	write_local();
	write_server();
	apply();
	return get();
}

/**
 * Pull the server copy once the desk has booted. The local copy has already
 * painted, so this only matters when the user last changed their theme
 * somewhere else — hence the shallow comparison before repainting.
 */
export function hydrate_from_boot() {
	const remote = migrate(window.frappe?.boot?.aurora_theme);
	if (!remote || !Object.keys(remote).length) {
		// nothing saved server-side yet: push what this browser has, so the
		// user's current look becomes their account-wide look
		write_server();
		return;
	}

	const before = JSON.stringify(state);
	state = merge(state, remote);
	if (JSON.stringify(state) !== before) {
		write_local();
		apply();
	}
}

/**
 * Colour mode stays frappe's concern — we drive it through the same API the
 * core theme switcher uses, so the choice is saved on the User record and the
 * core switcher and this panel never disagree.
 */
export function get_mode() {
	return document.documentElement.getAttribute("data-theme-mode") || "light";
}

export function set_mode(mode) {
	const root = document.documentElement;
	root.setAttribute("data-theme-mode", mode);

	if (window.frappe?.ui?.set_theme) {
		frappe.ui.set_theme(mode === "automatic" ? undefined : mode);
	} else {
		root.setAttribute("data-theme", mode);
	}

	if (window.frappe?.xcall && frappe.session?.user !== "Guest") {
		const title = mode.charAt(0).toUpperCase() + mode.slice(1);
		frappe
			.xcall("frappe.core.doctype.user.user.switch_theme", { theme: title })
			.catch(() => {});
	}
	document.dispatchEvent(new CustomEvent("aurora:mode", { detail: mode }));
	return mode;
}

// applied as early as the bundle is parsed, i.e. before first paint
read_local();
apply();
