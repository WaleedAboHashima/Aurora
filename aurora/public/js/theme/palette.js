/**
 * Aurora — quick actions palette (Ctrl/Cmd + Shift + K).
 *
 * This is deliberately *not* another search box — frappe's awesomebar already
 * searches documents. The palette is about acting: jump to a workspace you were
 * just in, run a command on the document you're looking at, create a new record,
 * or change the theme, all without leaving the keyboard.
 */
import * as settings from "./settings";
import { list as recent_routes } from "./recents";
import { icon } from "./utils";

let $backdrop = null;
let $input = null;
let $list = null;
let items = [];
let selected = 0;
let is_open = false;

/* ------------------------------------------------------------ command sources */

function theme_commands() {
	const dark = document.documentElement.getAttribute("data-theme") === "dark";
	return [
		{
			group: "Theme",
			label: dark ? "Switch to light mode" : "Switch to dark mode",
			hint: "Appearance",
			mark: dark ? "☀" : "☾",
			run: () => settings.set_mode(dark ? "light" : "dark"),
		},
		{
			group: "Theme",
			label: "Open appearance settings",
			hint: "Accent, density, corners",
			mark: "✦",
			run: () => document.dispatchEvent(new CustomEvent("aurora:open-panel")),
		},
		{
			group: "Theme",
			label: "Toggle animations",
			hint: settings.get().motion === "on" ? "Currently on" : "Currently off",
			mark: "⟳",
			run: () =>
				settings.set({ motion: settings.get().motion === "on" ? "off" : "on" }),
		},
	];
}

function document_commands() {
	const frm = window.cur_frm;
	if (!frm || !frm.doc || frappe.get_route()?.[0] !== "Form") return [];

	const label = `${frm.doctype} ${frm.docname}`;
	const cmds = [
		{
			group: "This document",
			label: "Save",
			hint: label,
			mark: "⌘S",
			run: () => frm.save(),
		},
		{
			group: "This document",
			label: "Copy link",
			hint: label,
			mark: "🔗",
			run: () => {
				frappe.utils.copy_to_clipboard(window.location.href);
			},
		},
		{
			group: "This document",
			label: "Print",
			hint: label,
			mark: "🖨",
			run: () => frappe.set_route("print", frm.doctype, frm.docname),
		},
		{
			group: "This document",
			label: "Open list view",
			hint: frm.doctype,
			mark: "≡",
			run: () => frappe.set_route("List", frm.doctype),
		},
	];

	if (frappe.model.can_create(frm.doctype)) {
		cmds.push({
			group: "This document",
			label: "Duplicate",
			hint: label,
			mark: "⧉",
			run: () => frm.copy_doc(),
		});
	}
	return cmds;
}

function recent_commands() {
	return recent_routes()
		.slice(1, 7) // [0] is the page we're already on
		.map((r) => ({
			group: "Recent",
			label: r.label,
			hint: "Jump back",
			mark: "↩",
			run: () => frappe.set_route(r.route),
		}));
}

function workspace_commands() {
	// read the rendered sidebar rather than the boot payload: it is already
	// filtered by permission and reflects whatever the user has pinned
	return Array.from(
		document.querySelectorAll(".body-sidebar .sidebar-items .item-anchor[href]")
	)
		.map((a) => ({
			group: "Workspaces",
			label: (a.querySelector(".sidebar-item-label")?.textContent || "").trim(),
			hint: "Workspace",
			mark: "◧",
			href: a.getAttribute("href"),
		}))
		.filter((c) => c.label)
		.map((c) => ({ ...c, run: () => frappe.set_route(c.href.replace(/^\/app\/?/, "")) }));
}

function doctype_commands(query) {
	if (!query || query.length < 2) return [];
	const q = query.toLowerCase();
	const can_read = frappe.boot?.user?.can_read || [];
	const can_create = frappe.boot?.user?.can_create || [];

	const out = [];
	for (const dt of can_read) {
		if (out.length >= 10) break;
		if (!dt.toLowerCase().includes(q)) continue;
		out.push({
			group: "Go to",
			label: `${dt} list`,
			hint: "List view",
			mark: "≡",
			run: () => frappe.set_route("List", dt),
		});
		if (can_create.includes(dt)) {
			out.push({
				group: "Create",
				label: `New ${dt}`,
				hint: "Create a record",
				mark: "＋",
				run: () => frappe.new_doc(dt),
			});
		}
	}
	return out;
}

function collect(query) {
	const all = [
		...document_commands(),
		...recent_commands(),
		...workspace_commands(),
		...theme_commands(),
		...doctype_commands(query),
	];

	if (!query) return all.slice(0, 18);

	const q = query.toLowerCase();
	return all
		.map((c) => {
			const label = c.label.toLowerCase();
			// exact prefix beats substring beats fuzzy subsequence
			let score = -1;
			if (label.startsWith(q)) score = 0;
			else if (label.includes(q)) score = 1;
			else if (subsequence(label, q)) score = 2;
			return { ...c, score };
		})
		.filter((c) => c.score >= 0)
		.sort((a, b) => a.score - b.score)
		.slice(0, 18);
}

function subsequence(haystack, needle) {
	let i = 0;
	for (const ch of haystack) {
		if (ch === needle[i]) i += 1;
		if (i === needle.length) return true;
	}
	return false;
}

/* -------------------------------------------------------------------- render */

function render(query) {
	items = collect(query);
	selected = 0;

	if (!items.length) {
		$list.innerHTML = `<div class="aurora-palette-empty">
			No actions match “${frappe.utils.escape_html(query || "")}”.</div>`;
		return;
	}

	let html = "";
	let group = null;
	items.forEach((item, i) => {
		if (item.group !== group) {
			group = item.group;
			html += `<div class="aurora-palette-group">${group}</div>`;
		}
		html += `<div class="aurora-palette-item ${i === 0 ? "selected" : ""}"
			data-index="${i}" style="--aurora-i:${Math.min(i, 12)}">
			<span class="aurora-palette-icon">${item.mark || "•"}</span>
			<span class="aurora-palette-label">${frappe.utils.escape_html(item.label)}</span>
			<span class="aurora-palette-meta">${frappe.utils.escape_html(item.hint || "")}</span>
		</div>`;
	});
	$list.innerHTML = html;
}

function move(delta) {
	if (!items.length) return;
	selected = (selected + delta + items.length) % items.length;
	$list.querySelectorAll(".aurora-palette-item").forEach((el) => {
		const on = Number(el.dataset.index) === selected;
		el.classList.toggle("selected", on);
		if (on) el.scrollIntoView({ block: "nearest" });
	});
}

function run(index = selected) {
	const item = items[index];
	if (!item) return;
	close();
	try {
		item.run();
	} catch (e) {
		console.error("[aurora] command failed", e);
	}
}

/* ---------------------------------------------------------------------- open */

export function open() {
	if (!$backdrop) build();
	is_open = true;
	$backdrop.classList.add("open");
	$input.value = "";
	render("");
	setTimeout(() => $input.focus(), 40);
}

export function close() {
	if (!$backdrop) return;
	is_open = false;
	$backdrop.classList.remove("open");
}

function build() {
	$backdrop = document.createElement("div");
	$backdrop.className = "aurora-palette-backdrop";
	$backdrop.innerHTML = `
		<div class="aurora-palette" role="dialog" aria-label="Quick actions">
			<div class="aurora-palette-input-row">
				${icon("search")}
				<input type="text" placeholder="Type a command, doctype or workspace…"
					aria-label="Quick actions" autocomplete="off" spellcheck="false">
			</div>
			<div class="aurora-palette-list"></div>
			<div class="aurora-palette-footer">
				<span><span class="aurora-kbd">↑↓</span> navigate</span>
				<span><span class="aurora-kbd">↵</span> run</span>
				<span><span class="aurora-kbd">esc</span> close</span>
			</div>
		</div>`;
	document.body.appendChild($backdrop);

	$input = $backdrop.querySelector("input");
	$list = $backdrop.querySelector(".aurora-palette-list");

	$input.addEventListener("input", () => render($input.value.trim()));

	$input.addEventListener("keydown", (e) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			move(1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			move(-1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			run();
		} else if (e.key === "Escape") {
			e.preventDefault();
			close();
		}
	});

	$list.addEventListener("click", (e) => {
		const row = e.target.closest(".aurora-palette-item");
		if (row) run(Number(row.dataset.index));
	});

	$backdrop.addEventListener("pointerdown", (e) => {
		if (e.target === $backdrop) close();
	});
}

export function init() {
	// frappe composes its shortcut keys as ctrl → shift → alt, so the string it
	// looks up for Ctrl+Shift+K is "shift+ctrl+k". Register both spellings.
	const action = () => {
		// the shortcut is registered once, but the switch can be flipped later
		if (!settings.feature("palette")) return false;
		is_open ? close() : open();
		return true;
	};

	if (window.frappe?.ui?.keys?.add_shortcut) {
		["shift+ctrl+k", "ctrl+shift+k"].forEach((shortcut) => {
			frappe.ui.keys.add_shortcut({
				shortcut,
				action,
				description: __("Open Aurora quick actions"),
				ignore_inputs: true,
			});
		});
	} else {
		document.addEventListener("keydown", (e) => {
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
				e.preventDefault();
				action();
			}
		});
	}
}
