/**
 * Aurora — the Desktop launcher (/desk).
 *
 * The launcher is a frappe *page* (frappe/desk/page/desktop), rendered fresh
 * each time it is shown and re-rendered on every layout change, so this watches
 * its container rather than running once.
 *
 * Two jobs: cascade the app icons in, and condense the launcher's own navbar on
 * scroll the same way the desk page head does.
 */
import { feature } from "./settings";
import { motion_off, raf_throttle, debounce } from "./utils";

const GRID = ".desktop-wrapper .icons";

/** Give each icon its position so CSS can stagger the entrance. */
const animate_icons = debounce(() => {
	if (motion_off() || !feature("reveal")) return;

	document.querySelectorAll(GRID).forEach((grid) => {
		// a folder's inner grid is a thumbnail, not a screen full of apps
		if (grid.closest(".folder-icon")) return;

		const icons = Array.from(grid.children).filter((n) =>
			n.classList.contains("desktop-icon")
		);
		if (!icons.length) return;

		icons.forEach((el, i) => {
			if (el.dataset.auroraIn) return;
			el.dataset.auroraIn = "1";
			el.style.setProperty("--aurora-i", String(Math.min(i, 24)));
			el.classList.add("aurora-desk-in");
			el.addEventListener(
				"animationend",
				() => el.classList.remove("aurora-desk-in"),
				{ once: true }
			);
		});
	});
}, 40);

const condense = raf_throttle(() => {
	if (!feature("condensed_header")) return;
	const bar = document.querySelector(".desktop-wrapper .navbar-container");
	if (!bar) return;

	const scroller = document.querySelector(".desktop-wrapper")?.closest(".page-container");
	const offset = Math.max(window.scrollY || 0, scroller?.scrollTop || 0);
	bar.classList.toggle("aurora-condensed", offset > 12);
});

export function init() {
	// the launcher re-renders its grid in place on every update()
	new MutationObserver(() => {
		if (!document.querySelector(".desktop-wrapper")) return;
		animate_icons();
	}).observe(document.body, { childList: true, subtree: true });

	$(document).on("page-change", () => {
		animate_icons();
		condense();
	});

	window.addEventListener("scroll", condense, { passive: true });
	document.addEventListener("scroll", condense, { passive: true, capture: true });

	animate_icons();
}
