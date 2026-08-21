/**
 * Aurora — count-up for dashboard numbers.
 *
 * Number cards render their final value straight into `.number`. We keep the
 * formatting frappe produced (currency symbols, K/M shortening, locale
 * separators) and only animate the numeric part inside it, so nothing about the
 * displayed value changes once the animation lands.
 */
import { motion_off } from "./utils";

const DURATION = 900;
const NUMBER_RE = /-?[\d.,]+/;

function ease_out(t) {
	return 1 - Math.pow(1 - t, 3);
}

function count_up(el) {
	const text = el.textContent.trim();
	const match = text.match(NUMBER_RE);
	if (!match) return;

	const raw = match[0];
	// respect the locale separators already present in the string
	const decimal_sep = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
	const group_sep = decimal_sep === "," ? "." : ",";
	const numeric = parseFloat(
		raw.split(group_sep).join("").split(decimal_sep).join(".")
	);
	if (!isFinite(numeric) || Math.abs(numeric) < 1) return;

	const decimals = (raw.split(decimal_sep)[1] || "").length;
	const start = performance.now();
	el.classList.add("aurora-counting");

	function frame(now) {
		const t = Math.min(1, (now - start) / DURATION);
		const value = numeric * ease_out(t);
		const shown = value.toLocaleString(undefined, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
		el.textContent = text.replace(NUMBER_RE, shown);

		if (t < 1) {
			requestAnimationFrame(frame);
		} else {
			el.textContent = text; // restore the exact original string
			el.classList.remove("aurora-counting");
		}
	}
	requestAnimationFrame(frame);
}

export function init() {
	if (!("IntersectionObserver" in window)) return;

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				observer.unobserve(entry.target);
				count_up(entry.target);
			});
		},
		{ threshold: 0.4 }
	);

	const watch = () => {
		if (motion_off()) return;
		document
			.querySelectorAll(".widget.number-widget-box .number:not([data-aurora-counted])")
			.forEach((el) => {
				el.setAttribute("data-aurora-counted", "1");
				observer.observe(el);
			});
	};

	new MutationObserver(() => watch()).observe(document.body, {
		childList: true,
		subtree: true,
	});
	$(document).on("page-change", watch);
	watch();
}
