app_name = "aurora"
app_title = "Aurora"
app_publisher = "Waleed AboHashima"
app_description = "A per-user appearance layer for Frappe and ERPNext v16"
app_email = "waleedsabry.abohashima@gmail.com"
app_license = "Aurora Licence (free to use, not redistributable)"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "aurora",
# 		"logo": "/assets/aurora/logo.png",
# 		"title": "Aurora",
# 		"route": "/aurora",
# 		"has_permission": "aurora.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# Aurora theme — these bundles are built by esbuild from
# aurora/public/scss/aurora.bundle.scss and aurora/public/js/aurora.bundle.js.
# They are injected after frappe's and erpnext's own bundles, which is what lets
# the theme override desk styling without patching either app.
app_include_css = "aurora.bundle.css"
app_include_js = "aurora.bundle.js"

# Ship each user's saved appearance preferences with the desk boot payload, so
# the theme can restore their accent/density/feature choices on any device.
extend_bootinfo = ["aurora.api.boot_session"]

# include js, css files in header of web template
# The public-site bundle covers login / signup / password reset. It is separate
# from the desk bundle on purpose: it is small and tightly scoped, so it cannot
# restyle a customer's portal or website pages.
web_include_css = "aurora_web.bundle.css"
web_include_js = "aurora_web.bundle.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "aurora/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "aurora/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "aurora.utils.jinja_methods",
# 	"filters": "aurora.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "aurora.install.before_install"
# after_install = "aurora.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "aurora.uninstall.before_uninstall"
# after_uninstall = "aurora.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "aurora.utils.before_app_install"
# after_app_install = "aurora.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "aurora.utils.before_app_uninstall"
# after_app_uninstall = "aurora.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "aurora.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "aurora.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"aurora.tasks.all"
# 	],
# 	"daily": [
# 		"aurora.tasks.daily"
# 	],
# 	"hourly": [
# 		"aurora.tasks.hourly"
# 	],
# 	"weekly": [
# 		"aurora.tasks.weekly"
# 	],
# 	"monthly": [
# 		"aurora.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "aurora.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "aurora.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "aurora.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "aurora.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["aurora.utils.before_request"]
# after_request = ["aurora.utils.after_request"]

# Job Events
# ----------
# before_job = ["aurora.utils.before_job"]
# after_job = ["aurora.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"aurora.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

