# Contributing to Aurora

Issues and pull requests are welcome. **No SLA** — Aurora is maintained in spare
time, and I'd rather set that expectation than quietly disappoint.

## Licence and sign-off

Aurora is [GPL-3.0-or-later](LICENSE). Contributions are accepted under that
same licence — there is no CLA and no copyright assignment. You keep your
copyright; you just licence your contribution to the project under the GPL.

To confirm that, sign off your commits with the
[Developer Certificate of Origin](https://developercertificate.org/):

```bash
git commit -s -m "your message"
```

The `-s` appends a line like:

```
Signed-off-by: Your Name <your.email@example.com>
```

That line means you wrote the patch, or otherwise have the right to submit it
under the GPL. It is a statement about provenance, not a transfer of anything.

## Before you open a PR

Install the hooks — `ruff`, `eslint` and `prettier` run on commit:

```bash
cd apps/aurora
pre-commit install
```

Turn on `developer_mode` if you're editing styles, or Frappe caches the asset
manifest in Redis and your rebuilds won't be served — a restart won't clear it
either:

```bash
bench set-config -g developer_mode 1
bench build --app aurora
```

Then hard-refresh.

## Source layout

| Path | What lives there |
|---|---|
| `aurora/public/scss/theme/` | Desk styling, one partial per surface |
| `aurora/public/scss/web/` | Sign-in and public pages |
| `aurora/public/js/theme/` | Behaviour, one module per feature |
| `aurora/api.py` | The whitelisted server endpoints |
| `aurora/hooks.py` | Bundle injection and the boot hook |

## Things worth knowing

**Every expressive feature needs a toggle.** Aurora has 18 of them, plus a
master motion switch, and `prefers-reduced-motion` is honoured regardless. If
you add something that moves, animates or decorates, wire it to `feature()` in
`settings.js` so it can be switched off.

**Permissions are checked server-side, twice.** Quick Look can surface any
document a user can read, which makes `api.py` security-relevant in a way a
theme normally isn't. `preview_doc` gates on `has_permission` *and* goes through
`get_list`; `_check_read` resolves attachment permissions from the parent
document. Don't loosen either without a good reason.

**The theme must never be able to break desk boot.** `boot_session` swallows
exceptions deliberately. Keep it that way.

**No forked core files.** Aurora is hooks and CSS only. If a change seems to
require patching Frappe or ERPNext, it belongs somewhere other than this repo.

## Known rough edges

Listed in the README under "Known issues" — report view's frozen column, tree
view styling, dropdown stacking in report toolbars, and list view table spacing.
Fixes for any of those are especially welcome.
