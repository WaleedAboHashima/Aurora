/**
 * Aurora — theme entry point.
 *
 * Modules are declared with the feature flag that controls them, so the
 * Appearance panel's toggles are the single source of truth: a feature switched
 * off is never initialised at all (not merely hidden), and switching it back on
 * starts it without a reload.
 *
 * Each init is isolated — if one module throws because a future frappe release
 * renames a class, the rest of the theme, and the app itself, carry on.
 */
import * as settings from "./settings"; // side effect: applies saved settings
import * as backdrop from "./backdrop";
import * as progress from "./progress";
import * as transitions from "./transitions";
import * as ripple from "./ripple";
import * as reveal from "./reveal";
import * as tilt from "./tilt";
import * as counters from "./counters";
import * as page_head from "./page_head";
import * as scroll_top from "./scroll_top";
import * as toasts from "./toasts";
import * as recents from "./recents";
import * as palette from "./palette";
import * as dock from "./dock";
import * as form_feedback from "./form_feedback";
import * as desktop from "./desktop";
import * as charts from "./charts";
import * as quicklook from "./quicklook";
import * as entrance from "./entrance";
import { on_app_ready } from "./utils";

/* [name, module, feature flag | null for always-on] */
const MODULES = [
	// first, so the curtain is up before anything else starts animating
	["entrance", entrance, "signin_entrance"],
	["backdrop", backdrop, null], // reads the `backdrop` setting itself
	["recents", recents, null], // feeds the palette, costs nothing
	["dock", dock, null], // the panel must always be reachable
	["progress", progress, "progress_bar"],
	["transitions", transitions, "page_transitions"],
	["ripple", ripple, "ripple"],
	["reveal", reveal, "reveal"],
	["tilt", tilt, "tilt"],
	["counters", counters, "counters"],
	["page_head", page_head, "condensed_header"],
	["scroll_top", scroll_top, "back_to_top"],
	["toasts", toasts, "toast_timers"],
	["form_feedback", form_feedback, "save_pulse"],
	["palette", palette, "palette"],
	["desktop", desktop, null], // checks its own flags per effect
	["charts", charts, null], // patches frappe.Chart; checks the flag per chart
	["quicklook", quicklook, "quicklook"],
];

const started = new Set();

function start(name, mod) {
	if (started.has(name)) return;
	started.add(name);
	try {
		mod.init();
	} catch (e) {
		console.error(`[aurora] ${name} failed to start`, e);
	}
}

function sync_modules() {
	MODULES.forEach(([name, mod, flag]) => {
		if (flag && !settings.feature(flag)) return;
		start(name, mod);
	});
}

function boot() {
	sync_modules();

	// pull this user's saved theme once boot data is available, in case they
	// last changed it in another browser
	try {
		settings.hydrate_from_boot();
	} catch (e) {
		console.error("[aurora] could not read saved theme", e);
	}

	// a feature switched back on should start immediately, without a reload
	document.addEventListener("aurora:settings", sync_modules);

	document.documentElement.classList.add("aurora-ready");
}

// console handle, and a small API for other custom apps to build on
window.aurora = {
	settings,
	palette,
	dock,
	version: "1.1.0",
};

$(document).ready(() => {
	// the desk boots asynchronously; the website/portal has no frappe.app at all
	if (document.body.classList.contains("no-desk") || !window.frappe?.start_app) {
		boot();
		return;
	}
	on_app_ready(boot);
});
