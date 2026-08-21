/**
 * Aurora — pointer-tracked sheen on cards.
 *
 * Writes the pointer position into --aurora-mx/--aurora-my so the widget's
 * ::after radial gradient follows the cursor. Cheap: two custom property writes
 * per frame, no layout, and it only runs while a card is actually hovered.
 */
import { raf_throttle, motion_off } from "./utils";

const SELECTOR = ".widget, .form-links .document-link, .plant-floor-container .workstation-card";

const move = raf_throttle((event) => {
	const card = event.target.closest(SELECTOR);
	if (!card) return;
	const rect = card.getBoundingClientRect();
	card.style.setProperty("--aurora-mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
	card.style.setProperty("--aurora-my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
});

export function init() {
	document.addEventListener(
		"pointermove",
		(event) => {
			if (motion_off()) return;
			move(event);
		},
		{ passive: true }
	);
}
