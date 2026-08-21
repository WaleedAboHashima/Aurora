/**
 * Aurora — toast enhancements.
 *
 * frappe.show_alert() drops a `.desk-alert` into #alert-container and removes
 * it after `seconds`, adding `.out` on the way. It never records the lifetime
 * anywhere we can read, so we wrap the function to stamp it on the element and
 * then add a draining timer bar — the user can see how long they have to act.
 */
import { motion_off } from "./utils";

function decorate($div, seconds) {
	const node = $div && $div[0];
	if (!node || node.querySelector(".aurora-toast-timer")) return;

	node.style.setProperty("--aurora-toast-life", `${seconds}s`);
	if (window.getComputedStyle(node).position === "static") {
		node.style.position = "relative";
	}

	const timer = document.createElement("div");
	timer.className = "aurora-toast-timer";
	node.appendChild(timer);
}

export function init() {
	if (!window.frappe?.show_alert || frappe.show_alert.__aurora) return;

	const original = frappe.show_alert;

	function wrapped(message, seconds = 7, actions = {}) {
		const $div = original.call(this, message, seconds, actions);
		if (!motion_off()) {
			// frappe shaves 0.8s off anything longer than 2s for its exit animation
			const life = seconds > 2 ? seconds - 0.8 : seconds;
			try {
				decorate($div, life);
			} catch (e) {
				/* never let a decoration break a notification */
			}
		}
		return $div;
	}
	wrapped.__aurora = true;

	frappe.show_alert = wrapped;
	frappe.toast = wrapped;
}
