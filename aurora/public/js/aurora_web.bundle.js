/**
 * Aurora — public site bundle (login, signup, password reset).
 *
 * The login page runs before anyone is authenticated, so there is no user
 * record to read a theme from. What there IS, on a returning user's own device,
 * is the localStorage copy the desk writes. Reading it here means signing in
 * looks like the desk you left — same accent, same corner style, same typeface —
 * instead of a stock page followed by a jarring switch.
 *
 * Written straight to the root element and kept tiny on purpose: this runs on
 * every public page, so it must not cost anything measurable.
 */
(function () {
	var KEY = "aurora:settings";
	var root = document.documentElement;
	if (!root) return;

	var saved;
	try {
		saved = JSON.parse(window.localStorage.getItem(KEY) || "{}");
	} catch (e) {
		return; // private mode, or nothing saved — the defaults are fine
	}
	if (!saved || typeof saved !== "object") return;

	if (typeof saved.hue === "number") {
		root.style.setProperty("--aurora-h", String(saved.hue));
	}
	if (typeof saved.sat === "number") {
		root.style.setProperty("--aurora-s", saved.sat + "%");
	}
	if (saved.shape) root.setAttribute("data-aurora-shape", saved.shape);
	if (saved.font) root.setAttribute("data-aurora-font", saved.font);
	if (saved.font_custom) {
		root.style.setProperty(
			"--aurora-font-custom",
			'"' + String(saved.font_custom).replace(/"/g, "") + '"'
		);
	}
	if (saved.features && saved.features.gradients === false) {
		root.setAttribute("data-aurora-gradients", "0");
	}
})();

/**
 * Sign-in hand-off.
 *
 * A successful login is the only thing that swaps the whole body for
 * `.splash` (frappe's login.js does this in `login_handlers[200]`, immediately
 * before setting `location.href`). Watching for that element is therefore a
 * success signal we get without patching core or guessing from the form.
 *
 * The flag is what lets the desk know to play its entrance rather than just
 * appearing — sessionStorage, so it dies with the tab and a later reload of the
 * desk does not replay the animation.
 */
(function () {
	if (!window.MutationObserver) return;

	function watch() {
		if (!document.body) return;

		var observer = new MutationObserver(function () {
			if (!document.querySelector(".splash")) return;
			observer.disconnect();
			try {
				window.sessionStorage.setItem("aurora:signed-in", "1");
			} catch (e) {
				/* private mode — the desk just skips its entrance */
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });
	}

	// this bundle is emitted in the HEAD, so body may not exist yet
	if (document.body) watch();
	else document.addEventListener("DOMContentLoaded", watch, { once: true });
})();
