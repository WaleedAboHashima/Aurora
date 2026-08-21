/**
 * Aurora — material-style ripple on click.
 *
 * Delegated from document so it covers buttons rendered at any point, including
 * inside dialogs and dynamically built toolbars.
 */
import { motion_off } from "./utils";

const SELECTOR = [
	".btn",
	".aurora-dock-btn",
	".sidebar-item-container .item-anchor",
	".dropdown-item",
	".widget.shortcut-widget-box",
	".point-of-sale-app .item-wrapper",
	".point-of-sale-app .numpad-btn",
].join(",");

function spawn(event) {
	if (motion_off()) return;

	const target = event.target.closest(SELECTOR);
	if (!target || target.disabled || target.classList.contains("disabled")) return;

	// the host needs a stacking/clipping context
	const style = window.getComputedStyle(target);
	if (style.position === "static") target.style.position = "relative";
	if (style.overflow === "visible") target.style.overflow = "hidden";

	const rect = target.getBoundingClientRect();
	const size = Math.max(rect.width, rect.height);
	const ripple = document.createElement("span");
	ripple.className = "aurora-ripple";
	ripple.style.width = ripple.style.height = `${size}px`;
	ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
	ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

	target.appendChild(ripple);
	ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
	// belt and braces in case the animation never fires
	setTimeout(() => ripple.remove(), 900);
}

export function init() {
	document.addEventListener("pointerdown", spawn, { passive: true });
}
