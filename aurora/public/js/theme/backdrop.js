/**
 * Aurora — ambient colour.
 *
 * The canvas wash itself is pure CSS: it lives on the root element's background
 * (see scss/theme/_base.scss), gated by `data-aurora-ambient`, so it needs no
 * element and cannot be seamed by an opaque container.
 *
 * This module owns only the "vivid" over-layer, which has to be a real element
 * because it BLENDS with the painted UI above it — something a canvas
 * background cannot do. It is decorative, pointer-events: none, and never
 * mounted when motion is off or ambient is not set to "vivid".
 */
import { get } from "./settings";
import { motion_off } from "./utils";

let over = null;

function sync() {
	const wanted = get().ambient === "vivid" && !motion_off();

	if (wanted && !over) {
		over = document.createElement("div");
		over.className = "aurora-backdrop-over";
		over.setAttribute("aria-hidden", "true");
		document.body.appendChild(over);
	} else if (!wanted && over) {
		over.remove();
		over = null;
	}
}

export function init() {
	sync();
	document.addEventListener("aurora:settings", sync);
	document.addEventListener("aurora:mode", sync);
}
