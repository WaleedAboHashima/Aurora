/**
 * Aurora — sign-in entrance.
 *
 * The second half of the login transition. The login page's last frame is
 * frappe's `.splash` (styled in `web/_login.scss`); this picks the same accent
 * bloom up on the desk side and opens it away, so signing in reads as one
 * continuous movement rather than two unrelated pages.
 *
 * TIMING. The curtain goes up at *parse* time, not on `app_ready`. `desk.html`
 * puts `app_include_js` at the end of <body>, so by the time this module runs
 * the body exists but frappe's own splash is still covering an unbooted desk —
 * which is the one moment we can take over without a visible flash. Waiting for
 * `app_ready` would mean the desk paints first and the curtain slams over it.
 *
 * It comes down again from `init()`, which runs once the desk really is ready,
 * so the reveal never lands on a half-built page.
 *
 * Only ever runs when the web bundle set `aurora:signed-in` — i.e. this page
 * load is the one straight after a successful login. The flag is consumed on
 * read, so reloading the desk, or coming back to it later in the session, shows
 * nothing.
 */
import { feature } from "./settings";
import { motion_off } from "./utils";

const FLAG = "aurora:signed-in";
const MIN_HOLD = 420; // don't let the curtain merely blink on a warm cache
const REVEAL = 900; // matches the retract transition in _entrance.scss
// a curtain that never lifts is far worse than a lost animation, so if boot has
// not finished by now, drop it and let the desk through un-animated
const FAILSAFE = 4000;

let curtain = null;
let mounted_at = 0;
let failsafe_timer = null;

function claim_flag() {
	try {
		if (window.sessionStorage.getItem(FLAG) !== "1") return false;
		// consumed on read: this is for the sign-in, not for every later reload
		window.sessionStorage.removeItem(FLAG);
		return true;
	} catch (e) {
		return false; // private mode
	}
}

/**
 * `desk.html` renders frappe's own splash — the same `splash_image` the login
 * page just showed — and it is still in the DOM at parse time. Borrowing its
 * src is both the correct logo for the site and the one guaranteed to match the
 * frame the user is coming from. `frappe.boot` is not populated this early, so
 * it is only a fallback.
 */
function logo_src() {
	return (
		document.querySelector(".splash img")?.getAttribute("src") ||
		window.frappe?.boot?.app_logo_url ||
		"/assets/frappe/images/frappe-framework-logo.svg"
	);
}

function teardown() {
	clearTimeout(failsafe_timer);
	curtain?.remove();
	curtain = null;
	document.documentElement.classList.remove("aurora-entering", "aurora-entry-play");
}

function mount() {
	// the flag is claimed even when we are about to skip, so that a user with
	// motion off does not get the animation on some unrelated later navigation
	if (!claim_flag()) return;
	if (motion_off() || !feature("signin_entrance") || !document.body) return;

	curtain = document.createElement("div");
	curtain.className = "aurora-entry";
	curtain.setAttribute("aria-hidden", "true");

	/* The centring is also set inline, not only in the stylesheet.
	 *
	 * Everything expressive about this element — the bloom, the retract — can
	 * safely wait for CSS. Its *position* cannot: if the rule has not applied at
	 * the moment the node is inserted, the mark paints at the top-left of a
	 * full-viewport box and then jumps once the sheet lands, which is the bug
	 * this whole file keeps running into. Four declarations inline make that
	 * failure mode impossible regardless of stylesheet timing. */
	Object.assign(curtain.style, {
		position: "fixed",
		inset: "0",
		display: "grid",
		placeItems: "center",
	});

	// setAttribute rather than innerHTML: the url is configured, not literal
	const mark = document.createElement("img");
	mark.className = "aurora-entry-mark";
	mark.alt = "";
	mark.setAttribute("src", logo_src());
	curtain.appendChild(mark);

	document.body.appendChild(curtain);
	document.documentElement.classList.add("aurora-entering");
	mounted_at = Date.now();

	// if boot never completes, the desk must still become usable
	failsafe_timer = setTimeout(teardown, FAILSAFE);
}

export function init() {
	if (!curtain) return;

	const wait = Math.max(0, MIN_HOLD - (Date.now() - mounted_at));
	setTimeout(() => {
		if (!curtain) return; // the failsafe got there first
		// the curtain opening and the desk travelling in are one movement, so
		// they start on the same frame
		curtain.classList.add("leaving");
		document.documentElement.classList.add("aurora-entry-play");
		setTimeout(teardown, REVEAL);
	}, wait);
}

// at parse time, while frappe's splash still covers the unbooted desk
mount();
