/**
 * Aurora — back to top.
 *
 * A single pill that doubles as a read-position indicator: the conic-gradient
 * ring around it fills as you move down the page.
 */
import { icon, raf_throttle } from "./utils";

let el = null;

function scroller() {
	return document.querySelector(".layout-main-section-wrapper:not(.disable-scrolling)");
}

function metrics() {
	const wrapper = scroller();
	if (wrapper && wrapper.scrollHeight > wrapper.clientHeight + 40) {
		return {
			node: wrapper,
			top: wrapper.scrollTop,
			max: wrapper.scrollHeight - wrapper.clientHeight,
		};
	}
	const doc = document.documentElement;
	return {
		node: window,
		top: window.scrollY || doc.scrollTop || 0,
		max: Math.max(1, doc.scrollHeight - window.innerHeight),
	};
}

const update = raf_throttle(() => {
	if (!el) return;
	const { top, max } = metrics();
	el.classList.toggle("visible", top > 320);
	el.style.setProperty("--aurora-scroll", String(Math.min(1, top / max)));
});

function to_top() {
	const { node } = metrics();
	const options = { top: 0, behavior: "smooth" };
	node === window ? window.scrollTo(options) : node.scrollTo(options);
}

export function init() {
	el = document.createElement("button");
	el.className = "aurora-to-top";
	el.type = "button";
	el.setAttribute("aria-label", "Back to top");
	el.innerHTML = `<span class="aurora-to-top-ring"></span>${icon("arrow_up", 17)}`;
	el.addEventListener("click", to_top);
	document.body.appendChild(el);

	window.addEventListener("scroll", update, { passive: true });
	document.addEventListener("scroll", update, { passive: true, capture: true });
	$(document).on("page-change", update);
	update();
}
