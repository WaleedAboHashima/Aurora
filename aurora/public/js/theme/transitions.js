/**
 * Aurora — route transitions.
 *
 * frappe.views.Container.change_to() simply .show()s the incoming page div and
 * .hide()s the outgoing one. We re-trigger a CSS animation on whichever page
 * became visible, and pick a direction based on whether the user went back.
 */
import { motion_off } from "./utils";

let went_back = false;

function animate_current() {
	if (motion_off()) return;

	const page = document.querySelector(".page-container:not([style*='display: none'])");
	if (!page) return;

	const cls = went_back ? "aurora-page-enter-back" : "aurora-page-enter";
	went_back = false;

	page.classList.remove("aurora-page-enter", "aurora-page-enter-back");
	// force a reflow so the animation restarts even on the same node
	void page.offsetWidth;
	page.classList.add(cls);

	page.addEventListener(
		"animationend",
		() => page.classList.remove(cls),
		{ once: true }
	);
}

export function init() {
	window.addEventListener("popstate", () => {
		went_back = true;
	});
	$(document).on("page-change", animate_current);
}
