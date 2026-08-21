# Copyright (c) 2026, Waleed AboHashima and Contributors
# License: GNU General Public License v3. See LICENSE

app_name = "aurora"
app_title = "Aurora"
app_publisher = "Waleed AboHashima"
app_description = "A per-user appearance layer for Frappe and ERPNext v16"
app_email = "waleedsabry.abohashima@gmail.com"
app_license = "GPL-3.0-or-later"

# Assets
# ------------------
# Aurora theme — these bundles are built by esbuild from
# aurora/public/scss/aurora.bundle.scss and aurora/public/js/aurora.bundle.js.
# They are injected after frappe's and erpnext's own bundles, which is what lets
# the theme override desk styling without patching either app.
app_include_css = "aurora.bundle.css"
app_include_js = "aurora.bundle.js"

# The public-site bundle covers login / signup / password reset. It is separate
# from the desk bundle on purpose: it is small and tightly scoped, so it cannot
# restyle a customer's portal or website pages.
web_include_css = "aurora_web.bundle.css"
web_include_js = "aurora_web.bundle.js"

# Boot
# ------------------
# Ship each user's saved appearance preferences with the desk boot payload, so
# the theme can restore their accent/density/feature choices on any device.
extend_bootinfo = ["aurora.api.boot_session"]
