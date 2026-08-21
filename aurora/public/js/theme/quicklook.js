/**
 * Aurora — Quick Look.
 *
 * Modelled on macOS: hover something to get a small peek near the cursor, press
 * SPACE (or click the peek) to open it full-size in a panel you can actually
 * interact with, Esc or click-away to dismiss.
 *
 * Two stages on purpose. The peek is cheap and instant so it can fire on hover
 * without feeling heavy; the panel is the expensive thing (an iframe, a full
 * image) and only loads once the user has actually asked for it.
 *
 * Handled kinds:
 *   image  — the image itself, then a full view with a download link
 *   pdf    — a file card, then the PDF in an iframe (browsers render these)
 *   file   — a file card, then a download prompt
 *   doc    — a permission-checked field summary, then the real desk form in an
 *            iframe, so it is genuinely editable rather than a read-only card
 *
 * Normal clicks are never intercepted: a link still navigates. Expanding is
 * Space, or a click on the peek card itself.
 */
import { feature } from "./settings";
import { motion_off, icon } from "./utils";

const HOVER_DELAY = 420;
const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?|#|$)/i;
const PDF_RE = /\.pdf(\?|#|$)/i;
const SHEET_RE = /\.(xlsx|xlsm|xls|csv)(\?|#|$)/i;

/* Injected into the document iframe. Without it the preview renders a whole
   second desk inside the drawer — app rail, top bar, the theme's own dock —
   around the one form the user actually asked for. The drawer supplies its own
   frame, so core's chrome is not just redundant here, it is misleading. */
const FRAME_CSS = `
	.body-sidebar-container, .navbar, .sticky-top, .layout-footer,
	.aurora-dock, .aurora-panel, .aurora-palette, .aurora-entry,
	.page-head .sidebar-toggle-btn { display: none !important; }
	.main-section, #body { margin-left: 0 !important; padding-left: 0 !important;
		width: 100% !important; max-width: none !important; }
	body { overflow-x: hidden !important; }
`;

let peek = null;
let panel = null;
let backdrop = null;
let hover_timer = null;
let current = null;
let expanded = null; // what the open surface is showing, vs `current` on hover
let panel_open = false;

/* --------------------------------------------------------------- targets -- */

const FILE_PATH_RE = /\/(?:private\/)?files\//;

/**
 * The site-relative path of a file url, or null if it is not one of ours.
 *
 * Values reach us in every shape frappe stores them in: a site-relative path
 * from an attachment row, an absolute url someone pasted into an image field, or
 * a `data:` URI from an unsaved upload. Normalising through `URL` handles all
 * three, and rejecting anything cross-origin keeps the peek from firing on
 * third-party images the server could not read anyway.
 */
function file_url_of(raw) {
	if (!raw || raw.startsWith("data:")) return null;
	try {
		const url = new URL(raw, window.location.origin);
		if (url.origin !== window.location.origin) return null;
		const path = url.pathname + url.search;
		return FILE_PATH_RE.test(path) ? path : null;
	} catch (e) {
		return null;
	}
}

/**
 * Anything we can point an <img> at — a far wider net than `file_url_of`.
 *
 * The two must not be conflated. `file_url_of` is strict because a spreadsheet
 * or a File-record lookup genuinely needs a site-relative path the server can
 * resolve. An image needs none of that: the peek renders `<img src>` and the
 * browser does the fetching, so cross-origin is perfectly previewable.
 *
 * Being strict here was a real bug. An image field holding an external url —
 * which is how ERPNext's own demo Items are seeded, straight from pexels.com,
 * with no File record anywhere — was rejected for being cross-origin and for
 * having no `/files/` in its path. The result was a record that visibly had an
 * image and no hover preview at all.
 *
 * Only `blob:` is refused: those are bound to the page that minted them and are
 * dead by the time a peek would open.
 */
function image_src_of(raw) {
	if (!raw) return null;
	const value = raw.trim();
	if (!value || value.startsWith("blob:")) return null;
	if (value.startsWith("data:image/")) return value;
	try {
		const url = new URL(value, window.location.origin);
		return /^https?:$/.test(url.protocol) ? url.href : null;
	} catch (e) {
		return null;
	}
}

/** True for anything not served by this site — no Download link for those. */
function is_external(url) {
	try {
		return new URL(url, window.location.origin).origin !== window.location.origin;
	} catch (e) {
		return false;
	}
}

function file_kind(url) {
	if (IMAGE_RE.test(url)) return "image";
	if (PDF_RE.test(url)) return "pdf";
	if (SHEET_RE.test(url)) return "sheet";
	return "file";
}

function describe(el) {
	if (!el || !el.closest) return null;

	const doc_link = el.closest("a[data-doctype][data-name]");
	if (doc_link) {
		return {
			kind: "doc",
			doctype: doc_link.dataset.doctype,
			name: frappe.utils.unescape_html(doc_link.dataset.name),
		};
	}

	// a link *field*: the doctype is on the input, the value is what's typed
	const link_input = el.closest('input[data-fieldtype="Link"][data-target]');
	if (link_input && link_input.value) {
		return { kind: "doc", doctype: link_input.dataset.target, name: link_input.value };
	}

	/* Only where an image is the *subject*, never where it is decoration.
	 *
	 * An earlier revision matched any `<img>` plus anything carrying a
	 * background-image, which was far too wide: `frappe.get_avatar()` renders
	 * every avatar as `<span class="avatar-frame" style="background-image:
	 * url(…)">`, so a comment thread full of faces — and every app logo and
	 * icon — all offered "Space to open". An allow-list is the right shape here;
	 * a deny-list would rot the moment core adds another decorative image.
	 *
	 * Attachment images are NOT listed, and do not need to be: they arrive as
	 * links and are picked up by the `a[href]` branch below. */
	const host = el.closest(
		".sidebar-image, .sidebar-image-wrapper, .image-view-item, .file-preview"
	);
	if (host) {
		// the container may be larger than the image, so look downward too
		const img = host.matches("img") ? host : host.querySelector("img");
		const url = img && image_src_of(img.getAttribute("src"));
		if (url) return { kind: "image", url };
	}

	const link = el.closest("a[href]");
	if (link) {
		const url = file_url_of(link.getAttribute("href"));
		if (url) return { kind: file_kind(url), url };
	}

	// the sidebar attachment pill links to the File form; the real url is inside
	const pill = el.closest(".attachment-row, .attached-file");
	if (pill) {
		const a = pill.querySelector('a[href*="/files/"]');
		const url = a && file_url_of(a.getAttribute("href"));
		if (url) return { kind: file_kind(url), url };
	}

	return null;
}

function same_target(a, b) {
	if (!a || !b) return false;
	return a.kind === b.kind && a.url === b.url && a.doctype === b.doctype && a.name === b.name;
}

function basename(url) {
	return decodeURIComponent(url.split("/").pop().split("?")[0]);
}

function ext_of(name) {
	return (name.split(".").pop() || "file").slice(0, 5).toUpperCase();
}

/* ------------------------------------------------------------------ peek -- */

function ensure_peek() {
	if (peek) return;
	peek = document.createElement("div");
	peek.className = "aurora-ql-peek";
	document.body.appendChild(peek);
	peek.addEventListener("click", () => current && expand(current));
	peek.addEventListener("mouseenter", () => clearTimeout(hover_timer));
	peek.addEventListener("mouseleave", hide_peek);
}

function place_peek(x, y) {
	const pad = 14;
	const rect = peek.getBoundingClientRect();
	let left = x + pad;
	let top = y + pad;
	if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
	if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
	peek.style.left = `${Math.max(8, left)}px`;
	peek.style.top = `${Math.max(8, top)}px`;
}

function shell(body, hint = "Space to open") {
	return `${body}<div class="aurora-ql-hint"><kbd>space</kbd><span>${hint}</span></div>`;
}

function show_peek(target, x, y) {
	ensure_peek();
	current = target;
	peek.classList.add("open");
	peek.dataset.kind = target.kind;

	if (target.kind === "image") {
		peek.innerHTML = shell(`<img class="aurora-ql-thumb" src="${target.url}" alt="">`);
		place_peek(x, y);
		peek.querySelector("img")?.addEventListener("load", () => place_peek(x, y), { once: true });
		return;
	}

	if (target.kind === "pdf" || target.kind === "file" || target.kind === "sheet") {
		const name = basename(target.url);
		peek.innerHTML = shell(
			`<div class="aurora-ql-file">
				<span class="aurora-ql-file-ext">${ext_of(name)}</span>
				<span class="aurora-ql-file-name">${frappe.utils.escape_html(name)}</span>
			</div>`
		);
		place_peek(x, y);
		return;
	}

	peek.innerHTML = shell(
		`<div class="aurora-ql-doc">
			<div class="aurora-ql-doc-head"><div>
				<span class="aurora-ql-dt">${frappe.utils.escape_html(target.doctype)}</span>
				<span class="aurora-ql-name">${frappe.utils.escape_html(target.name)}</span>
			</div></div>
			<div class="aurora-ql-skeleton"><i></i><i></i><i></i></div>
		</div>`
	);
	place_peek(x, y);

	frappe
		.xcall("aurora.api.preview_doc", { doctype: target.doctype, name: target.name })
		.then((data) => {
			// the pointer may have moved on while we were fetching
			if (!same_target(current, target) || !peek.classList.contains("open")) return;
			if (!data || !data.name) return;
			peek.innerHTML = shell(render_doc(data), "Space to open & edit");
			place_peek(x, y);
		})
		.catch(() => {
			if (!same_target(current, target)) return;
			peek.innerHTML = shell(
				`<div class="aurora-ql-doc"><div class="aurora-ql-empty">No preview available</div></div>`
			);
		});
}

function render_doc(d) {
	const status =
		d.status ||
		(d.docstatus === 1
			? "Submitted"
			: d.docstatus === 2
			? "Cancelled"
			: d.docstatus === 0
			? "Draft"
			: "");

	const rows = (d.fields || [])
		.map(
			(f) =>
				`<div class="aurora-ql-row"><span>${frappe.utils.escape_html(
					f.label
				)}</span><b>${frappe.utils.escape_html(String(f.value))}</b></div>`
		)
		.join("");

	return `<div class="aurora-ql-doc">
		<div class="aurora-ql-doc-head">
			${d.image ? `<img class="aurora-ql-avatar" src="${d.image}" alt="">` : ""}
			<div>
				<span class="aurora-ql-dt">${frappe.utils.escape_html(d.doctype)}</span>
				<span class="aurora-ql-name">${frappe.utils.escape_html(d.title || d.name)}</span>
			</div>
			${status ? `<span class="aurora-ql-status">${frappe.utils.escape_html(status)}</span>` : ""}
		</div>
		${rows ? `<div class="aurora-ql-rows">${rows}</div>` : ""}
	</div>`;
}

function hide_peek() {
	clearTimeout(hover_timer);
	current = null;
	peek?.classList.remove("open");
}

/* ----------------------------------------------------------------- panel -- */

function ensure_panel() {
	if (panel) return;
	backdrop = document.createElement("div");
	backdrop.className = "aurora-ql-backdrop";
	backdrop.addEventListener("click", close_panel);

	panel = document.createElement("div");
	panel.className = "aurora-ql-panel";
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", "Quick Look");

	document.body.appendChild(backdrop);
	document.body.appendChild(panel);
}

function doc_route(target) {
	return `/app/${frappe.router.slug(target.doctype)}/${encodeURIComponent(target.name)}`;
}

function expand(target) {
	ensure_panel();
	hide_peek();
	panel_open = true;
	expanded = target;

	const title =
		target.kind === "doc" ? `${target.doctype} · ${target.name}` : basename(target.url);
	const open_href = target.kind === "doc" ? doc_route(target) : target.url;

	panel.innerHTML = `
		<div class="aurora-ql-panel-head">
			<div class="aurora-ql-panel-title" title="${frappe.utils.escape_html(title)}">
				${frappe.utils.escape_html(title)}
			</div>
			<div class="aurora-ql-panel-actions">
				<a class="aurora-ql-btn" href="${open_href}" ${
					target.kind === "doc" ? "" : 'target="_blank" rel="noopener"'
				}>Open</a>
				${
					/* no Download for a doc, and none for an externally hosted image:
					   browsers ignore the `download` attribute cross-origin, so the
					   button would look live and do nothing. Open still works. */
					target.kind !== "doc" && !is_external(target.url)
						? `<a class="aurora-ql-btn" href="${target.url}" download>Download</a>`
						: ""
				}
				<button type="button" class="aurora-ql-close" aria-label="Close">${icon("close", 15)}</button>
			</div>
		</div>
		<div class="aurora-ql-panel-body">${panel_body(target)}</div>`;

	panel.querySelector(".aurora-ql-close").addEventListener("click", close_panel);

	// routing inside the desk should not reload the whole app
	if (target.kind === "doc") {
		panel.querySelector('a.aurora-ql-btn[href^="/app/"]')?.addEventListener("click", (e) => {
			e.preventDefault();
			close_panel();
			frappe.set_route("Form", target.doctype, target.name);
		});
		const frame = panel.querySelector("iframe");
		frame?.addEventListener(
			"load",
			() => {
				panel.querySelector(".aurora-ql-loading")?.remove();
				strip_frame_chrome(frame);
			},
			{ once: true }
		);
	}

	if (target.kind === "sheet") load_sheet(target);

	requestAnimationFrame(() => {
		backdrop.classList.add("open");
		panel.classList.add("open");
	});
}

function panel_body(target) {
	if (target.kind === "image") {
		return `<div class="aurora-ql-stage"><img src="${target.url}" alt=""></div>`;
	}
	if (target.kind === "pdf") {
		return `<iframe class="aurora-ql-frame" src="${target.url}#view=FitH" title="PDF preview"></iframe>`;
	}
	if (target.kind === "sheet") {
		// filled in by load_sheet once the server has parsed the workbook
		return `<div class="aurora-ql-sheet"><div class="aurora-ql-loading"><i></i><i></i><i></i></div></div>`;
	}
	if (target.kind === "doc") {
		// the real desk form, so it is genuinely interactive — edit and save
		return `<div class="aurora-ql-loading"><i></i><i></i><i></i></div>
			<iframe class="aurora-ql-frame" src="${doc_route(target)}" title="Document preview"></iframe>`;
	}
	const name = basename(target.url);
	return `<div class="aurora-ql-stage aurora-ql-stage-empty">
		<div class="aurora-ql-file-ext big">${ext_of(name)}</div>
		<p>${frappe.utils.escape_html(name)}</p>
		<p class="aurora-ql-muted">This file type can't be previewed in the browser.</p>
	</div>`;
}

/* ---------------------------------------------------------------- sheets -- */

/**
 * A browser has no idea what an .xlsx is, so the server parses it (openpyxl is
 * already a frappe dependency) and hands back a capped grid. That is a round
 * trip, but it is only paid when the user actually opens a spreadsheet, and it
 * keeps a few hundred KB of spreadsheet parser out of every desk page load.
 */
function load_sheet(target, sheet_name) {
	const host = panel.querySelector(".aurora-ql-sheet");
	if (!host) return;

	frappe
		.xcall("aurora.api.preview_sheet", { file_url: target.url, sheet: sheet_name || null })
		.then((data) => {
			// the user may have closed it, or opened something else, meanwhile
			if (!panel_open || !same_target(expanded, target)) return;
			host.innerHTML = render_sheet(data);
			bind_sheet_tabs(target);
		})
		.catch(() => {
			if (!panel_open || !same_target(expanded, target)) return;
			host.innerHTML = `<div class="aurora-ql-sheet-msg">This spreadsheet could not be read.</div>`;
		});
}

function render_sheet(data) {
	if (!data || data.unsupported) {
		return `<div class="aurora-ql-sheet-msg">
			<p>This spreadsheet format can't be previewed.</p>
			<p class="aurora-ql-muted">Only .xlsx, .xlsm and .csv can be read — the old .xls
			format cannot. Use Download to open it locally.</p>
		</div>`;
	}

	const rows = data.rows || [];
	if (!rows.length) return `<div class="aurora-ql-sheet-msg">This sheet is empty.</div>`;

	const esc = (v) => frappe.utils.escape_html(String(v ?? ""));
	const [head, ...body] = rows;

	const tabs =
		(data.sheets || []).length > 1
			? `<div class="aurora-ql-sheet-tabs">${data.sheets
					.map(
						(s) =>
							`<button type="button" class="aurora-ql-sheet-tab${
								s === data.sheet ? " active" : ""
							}" data-sheet="${esc(s)}">${esc(s)}</button>`
					)
					.join("")}</div>`
			: "";

	// first row as the header: near-universal for spreadsheets, and a plain
	// grid with no header row is much harder to read
	const table = `<table class="aurora-ql-sheet-table">
		<thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
		<tbody>${body
			.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
			.join("")}</tbody>
	</table>`;

	// never let a capped grid pass for the whole file
	const note = data.truncated
		? `<div class="aurora-ql-sheet-note">Showing the first ${rows.length} of
			${esc(data.total_rows)} rows. Download the file to see all of it.</div>`
		: "";

	return `${tabs}<div class="aurora-ql-sheet-scroll">${table}</div>${note}`;
}

function bind_sheet_tabs(target) {
	panel.querySelectorAll(".aurora-ql-sheet-tab").forEach((btn) => {
		btn.addEventListener("click", () => {
			const host = panel.querySelector(".aurora-ql-sheet");
			if (host) host.innerHTML = `<div class="aurora-ql-loading"><i></i><i></i><i></i></div>`;
			load_sheet(target, btn.dataset.sheet);
		});
	});
}

/** Hide the desk's own chrome inside the document iframe. Same-origin, so this
 *  is allowed; wrapped anyway because a failure here is purely cosmetic. */
function strip_frame_chrome(frame) {
	try {
		const doc = frame.contentDocument;
		if (!doc?.head) return;
		const style = doc.createElement("style");
		style.textContent = FRAME_CSS;
		doc.head.appendChild(style);
	} catch (e) {
		/* not reachable — leave the frame as core rendered it */
	}
}

function close_panel() {
	if (!panel_open) return;
	panel_open = false;
	expanded = null;
	panel.classList.remove("open");
	backdrop.classList.remove("open");
	const clear = () => {
		if (!panel_open) panel.innerHTML = "";
	};
	motion_off() ? clear() : setTimeout(clear, 280);
}

/* ------------------------------------------------- core's own previews -- */

/**
 * Frappe ships two hover previews of its own, on the very elements Quick Look
 * claims — `frappe.ui.LinkPreview` binds `mouseover` to
 * `a[data-doctype], input[data-fieldtype="Link"]` (link_preview.js), and
 * `ControlAttachImage` hangs a Bootstrap popover off `.attached-file-link`.
 * Left alone the user gets two cards stacked on top of each other.
 *
 * Quick Look supersedes both — it previews any DocType the user may read
 * rather than only those flagged `show_preview_popup`, and it can be expanded
 * into something editable — so it turns them off instead of competing. The
 * prototype is patched rather than the instances, because `desk.js` has
 * already constructed LinkPreview by the time we get here, and method lookup
 * still goes through the prototype.
 */
function suppress_core_previews() {
	const LinkPreview = window.frappe?.ui?.LinkPreview;
	if (LinkPreview?.prototype && !LinkPreview.prototype.aurora_suppressed) {
		LinkPreview.prototype.aurora_suppressed = true;
		LinkPreview.prototype.setup_popover_control = function () {};
	}

	const AttachImage = window.frappe?.ui?.form?.ControlAttachImage;
	if (AttachImage?.prototype && !AttachImage.prototype.aurora_suppressed) {
		AttachImage.prototype.aurora_suppressed = true;
		const make_input = AttachImage.prototype.make_input;
		// wrap rather than replace, so anything else core does here survives
		AttachImage.prototype.make_input = function (...args) {
			const out = make_input.apply(this, args);
			try {
				this.$value?.find(".attached-file-link").popover("dispose");
			} catch (e) {
				/* core changed shape — the duplicate card is cosmetic */
			}
			return out;
		};
	}
}

/* ------------------------------------------------------------------ wire -- */

export function init() {
	suppress_core_previews();

	document.addEventListener(
		"pointerover",
		(e) => {
			if (!feature("quicklook") || panel_open) return;

			const target = describe(e.target);
			if (!target) {
				if (current && !peek?.matches(":hover")) hide_peek();
				return;
			}
			if (same_target(current, target)) return;

			clearTimeout(hover_timer);
			const { clientX, clientY } = e;
			hover_timer = setTimeout(() => show_peek(target, clientX, clientY), HOVER_DELAY);
		},
		{ passive: true }
	);

	document.addEventListener(
		"pointerout",
		(e) => {
			if (!current) return;
			const to = e.relatedTarget;
			if (to && (peek?.contains(to) || describe(to))) return;
			clearTimeout(hover_timer);
			hide_peek();
		},
		{ passive: true }
	);

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && panel_open) {
			e.preventDefault();
			close_panel();
			return;
		}
		if (e.code !== "Space" && e.key !== " ") return;
		// never steal the space bar from someone typing
		if (document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) return;
		if (!current || panel_open) return;
		e.preventDefault();
		expand(current);
	});

	// a route change must not leave a panel hanging over the new page
	$(document).on("page-change", () => {
		hide_peek();
		close_panel();
	});

	/* A frappe dialog must always win.
	 *
	 * Bootstrap puts `.modal-backdrop` at 1040 and `.modal` at 1050, so the
	 * Quick Look surfaces are pinned just under that (1031-1033 in
	 * _quicklook.scss) — but stacking alone is not enough. A confirm dialog
	 * opening behind an already-open panel would still be unreachable, because
	 * our backdrop covers the screen and takes pointer events. So the panel gets
	 * out of the way entirely whenever a dialog appears. */
	$(document).on("show.bs.modal", () => {
		hide_peek();
		close_panel();
	});
}
