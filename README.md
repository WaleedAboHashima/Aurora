# Aurora

A per-user appearance layer for Frappe and ERPNext **v16**.

Accent colour, typeface, density, corner radius, light/dark, redesigned charts —
and a Quick Look preview system borrowed from macOS. Every setting is per-user,
so two people on the same site can run completely different themes.

No forked core files. One custom app, hooks only.

```bash
bench get-app https://github.com/WaleedAboHashima/Aurora --branch version-16
bench --site your-site install-app aurora
bench build --app aurora
```

Then open the Appearance panel from the dock in the bottom-right corner, or press
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> for quick actions.

---

## What it does

**Appearance, per user.** Accent hue and saturation, font (any family — typed
names resolve from your machine, or are fetched from Google Fonts if you don't
have them), three corner-radius presets, three density presets, light/dark/system,
and an ambient background.

Preferences are stored per user in `tabDefaultValue` and shipped with the desk
boot payload, so there's no new DocType, no migration, and one user changing
their accent has no effect on anyone else. A localStorage copy means the theme
paints before boot data arrives.

**Quick Look.** Hover any attachment, image or PDF for an instant preview near
the cursor. Hover a link field and see the actual record — permission-checked,
so you only ever see what you could already read. Press <kbd>Space</kbd> and it
opens full-size and editable without leaving the page.

Spreadsheets included: `.xlsx`, `.xlsm` and `.csv` render as real tables with
sticky headers and sheet tabs. Parsed server-side with openpyxl, which is
already a Frappe dependency — no multi-hundred-KB spreadsheet parser added to
every desk page load.

**Charts and dashboards.** Series colours derived from your live accent using
golden-angle hue stepping, so any number of series stays distinguishable.
Rounded bars, smoothed splines with tinted regions, dashed gridlines, and
entrance motion. Charts already on screen repaint when you change the accent —
no reload.

**18 individual toggles.** Everything expressive can be switched off
independently:

| | | |
|---|---|---|
| Page transitions | Loading bar | Click ripples |
| Staggered lists | Card sheen | Number count-up |
| Condensing header | Back to top | Toast timers |
| Save feedback | Quick actions | Chart theming |
| Card styling | Tint app icons | Auto-hide dock |
| Gradients | Quick Look | Sign-in entrance |

Plus a master motion switch, and `prefers-reduced-motion` is respected
throughout regardless of settings.

---

## Requirements

- **Frappe v16.** Non-negotiable — Aurora hooks into desk class names, the
  `.icon`/`.es-icon` split and the boot payload, none of which are stable across
  a major version. It will not work on v14 or v15, and `pyproject.toml` declares
  `frappe = ">=16.0.0-dev,<17.0.0"` so bench will refuse rather than half-install.
- **ERPNext is optional.** Aurora themes it if present but doesn't require it.
- Python ≥ 3.14 (same as Frappe v16).

## Known issues

Being honest about what isn't finished:

- **Report view** — the frozen first column clips its text when scrolled
  horizontally.
- **Tree view** — functional but not yet restyled.
- **Dropdowns** — a stacking issue in some report toolbars.
- **List view tables** — spacing and alignment still being worked through.

Everything else has been used daily on a real site. Issues and PRs welcome —
see [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

```bash
cd apps/aurora
pre-commit install
```

`ruff`, `eslint`, `prettier` and `pyupgrade` run on commit.

**Turn on `developer_mode`** if you're editing styles, or Frappe caches the
asset manifest in Redis and your rebuilds won't be served — a restart won't
clear it either:

```bash
bench set-config -g developer_mode 1
```

Then `bench build --app aurora` and hard-refresh.

Source layout: `aurora/public/scss/theme/` for the desk,
`aurora/public/scss/web/` for the sign-in and public pages,
`aurora/public/js/theme/` for behaviour, one module per feature.

## Support

**Issues welcome on GitHub. No SLA** — this is free software maintained in spare
time, and I'd rather set that expectation than quietly disappoint.

If you need something more dependable, two things I do offer commercially:

- **Brand-matched builds** — a client's exact colour, licensed typeface and logo
  baked in, rather than approximated from the settings panel.
- **Compatibility retainers** — for agencies running Aurora across many client
  sites who need upgrades not to break them. Each major Frappe release needs
  compatibility work; this covers doing it on a schedule you can plan around.

Reach out via [GitHub issues](https://github.com/WaleedAboHashima/Aurora/issues)
or LinkedIn.

## Licence

**GNU General Public License v3.0 or later.** See [LICENSE](LICENSE) for the
full text.

Free to use on any number of sites, including client work and commercial use.
Install it, modify it, deploy it for clients, fork it — all fine, and no
permission needed. The one obligation is the usual copyleft one: if you
distribute Aurora or a derivative of it, the recipient gets the source and the
same freedoms under the same licence. You cannot take Aurora closed and ship it
as a proprietary theme.

Note that Frappe Framework is MIT and ERPNext is GPLv3; Aurora's choice of GPL
is its own, not an obligation inherited from either.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). If Aurora
saved you time, a star or a mention is plenty.
