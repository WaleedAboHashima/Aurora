"""Aurora theme — server side.

The theme is configured entirely from the in-app Appearance panel, so all this
module has to do is give that panel somewhere durable to write. Preferences are
stored per user in `tabDefaultValue` (frappe's user-defaults store), which means:

  * no new DocType, no migration, no permissions to maintain;
  * the value is already loaded into the session cache, so exposing it through
    `extend_bootinfo` costs nothing extra on page load;
  * one user changing their accent has no effect on anyone else.

The browser also keeps a localStorage copy, so the theme paints correctly before
boot data arrives and still works offline. The server copy is what makes a
user's theme follow them to another browser or device.
"""

import json

import frappe

DEFAULT_KEY = "aurora_theme"

# Only these keys are ever persisted. Anything else the client sends is dropped,
# so a stale or tampered payload can't grow the stored blob without bound.
ALLOWED_KEYS = {
	"hue",
	"sat",
	"shape",
	"density",
	"motion",
	"ambient",
	"backdrop",  # legacy; migrated to `ambient` in the browser
	"font",
	"font_custom",
	"toast_position",
	"features",
}

MAX_PAYLOAD = 4000


def _clean(raw: dict) -> dict:
	"""Keep known keys, coerce to the expected shapes."""
	out = {}
	for key, value in raw.items():
		if key not in ALLOWED_KEYS:
			continue
		if key == "features":
			if isinstance(value, dict):
				out[key] = {str(k): bool(v) for k, v in value.items()}
		elif key in ("hue", "sat"):
			try:
				out[key] = max(0, min(360, int(value)))
			except (TypeError, ValueError):
				continue
		elif key == "backdrop":
			out[key] = bool(value)
		elif key == "font_custom":
			# family names run longer than the other short enum values
			out[key] = str(value)[:64]
		else:
			out[key] = str(value)[:32]
	return out


@frappe.whitelist()
def save_theme(settings: str | dict) -> dict:
	"""Persist the calling user's appearance preferences.

	Guests get a no-op rather than an error: the panel still works for them via
	localStorage, there is just nothing to save it against.
	"""
	if frappe.session.user == "Guest":
		return {"saved": False, "reason": "guest"}

	if isinstance(settings, str):
		if len(settings) > MAX_PAYLOAD:
			frappe.throw(frappe._("Theme settings payload is too large"))
		try:
			settings = json.loads(settings)
		except ValueError:
			frappe.throw(frappe._("Invalid theme settings"))

	if not isinstance(settings, dict):
		frappe.throw(frappe._("Invalid theme settings"))

	cleaned = _clean(settings)
	frappe.defaults.set_user_default(DEFAULT_KEY, json.dumps(cleaned))
	return {"saved": True, "settings": cleaned}


@frappe.whitelist()
def get_theme() -> dict:
	"""Read back the calling user's preferences (used as a fallback if boot is stale)."""
	return _read(frappe.session.user)


def _read(user: str) -> dict:
	if user == "Guest":
		return {}
	raw = frappe.defaults.get_user_default(DEFAULT_KEY, user)
	if not raw:
		return {}
	try:
		parsed = json.loads(raw)
	except ValueError:
		return {}
	return _clean(parsed) if isinstance(parsed, dict) else {}


def boot_session(bootinfo):
	"""Ship the user's theme with the desk boot payload (hooks.extend_bootinfo)."""
	try:
		bootinfo.aurora_theme = _read(frappe.session.user)
	except Exception:
		# a theme must never be able to break the desk from booting
		bootinfo.aurora_theme = {}


# =============================================================================
# Quick Look
# =============================================================================
# frappe.desk.link_preview.get_preview_data returns nothing unless the DocType
# has `show_preview_popup` enabled, which is off for almost everything — so
# relying on it would leave most link fields with no preview at all. This builds
# a preview for any DocType the user is allowed to read.
#
# Permissions are enforced twice on purpose: has_permission() for the read
# right (including User Permissions on the specific record), and get_list()
# below, which applies the same rules again at query level.

PREVIEW_FIELD_LIMIT = 6


@frappe.whitelist()
def preview_doc(doctype: str, name: str) -> dict:
	"""Compact, permission-checked summary of one document, for the hover card."""
	if not frappe.has_permission(doctype, "read", doc=name):
		frappe.throw(frappe._("Not permitted to read {0}").format(doctype), frappe.PermissionError)

	meta = frappe.get_meta(doctype)

	from frappe.model import no_value_fields, table_fields

	def usable(df):
		return df.fieldtype not in no_value_fields and df.fieldtype not in table_fields

	# prefer what the DocType author marked for preview, then the list view,
	# then whatever is mandatory — in that order of intent
	chosen = [df for df in meta.fields if getattr(df, "in_preview", 0) and usable(df)]
	if not chosen:
		chosen = [df for df in meta.fields if getattr(df, "in_list_view", 0) and usable(df)]
	if not chosen:
		chosen = [df for df in meta.fields if df.reqd and usable(df)]
	chosen = chosen[:PREVIEW_FIELD_LIMIT]

	title_field = meta.get_title_field()
	image_field = getattr(meta, "image_field", None)

	wanted = {"name", "modified", "owner"}
	wanted.update(df.fieldname for df in chosen)
	if title_field:
		wanted.add(title_field)
	if image_field:
		wanted.add(image_field)
	if meta.is_submittable:
		wanted.add("docstatus")
	if meta.get_field("status"):
		wanted.add("status")

	valid = {df.fieldname for df in meta.fields} | {"name", "modified", "owner", "docstatus"}
	fields = sorted(wanted & valid)

	rows = frappe.get_list(doctype, filters={"name": name}, fields=fields, limit=1, ignore_ifnull=True)
	if not rows:
		return {}
	row = rows[0]

	values = []
	for df in chosen:
		value = row.get(df.fieldname)
		if value in (None, "", 0):
			continue
		try:
			text = frappe.format_value(value, df=df, doc=row)
		except Exception:
			text = str(value)
		values.append({"label": frappe._(df.label or df.fieldname), "value": text})

	return {
		"doctype": doctype,
		"name": row.get("name"),
		"title": row.get(title_field) if title_field else row.get("name"),
		"image": row.get(image_field) if image_field else None,
		"status": row.get("status"),
		"docstatus": row.get("docstatus"),
		"modified": row.get("modified"),
		"fields": values,
	}


@frappe.whitelist()
def preview_file(file_url: str) -> dict:
	"""Metadata for a file, so the panel can show a name, size and type."""
	if not file_url:
		return {}

	name = _find_file(file_url)
	if not name:
		# not a File record (a static asset, say). Nothing to leak: the caller
		# already had the url, and there is no record to describe.
		return {"file_url": file_url, "file_name": file_url.rsplit("/", 1)[-1]}

	doc = frappe.get_doc("File", name)

	# same gate as the sheet reader — an earlier version only checked when the
	# file was BOTH private AND attached, so an unattached private file handed
	# back its name and size to any logged-in user
	_check_read(doc)

	return {
		"name": doc.name,
		"file_name": doc.file_name,
		"file_size": doc.file_size,
		"is_private": doc.is_private,
		"attached_to_doctype": doc.attached_to_doctype,
		"attached_to_name": doc.attached_to_name,
		# the canonical url, which may differ from what the caller sent
		"file_url": doc.file_url,
	}


# =============================================================================
# Spreadsheets
# =============================================================================
# Browsers render images and PDFs natively but have no idea what an .xlsx is, so
# a spreadsheet is the one attachment Quick Look cannot simply point an iframe
# at. It is parsed here rather than in the browser because openpyxl is already a
# frappe dependency, whereas a client-side parser (SheetJS and friends) would
# add a few hundred KB to *every* desk page load for a feature most users touch
# occasionally. Doing it server-side also keeps the permission check and the
# read on the same side of the wire.

SHEET_MAX_ROWS = 200
SHEET_MAX_COLS = 40
SHEET_MAX_CELL_LEN = 300
SHEET_EXTENSIONS = (".xlsx", ".xlsm")


def _check_read(doc) -> None:
	"""Refuse unless the caller may already see this file's contents.

	Attachment first: a file attached to a document inherits that document's
	confidentiality, and that is the check that actually carries meaning — a
	quotation PDF is exactly as private as the quotation. Otherwise fall back to
	File's own rules, which include any User Permissions on the record.

	Deliberately applied to public files as well as private ones. Being served
	without a session is a property of the *web request* for a public file; it is
	not a licence for this API to parse the bytes and hand them to whoever asks.
	"""
	if doc.attached_to_doctype and doc.attached_to_name:
		if not frappe.has_permission(doc.attached_to_doctype, "read", doc=doc.attached_to_name):
			frappe.throw(frappe._("Not permitted"), frappe.PermissionError)
		return

	doc.check_permission("read")


def _find_file(file_url: str) -> str | None:
	"""File.name for a url, tolerating percent-encoding differences.

	`file_url` is matched as an exact string, and the url the browser holds is
	not always the string the database holds: frappe's own
	`Attachments.get_file_url()` runs the value through `encodeURI()`, so a
	filename containing a space or any non-ASCII character arrives here as
	`%20`/`%D8%A7` while the column still has the raw character.

	Public files never expose this, because they are served straight off disk by
	the static handler and no lookup happens. Private files must resolve through
	a lookup, so they 404 on the mismatch — which is why "I can't view it" shows
	up only once a file is marked private. Core has the same fragility in
	`find_file_by_url`; there is nothing to fix there from here, but this API at
	least does not have to inherit it.
	"""
	from urllib.parse import quote, unquote

	seen = set()
	for candidate in (file_url, unquote(file_url), quote(file_url, safe="/:?#[]@!$&'()*+,;=~")):
		if not candidate or candidate in seen:
			continue
		seen.add(candidate)
		name = frappe.db.get_value("File", {"file_url": candidate}, "name")
		if name:
			return name
	return None


def _resolve_readable_file(file_url: str):
	"""The File record for `file_url`, once the caller is allowed to read it.

	Only real File records are resolvable. An arbitrary path is never joined to
	the site directory — the doc's own `get_full_path()` is what turns a url into
	a path, and it refuses anything outside the files directories.
	"""
	name = _find_file(file_url)
	if not name:
		frappe.throw(frappe._("File not found"), frappe.DoesNotExistError)

	doc = frappe.get_doc("File", name)
	_check_read(doc)
	return doc


def _cell_text(value) -> str:
	if value is None:
		return ""
	if isinstance(value, bool):
		return "1" if value else "0"
	text = value if isinstance(value, str) else str(value)
	return text[:SHEET_MAX_CELL_LEN]


@frappe.whitelist()
def preview_sheet(file_url: str, sheet: str | None = None) -> dict:
	"""A capped grid of cells from a spreadsheet, for the Quick Look viewer.

	Returns the sheet names too, so the viewer can offer tabs without a second
	round trip. `truncated` tells the client the grid was cut, so it can say so
	rather than quietly showing a partial file as if it were whole.
	"""
	if not file_url:
		return {}

	doc = _resolve_readable_file(file_url)
	name = (doc.file_name or file_url).lower()

	if name.endswith(".csv"):
		return _preview_csv(doc)
	if not name.endswith(SHEET_EXTENSIONS):
		# .xls is the old OLE2 format, which openpyxl cannot read at all
		return {"unsupported": True, "file_name": doc.file_name, "file_url": doc.file_url}

	from openpyxl import load_workbook

	# read_only streams rather than building the whole object graph; data_only
	# hands back the cached result of a formula instead of the formula text
	book = load_workbook(doc.get_full_path(), read_only=True, data_only=True)
	try:
		names = list(book.sheetnames)
		active = sheet if sheet in names else (names[0] if names else None)
		if not active:
			return {"file_name": doc.file_name, "sheets": [], "rows": []}

		ws = book[active]
		rows = []
		truncated_cols = False
		for row in ws.iter_rows(max_row=SHEET_MAX_ROWS, values_only=True):
			if len(row) > SHEET_MAX_COLS:
				truncated_cols = True
			rows.append([_cell_text(c) for c in row[:SHEET_MAX_COLS]])

		# openpyxl reports dimensions before the cap, so compare against those
		total_rows = ws.max_row or len(rows)

		return {
			"file_name": doc.file_name,
			# the url as stored, so the client's Open/Download links cannot
			# inherit whatever encoding it happened to send us
			"file_url": doc.file_url,
			"sheets": names,
			"sheet": active,
			"rows": rows,
			"total_rows": total_rows,
			"truncated": bool(total_rows and total_rows > len(rows)) or truncated_cols,
		}
	finally:
		book.close()


def _preview_csv(doc) -> dict:
	import csv
	import io

	content = doc.get_content()
	if isinstance(content, bytes):
		content = content.decode("utf-8", errors="replace")

	rows = []
	for i, row in enumerate(csv.reader(io.StringIO(content))):
		if i >= SHEET_MAX_ROWS:
			break
		rows.append([_cell_text(c) for c in row[:SHEET_MAX_COLS]])

	return {
		"file_name": doc.file_name,
		"file_url": doc.file_url,
		"sheets": [doc.file_name or "CSV"],
		"sheet": doc.file_name or "CSV",
		"rows": rows,
		"total_rows": len(rows),
		"truncated": len(rows) >= SHEET_MAX_ROWS,
	}
