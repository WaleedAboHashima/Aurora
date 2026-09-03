/**
 * Aurora — appearance dock and control panel.
 *
 * Everything the theme can be told to do is in here, in two tabs:
 *   Look   — colour mode, accent, font, corners, density
 *   Motion — the global animation switch plus a per-feature list
 *
 * Every change writes through settings.js, which repaints instantly, caches to
 * localStorage and saves to the current user's account (debounced). Nothing is
 * site-wide: two people on the same site can run completely different themes.
 */
import * as settings from "./settings";
import { ACCENTS, FEATURES, TOAST_POSITIONS } from "./settings";
import { icon, hue_to_hex, parse_hue_or_hex, get_current_hex } from "./utils";
import { open as open_palette } from "./palette";
import * as fonts from "./fonts";

let $dock = null;
let $panel = null;
let open = false;
let tab = "look";

/* ---------------------------------------------------------------- rendering */

function segmented(field, options, current) {
	const buttons = options
		.map(
			(o) =>
				`<button type="button" data-value="${o.value}"
					class="${o.value === current ? "active" : ""}">${o.label}</button>`
		)
		.join("");
	return `<div class="aurora-seg" data-field="${field}">
		<span class="aurora-seg-thumb"></span>${buttons}
	</div>`;
}

function swatches(current_hue) {
	return ACCENTS.map(
		(a) =>
			`<button type="button" class="aurora-swatch ${
				Math.abs(a.hue - current_hue) < 4 ? "active" : ""
			}" style="--sw-h: ${a.hue}" data-hue="${a.hue}"
			title="${a.label}" aria-label="${a.label}"></button>`
	).join("");
}

function switch_row(field, label, hint, on) {
	return `<div class="aurora-switch-row">
		<span class="aurora-switch-text">
			${label}
			${hint ? `<small>${hint}</small>` : ""}
		</span>
		<button type="button" class="aurora-switch" data-field="${field}"
			role="switch" aria-checked="${on}" aria-label="${label}"></button>
	</div>`;
}

function look_tab() {
	const s = settings.get();
	return `
		<div class="aurora-field">
			<label>Colour mode</label>
			${segmented(
				"mode",
				[
					{ value: "light", label: "Light" },
					{ value: "dark", label: "Dark" },
					{ value: "automatic", label: "Auto" },
				],
				settings.get_mode()
			)}
		</div>

		<div class="aurora-field">
			<label>Accent</label>
			<div class="aurora-swatches">${swatches(s.hue)}</div>
		</div>

		<div class="aurora-field">
			<label>Custom hue &amp; Color code</label>
			<div class="aurora-hue-container">
				<input type="range" class="aurora-hue" min="0" max="360" value="${s.hue}"
					aria-label="Accent hue">
				<div class="aurora-hue-input-group">
					<input type="color" class="aurora-color-picker" value="${get_current_hex(s)}"
						title="Pick color" aria-label="Pick color">
					<input type="text" class="aurora-hue-input" value="${get_current_hex(s)}"
						placeholder="#HEX or 0-360" spellcheck="false" autocomplete="off"
						aria-label="Color hex or hue code" title="Enter Hex color (e.g. #8B5CF6) or Hue (0-360)">
				</div>
			</div>
		</div>

		<div class="aurora-field">
			<label>Typeface</label>
			${segmented(
				"font",
				[
					{ value: "system", label: "System" },
					{ value: "inter", label: "Inter" },
					{ value: "rounded", label: "Rounded" },
					{ value: "custom", label: "Custom" },
				],
				s.font
			)}
			<div class="aurora-font-custom ${s.font === "custom" ? "" : "hidden"}">
				<div class="aurora-font-input-row">
					<input type="text" class="aurora-font-input" list="aurora-font-list"
						placeholder="Type a font name…" autocomplete="off"
						spellcheck="false" value="${(s.font_custom || "").replace(/"/g, "&quot;")}">
					${
						fonts.can_enumerate()
							? `<button type="button" class="aurora-font-browse"
									title="List fonts installed on this device">Browse</button>`
							: ""
					}
				</div>
				<datalist id="aurora-font-list"></datalist>
				<p class="aurora-font-status" data-state="idle"></p>
			</div>
		</div>

		<div class="aurora-field">
			<label>Corners</label>
			${segmented(
				"shape",
				[
					{ value: "sharp", label: "Sharp" },
					{ value: "soft", label: "Soft" },
					{ value: "round", label: "Round" },
				],
				s.shape
			)}
		</div>

		<div class="aurora-field">
			<label>Density</label>
			${segmented(
				"density",
				[
					{ value: "compact", label: "Compact" },
					{ value: "cozy", label: "Cozy" },
					{ value: "roomy", label: "Roomy" },
				],
				s.density
			)}
		</div>

		<div class="aurora-field">
			<label>Ambient colour</label>
			${segmented(
				"ambient",
				[
					{ value: "off", label: "Off" },
					{ value: "subtle", label: "Subtle" },
					{ value: "vivid", label: "Vivid" },
				],
				s.ambient
			)}
			<p class="aurora-note">Vivid tints the panels themselves, not just the background.</p>
		</div>

		<div class="aurora-field">
			<label>Toast position</label>
			${toast_picker(s.toast_position)}
			<p class="aurora-note">Where messages appear. Mobile always docks them to the bottom.</p>
		</div>`;
}

/**
 * Six corners is too many for a segmented row, so this is a 3x2 grid laid out
 * like the screen itself — the cell you press is where the toast will show up.
 * Cheaper to read than a list of labels, and it needs no legend.
 */
function toast_picker(current) {
	const cells = TOAST_POSITIONS.map((pos) => {
		const [v, h] = pos.split("-");
		return `<button type="button" data-pos="${pos}"
			class="aurora-toast-cell${pos === current ? " active" : ""}"
			aria-label="${v} ${h}" title="${v} ${h}"><i></i></button>`;
	}).join("");

	return `<div class="aurora-toast-grid" data-field="toast_position">${cells}</div>`;
}

function motion_tab() {
	const s = settings.get();
	const all_off = s.motion !== "on";

	return `
		${switch_row(
			"motion",
			"Animations",
			"Master switch for all motion",
			s.motion === "on"
		)}

		<div class="aurora-feature-list ${all_off ? "is-disabled" : ""}">
			<label>Individual effects</label>
			${FEATURES.map((f) =>
				switch_row(`feature:${f.key}`, f.label, f.hint, s.features[f.key] !== false)
			).join("")}
		</div>

		<p class="aurora-note">
			Turning animations off here also respects your system's
			“reduce motion” setting automatically.
		</p>`;
}

function panel_html() {
	return `
		<div class="aurora-panel-head">
			<div>
				<div class="aurora-panel-title">Appearance</div>
				<div class="aurora-panel-sub">Saved to your account — only you see these.</div>
			</div>
		</div>

		<div class="aurora-tabs" role="tablist">
			<button type="button" data-tab="look" class="${tab === "look" ? "active" : ""}"
				role="tab">Look</button>
			<button type="button" data-tab="motion" class="${tab === "motion" ? "active" : ""}"
				role="tab">Motion</button>
			<span class="aurora-tabs-thumb"></span>
		</div>

		<div class="aurora-panel-body">
			${tab === "look" ? look_tab() : motion_tab()}
		</div>

		<div class="aurora-panel-footer">
			<button type="button" class="aurora-link-btn" data-action="reset">Reset to defaults</button>
			<span class="aurora-kbd">${
				window.frappe?.utils?.is_mac?.() ? "⌘" : "Ctrl"
			}+⇧+K</span>
		</div>`;
}

/** Slide the thumb of every segmented control / tab bar under its active item. */
function place_thumbs(scope) {
	scope.querySelectorAll(".aurora-seg, .aurora-tabs").forEach((group) => {
		const thumb = group.querySelector(".aurora-seg-thumb, .aurora-tabs-thumb");
		const active = group.querySelector("button.active");
		if (!thumb || !active) return;
		thumb.style.width = `${active.offsetWidth}px`;
		thumb.style.transform = `translateX(${active.offsetLeft - 3}px)`;
	});
}

/* ------------------------------------------------------------------ actions */

function bind_panel() {
	const root = $panel;

	root.addEventListener("click", (e) => {
		const tab_btn = e.target.closest(".aurora-tabs button");
		if (tab_btn) {
			tab = tab_btn.dataset.tab;
			refresh();
			return;
		}

		const cell = e.target.closest(".aurora-toast-cell");
		if (cell) {
			const pos = cell.dataset.pos;
			cell.closest(".aurora-toast-grid")
				?.querySelectorAll(".aurora-toast-cell")
				.forEach((c) => c.classList.toggle("active", c === cell));
			settings.set({ toast_position: pos });
			// fire one where they asked, so the choice is immediately legible
			frappe.show_alert?.({ message: `Toasts: ${pos.replace("-", " ")}`, indicator: "blue" });
			return;
		}

		const seg_btn = e.target.closest(".aurora-seg button");
		if (seg_btn) {
			const seg = seg_btn.closest(".aurora-seg");
			const field = seg.dataset.field;
			const value = seg_btn.dataset.value;
			seg.querySelectorAll("button").forEach((b) =>
				b.classList.toggle("active", b === seg_btn)
			);
			place_thumbs(root);
			field === "mode" ? settings.set_mode(value) : settings.set({ [field]: value });

			if (field === "font") {
				const row = root.querySelector(".aurora-font-custom");
				row?.classList.toggle("hidden", value !== "custom");
				if (value === "custom") {
					fill_font_suggestions();
					root.querySelector(".aurora-font-input")?.focus();
				}
			}
			return;
		}

		const swatch = e.target.closest(".aurora-swatch");
		if (swatch) {
			const hue = Number(swatch.dataset.hue);
			settings.set({ hue, sat: 84, custom_hex: "", custom_lightness: null });
			root.querySelectorAll(".aurora-swatch").forEach((s) =>
				s.classList.toggle("active", Number(s.dataset.hue) === hue)
			);
			const slider = root.querySelector(".aurora-hue");
			if (slider) slider.value = String(hue);
			const hex = hue_to_hex(hue);
			const hexInput = root.querySelector(".aurora-hue-input");
			if (hexInput) hexInput.value = hex;
			const picker = root.querySelector(".aurora-color-picker");
			if (picker) picker.value = hex;
			return;
		}

		const sw = e.target.closest(".aurora-switch");
		if (sw) {
			const on = sw.getAttribute("aria-checked") !== "true";
			sw.setAttribute("aria-checked", String(on));
			const field = sw.dataset.field;

			if (field.startsWith("feature:")) {
				settings.set_feature(field.slice(8), on);
			} else if (field === "motion") {
				settings.set({ motion: on ? "on" : "off" });
				root.querySelector(".aurora-feature-list")?.classList.toggle("is-disabled", !on);
			} else {
				settings.set({ [field]: on });
			}
			return;
		}

		if (e.target.closest(".aurora-font-browse")) {
			set_font_status("checking", "Reading installed fonts…");
			fonts.list_installed().then((list) => {
				if (!list.length) {
					set_font_status("missing", "Permission denied, or no fonts returned.");
					return;
				}
				fill_font_suggestions(list);
				set_font_status("ok", `${list.length} fonts available — start typing to filter.`);
				root.querySelector(".aurora-font-input")?.focus();
			});
			return;
		}

		if (e.target.closest('[data-action="reset"]')) {
			settings.reset();
			refresh();
			window.frappe?.show_alert?.({ message: "Theme reset", indicator: "blue" }, 3);
		}
	});

	// typing a font name: debounced so we don't probe on every keystroke
	let font_timer = null;
	root.addEventListener("input", (e) => {
		if (!e.target.classList.contains("aurora-font-input")) return;
		const value = e.target.value;
		clearTimeout(font_timer);
		font_timer = setTimeout(() => try_custom_font(value), 420);
	});

	// Enter applies immediately
	root.addEventListener("keydown", (e) => {
		if (!e.target.classList.contains("aurora-font-input")) return;
		if (e.key !== "Enter") return;
		e.preventDefault();
		clearTimeout(font_timer);
		try_custom_font(e.target.value);
	});

	root.addEventListener("input", (e) => {
		if (e.target.classList.contains("aurora-hue")) {
			const hue = Number(e.target.value);
			settings.set({ hue, sat: 84, custom_hex: "", custom_lightness: null });
			const hex = hue_to_hex(hue);
			const hexInput = root.querySelector(".aurora-hue-input");
			if (hexInput && document.activeElement !== hexInput) hexInput.value = hex;
			const picker = root.querySelector(".aurora-color-picker");
			if (picker && document.activeElement !== picker) picker.value = hex;
			root.querySelectorAll(".aurora-swatch").forEach((s) =>
				s.classList.toggle("active", Math.abs(Number(s.dataset.hue) - hue) < 4)
			);
			return;
		}

		if (e.target.classList.contains("aurora-color-picker")) {
			const hex = e.target.value;
			const parsed = parse_hue_or_hex(hex);
			if (parsed !== null) {
				settings.set(parsed);
				const slider = root.querySelector(".aurora-hue");
				if (slider) slider.value = String(parsed.hue);
				const hexInput = root.querySelector(".aurora-hue-input");
				if (hexInput && document.activeElement !== hexInput) hexInput.value = parsed.hex;
				root.querySelectorAll(".aurora-swatch").forEach((s) =>
					s.classList.toggle("active", Math.abs(Number(s.dataset.hue) - parsed.hue) < 4)
				);
			}
			return;
		}

		if (e.target.classList.contains("aurora-hue-input")) {
			const val = e.target.value;
			const parsed = parse_hue_or_hex(val);
			if (parsed !== null) {
				settings.set(parsed);
				const slider = root.querySelector(".aurora-hue");
				if (slider) slider.value = String(parsed.hue);
				const picker = root.querySelector(".aurora-color-picker");
				if (picker && document.activeElement !== picker) picker.value = parsed.hex;
				root.querySelectorAll(".aurora-swatch").forEach((s) =>
					s.classList.toggle("active", Math.abs(Number(s.dataset.hue) - parsed.hue) < 4)
				);
			}
			return;
		}
	});

	root.addEventListener("change", (e) => {
		if (e.target.classList.contains("aurora-hue-input")) {
			const s = settings.get();
			e.target.value = get_current_hex(s);
		}
	});
}


/** Fill the datalist: installed platform faces first, then fetchable ones. */
function fill_font_suggestions(extra = []) {
	const list = $panel.querySelector("#aurora-font-list");
	if (!list) return;
	const { local, google } = fonts.suggestions();
	const all = [...new Set([...extra, ...local, ...google])];
	list.innerHTML = all.map((f) => `<option value="${f}"></option>`).join("");
}

function set_font_status(state, text) {
	const el = $panel.querySelector(".aurora-font-status");
	if (!el) return;
	el.dataset.state = state;
	el.textContent = text;
}

/**
 * Resolve what the user typed and apply it if it can actually render.
 * Debounced by the caller — this does real work (and possibly a network fetch).
 */
async function try_custom_font(family) {
	const name = (family || "").trim();

	if (!name) {
		set_font_status("idle", "");
		settings.set({ font_custom: "" });
		return;
	}

	set_font_status("checking", `Looking for “${name}”…`);
	const where = await fonts.resolve(name);

	if (where === "missing") {
		// leave the previous font in place rather than breaking the desk
		set_font_status("missing", `“${name}” isn't installed and isn't on Google Fonts.`);
		return;
	}

	settings.set({ font: "custom", font_custom: name });
	set_font_status(
		"ok",
		where === "local" ? `Using “${name}” from this device.` : `Loaded “${name}” from Google Fonts.`
	);
}

function refresh() {
	$panel.innerHTML = panel_html();
	fill_font_suggestions();
	// restore the status line for an already-chosen custom font
	const s = settings.get();
	if (s.font === "custom" && s.font_custom) {
		set_font_status("ok", `Using “${s.font_custom}”.`);
	}
	requestAnimationFrame(() => place_thumbs($panel));
}

export function toggle_panel(force) {
	if (!$panel) return;
	open = force === undefined ? !open : force;
	$panel.classList.toggle("open", open);
	// auto-hide must not pull the dock away while its own panel is open
	$dock.classList.toggle("is-awake", open);
	$dock.querySelector('[data-action="appearance"]')?.classList.toggle("is-open", open);
	if (open) {
		refresh();
		requestAnimationFrame(() => place_thumbs($panel));
	}
}

export function toggle_mode() {
	const dark = document.documentElement.getAttribute("data-theme") === "dark";
	settings.set_mode(dark ? "light" : "dark");
	if (open) refresh();
}

/* --------------------------------------------------------------------- init */

export function init() {
	$dock = document.createElement("div");
	$dock.className = "aurora-dock";
	$dock.innerHTML = `
		<button type="button" class="aurora-dock-btn" data-action="palette"
			aria-label="Quick actions">
			${icon("command")}<span class="aurora-dock-label">Quick actions</span>
		</button>
		<button type="button" class="aurora-dock-btn" data-action="mode"
			aria-label="Toggle colour mode">
			${icon("sun")}<span class="aurora-dock-label">Light / dark</span>
		</button>
		<button type="button" class="aurora-dock-btn" data-action="charts"
			aria-label="Toggle chart theming" aria-pressed="false">
			${icon("chart")}<span class="aurora-dock-label">Chart theming</span>
		</button>
		<button type="button" class="aurora-dock-btn" data-action="appearance"
			aria-label="Appearance settings">
			${icon("sparkles")}<span class="aurora-dock-label">Appearance</span>
		</button>`;

	$panel = document.createElement("div");
	$panel.className = "aurora-panel";
	$panel.setAttribute("role", "dialog");
	$panel.setAttribute("aria-label", "Appearance settings");

	document.body.appendChild($dock);
	document.body.appendChild($panel);
	refresh();
	bind_panel();
	sync_mode_icon();

	$dock.addEventListener("click", (e) => {
		const btn = e.target.closest(".aurora-dock-btn");
		if (!btn) return;
		const action = btn.dataset.action;
		if (action === "appearance") toggle_panel();
		if (action === "mode") toggle_mode();
		if (action === "palette") open_palette();
		if (action === "charts") toggle_charts();
	});

	document.addEventListener("pointerdown", (e) => {
		if (!open) return;
		if ($panel.contains(e.target) || $dock.contains(e.target)) return;
		toggle_panel(false);
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && open) toggle_panel(false);
	});

	document.addEventListener("aurora:mode", sync_mode_icon);
	document.addEventListener("aurora:open-panel", () => toggle_panel(true));
	document.addEventListener("aurora:settings", sync_dock);
	sync_dock();
}

/**
 * Chart theming, straight from the dock.
 *
 * Already-rendered charts painted their colours as SVG attributes when they were
 * built, so flipping the flag cannot repaint them — only charts constructed from
 * here on pick it up. Rather than leave the user staring at an unchanged
 * dashboard wondering if the button worked, re-render the charts on the page.
 */
export function toggle_charts() {
	const on = !settings.feature("charts");
	settings.set_feature("charts", on);
	sync_dock();

	try {
		// the dashboard keeps its chart widgets addressable; a workspace refresh
		// rebuilds them through frappe.Chart, which is where the theming lives
		frappe.dashboard_utils?.render_chart_filters &&
			document.dispatchEvent(new CustomEvent("aurora:charts", { detail: { on } }));
		if (frappe.views?.workspace_view?.refresh) frappe.views.workspace_view.refresh();
	} catch (e) {
		/* cosmetic — the next navigation will show the change regardless */
	}

	frappe.show_alert?.({
		message: on ? "Chart theming on" : "Chart theming off — reload to repaint",
		indicator: on ? "green" : "gray",
	});
}

/** Keep the dock in step with the feature switches. */
function sync_dock() {
	const palette_btn = $dock?.querySelector('[data-action="palette"]');
	if (palette_btn) palette_btn.hidden = !settings.feature("palette");

	const charts_btn = $dock?.querySelector('[data-action="charts"]');
	if (charts_btn) {
		const on = settings.feature("charts");
		charts_btn.classList.toggle("is-active", on);
		charts_btn.setAttribute("aria-pressed", on ? "true" : "false");
	}
}

function sync_mode_icon() {
	const btn = $dock?.querySelector('[data-action="mode"]');
	if (!btn) return;
	const dark = document.documentElement.getAttribute("data-theme") === "dark";
	btn.innerHTML = `${icon(dark ? "sun" : "moon")}
		<span class="aurora-dock-label">${dark ? "Light mode" : "Dark mode"}</span>`;
}
