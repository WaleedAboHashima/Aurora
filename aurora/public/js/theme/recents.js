/**
 * Aurora — recently visited routes.
 *
 * Frappe tracks recent *documents* server-side, but not the route trail you
 * actually navigated. Keeping a short local trail makes "go back to that report
 * I had open" a one-keystroke operation in the palette.
 */
const KEY = "aurora:recents";
const LIMIT = 12;

let trail = [];

function load() {
	try {
		trail = JSON.parse(window.localStorage.getItem(KEY) || "[]");
	} catch (e) {
		trail = [];
	}
}

function save() {
	try {
		window.localStorage.setItem(KEY, JSON.stringify(trail.slice(0, LIMIT)));
	} catch (e) {
		/* non-fatal */
	}
}

function title_for(route) {
	// route is an array like ["List", "Sales Order"] or ["Form", "Item", "ITEM-1"]
	if (!route || !route.length) return "Home";
	const [view, doctype, name] = route;
	if (view === "Form") return `${doctype}: ${name}`;
	if (view === "List") return `${doctype} list`;
	if (view === "query-report") return `${doctype} (report)`;
	if (view === "workspace" || route.length === 1) {
		return frappe.utils.to_title_case((doctype || view).replace(/-/g, " "));
	}
	return route.map((r) => String(r)).join(" / ");
}

export function record() {
	const route = frappe.get_route?.();
	if (!route || !route.length) return;
	const key = route.join("/");

	trail = trail.filter((r) => r.key !== key);
	trail.unshift({
		key,
		route: route.slice(),
		label: title_for(route),
		at: Date.now(),
	});
	trail = trail.slice(0, LIMIT);
	save();
}

export function list() {
	return trail.slice();
}

export function init() {
	load();
	$(document).on("page-change", () => {
		try {
			record();
		} catch (e) {
			/* a bad route should never break navigation */
		}
	});
}
