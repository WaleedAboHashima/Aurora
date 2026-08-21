/**
 * Aurora — condensing page header.
 *
 * The sticky `.page-head` gets a border and a shadow only once the content
 * beneath it has scrolled, so an unscrolled page reads as one clean surface.
 */
import { raf_throttle } from "./utils";

const THRESHOLD = 20;

function scroll_container() {
	// frappe scrolls the window on most views and a wrapper on list/report views
	return (
		document.querySelector(".layout-main-section-wrapper:not(.disable-scrolling)") || null
	);
}

const update = raf_throttle(() => {
	const wrapper = scroll_container();
	const offset = Math.max(
		window.scrollY || 0,
		wrapper ? wrapper.scrollTop || 0 : 0
	);
	document.querySelectorAll(".page-head").forEach((head) => {
		head.classList.toggle("aurora-condensed", offset > THRESHOLD);
	});
});

export function init() {
	window.addEventListener("scroll", update, { passive: true });
	document.addEventListener("scroll", update, { passive: true, capture: true });
	$(document).on("page-change", update);
	update();
}
