/**
 * Aurora — save feedback.
 *
 * Frappe's only signal that a save landed is the small status pill quietly
 * changing text. We watch that pill and pulse it, so the confirmation is
 * noticeable without adding another toast to the pile.
 *
 * DOM-only on purpose: no core form method is patched, so nothing here can
 * interfere with the save itself.
 */
import { motion_off } from "./utils";

const DIRTY = ["not saved", "not amended"];

function watch(pill) {
	if (pill.dataset.auroraWatched) return;
	pill.dataset.auroraWatched = "1";

	let was_dirty = DIRTY.includes(pill.textContent.trim().toLowerCase());

	new MutationObserver(() => {
		const text = pill.textContent.trim().toLowerCase();
		const dirty = DIRTY.includes(text);

		if (was_dirty && !dirty && !motion_off()) {
			pill.classList.remove("aurora-saved");
			void pill.offsetWidth; // restart the animation
			pill.classList.add("aurora-saved");
		}
		was_dirty = dirty;
	}).observe(pill, { childList: true, characterData: true, subtree: true });
}

function scan() {
	document.querySelectorAll(".page-indicator-pill").forEach(watch);
}

export function init() {
	new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
	$(document).on("page-change", scan);
	scan();
}
