/**
 * Aurora — chart rebranding.
 *
 * Every chart in frappe and ERPNext (dashboard charts, number-card sparklines,
 * report charts, workspace widgets) is constructed through `frappe.Chart`,
 * which is frappe's re-export of frappe-charts. That single choke point is a far
 * better place to theme than the library's own minified palette map.
 *
 * The rule we apply: if a chart has been given explicit colours — because
 * someone chose them on the Dashboard Chart doc — we leave them alone. Only
 * charts that would otherwise fall back to the library's stock blue/purple/teal
 * get the Aurora palette.
 *
 * The palette is derived from the live accent, so changing the hue in the
 * Appearance panel re-colours charts rendered from then on.
 */
import { feature } from "./settings";

/* --------------------------------------------------------------- palette ---- */

function hsl_to_hex(h, s, l) {
	s /= 100;
	l /= 100;
	const k = (n) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const to = (x) =>
		Math.round(255 * x)
			.toString(16)
			.padStart(2, "0");
	return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

function accent_hue() {
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue("--aurora-h")
		.trim();
	const h = parseFloat(raw);
	return isFinite(h) ? h : 256;
}

/**
 * Categorical series need hues that stay distinguishable however many there
 * are. Stepping by the golden angle (~137.5°) from the accent gives maximum
 * separation for any count, and anchoring at the accent keeps series 1 — the
 * one people actually look at — on-brand.
 *
 * Lightness alternates slightly so neighbouring series stay apart for viewers
 * with colour-vision deficiency, where hue alone is not enough.
 */
export function palette(count = 9) {
	const base = accent_hue();
	const dark = document.documentElement.getAttribute("data-theme") === "dark";
	const out = [];
	for (let i = 0; i < count; i++) {
		const h = (base + i * 137.508) % 360;
		const s = i === 0 ? 78 : 66 - (i % 3) * 5;
		const l = (dark ? 62 : 55) + (i % 2 ? 8 : 0);
		out.push(hsl_to_hex(h, s, l));
	}
	return out;
}

/** Sequential ramp, for heatmaps and anything ordered rather than categorical. */
export function ramp(steps = 5) {
	const base = accent_hue();
	const dark = document.documentElement.getAttribute("data-theme") === "dark";
	return Array.from({ length: steps }, (_, i) => {
		const t = i / Math.max(1, steps - 1);
		const l = dark ? 18 + t * 46 : 94 - t * 46;
		const s = 30 + t * 48;
		return hsl_to_hex(base, s, l);
	});
}

/* ------------------------------------------------------------------ patch ---- */

/**
 * Whether somebody deliberately chose these colours.
 *
 * Must test for a non-empty STRING, not merely for truthiness. `chart_widget.js`
 * builds its colour list as `[this.chart_doc.color || []]`, so a Line or Bar
 * dashboard chart with no colour set arrives here as `[[]]` — and `![]` is
 * false, i.e. an empty array is truthy. A plain `.some(x => !!x)` therefore read
 * every uncoloured dashboard chart as explicitly coloured and skipped the
 * palette, which is why they kept rendering in frappe-charts' stock pink
 * regardless of the accent.
 */
function has_explicit_colors(options) {
	const c = options?.colors;
	if (!Array.isArray(c)) return false;
	return c.some((x) => typeof x === "string" && x.trim() !== "");
}

const BAR_RADIUS = 5;

/**
 * Rounded bars, set as an ATTRIBUTE rather than through CSS.
 *
 * `rx`/`ry` are SVG geometry properties. CSS support for them is not universal —
 * Firefox does not implement geometry properties as CSS, so `rx: 5` in a
 * stylesheet silently does nothing there while working fine in Chrome. The
 * attribute is understood by every SVG renderer, so set that instead.
 */
function round_bars(root) {
	root.querySelectorAll("rect.bar").forEach((rect) => {
		const w = parseFloat(rect.getAttribute("width")) || 0;
		// never exceed half the thickness, or a thin bar becomes a lozenge
		const r = Math.max(0, Math.min(BAR_RADIUS, w / 2));
		if (rect.getAttribute("rx") === String(r)) return;
		rect.setAttribute("rx", r);
		rect.setAttribute("ry", r);
	});
}

/**
 * frappe-charts redraws its marks in place on refresh, filter change and resize,
 * which drops the attributes again — so this watches rather than running once.
 * `childList` only: setting an attribute cannot retrigger the callback, so there
 * is no feedback loop.
 */
function watch_bars(container) {
	if (!container || container.dataset.auroraBars) return;
	container.dataset.auroraBars = "1";
	round_bars(container);
	try {
		new MutationObserver(() => round_bars(container)).observe(container, {
			childList: true,
			subtree: true,
		});
	} catch (e) {
		/* one-shot rounding already applied */
	}
}

/**
 * Shape options the library exposes but frappe rarely sets.
 *
 * Only ever *defaults* — anything the caller passed is spread back over the
 * top, so a Dashboard Chart doc that specifies its own bar spacing or dot size
 * still wins. Per type, because a spline makes a trend line read beautifully
 * and would be a lie on a bar chart.
 */
function shape_options(options) {
	const out = {};

	if (options.type === "line") {
		out.lineOptions = {
			// a smoothed path with a tinted region under it: the single biggest
			// difference between "a library chart" and "a designed chart"
			spline: 1,
			regionFill: 1,
			hideDots: 0,
			dotSize: 4,
			...(options.lineOptions || {}),
		};
	}

	if (options.type === "bar") {
		// stock spaceRatio leaves bars almost touching, which reads as a block
		out.barOptions = { spaceRatio: 0.4, ...(options.barOptions || {}) };
	}

	if (options.type === "percentage") {
		out.barOptions = { height: 14, depth: 2, ...(options.barOptions || {}) };
	}

	return out;
}

/**
 * Repaint an already-rendered chart in place.
 *
 * frappe-charts writes series colour as an inline `style="fill: …"` on each mark
 * at construction time, so changing the accent cannot reach a chart that is
 * already on screen — which is why the dashboard used to need a reload before a
 * new hue or corner style showed up. Rewriting the inline values is the only way
 * to move them without holding the widget instance, which we do not have.
 *
 * Marks are grouped as `<g class="dataset-units dataset-bars dataset-0">`, so
 * the trailing index is what maps a group to its palette entry.
 */
function repaint(container) {
	const colors = palette();

	container.querySelectorAll("g[class*='dataset-']").forEach((group) => {
		const found = /\bdataset-(\d+)\b/.exec(group.getAttribute("class") || "");
		if (!found) return;
		const color = colors[Number(found[1]) % colors.length];

		group.querySelectorAll("rect.bar").forEach((r) => (r.style.fill = color));
		group.querySelectorAll("circle").forEach((c) => (c.style.fill = color));
		group.querySelectorAll("path").forEach((p) => {
			// a line's colour is its stroke; a filled region's is its fill
			if (p.classList.contains("dataset-path")) p.style.stroke = color;
			else p.style.fill = color;
		});
	});

	// the legend swatches are plain divs, in dataset order
	container.parentElement
		?.querySelectorAll(".legend-dot, .tooltip-legend")
		.forEach((dot, i) => (dot.style.background = colors[i % colors.length]));

	round_bars(container);
}

/** Every chart currently on the page — used when a setting changes. */
function repaint_all() {
	if (!feature("charts")) return;
	document.querySelectorAll(".chart-container").forEach((c) => {
		try {
			repaint(c);
		} catch (e) {
			/* one bad chart must not stop the rest */
		}
	});
}

export function init() {
	// accent, shape and the charts flag all change without a navigation, so the
	// charts on screen have to follow rather than wait for a reload
	document.addEventListener("aurora:settings", repaint_all);
	document.addEventListener("aurora:mode", repaint_all);

	if (!window.frappe?.Chart || frappe.Chart.__aurora) return;

	const Original = frappe.Chart;

	class AuroraChart extends Original {
		constructor(parent, options = {}) {
			try {
				if (feature("charts")) {
					options = {
						...options,
						...shape_options(options),
						// explicit colours are somebody's deliberate choice
						...(has_explicit_colors(options)
							? {}
							: { colors: options.type === "heatmap" ? ramp(5) : palette() }),
					};
				}
			} catch (e) {
				// a palette problem must never stop a chart from rendering
				console.error("[aurora] chart palette failed", e);
			}
			super(parent, options);

			/* Mark the container so CSS can style only charts the theme owns.
			 *
			 * frappe-charts builds `.chart-container` *inside* the parent —
			 * `makeContainer()` is
			 * `create("div", { inside: this.parent, className: "chart-container" })`
			 * — so it is a descendant, never an ancestor. An earlier pass used
			 * `closest()` here, which walks upward: it returned null every time
			 * and left every themed chart rule dead. The instance holds the node
			 * directly, so prefer that and query downward as a fallback. */
			try {
				if (feature("charts")) {
					const el = typeof parent === "string" ? document.querySelector(parent) : parent;
					const box = this.container || el?.querySelector?.(".chart-container") || el;
					box?.classList?.add("aurora-chart");
					if (box) watch_bars(box);
				}
			} catch (e) {
				/* nothing to mark — the chart still renders */
			}
		}
	}

	AuroraChart.__aurora = true;
	frappe.Chart = AuroraChart;

	// frappe.ui.RealtimeChart was declared before this ran and still extends the
	// original class, so it needs the same treatment to stay in the theme.
	if (frappe.ui?.RealtimeChart && !frappe.ui.RealtimeChart.__aurora) {
		const Realtime = frappe.ui.RealtimeChart;
		class AuroraRealtimeChart extends Realtime {
			constructor(element, socketEvent, maxLabelPoints, data = {}) {
				if (feature("charts") && !has_explicit_colors(data)) {
					data = { ...data, colors: palette() };
				}
				super(element, socketEvent, maxLabelPoints, data);
			}
		}
		AuroraRealtimeChart.__aurora = true;
		frappe.ui.RealtimeChart = AuroraRealtimeChart;
	}
}
