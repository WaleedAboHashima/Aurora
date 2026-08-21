/**
 * Aurora — custom fonts.
 *
 * Three strategies, tried in order, because no single one works everywhere:
 *
 *   1. LOCAL PROBE — measure a string rendered in the requested family against
 *      the three generic families. If any width differs, the font resolved, so
 *      it is installed. Works in every browser, needs no permission, no network.
 *
 *   2. GOOGLE FONTS — if it is not installed, try fetching it by name from
 *      Google's CDN and verify with the FontFace API. This is what makes
 *      "type any font name" actually work for ~1500 families.
 *
 *   3. ENUMERATION — `navigator.queryLocalFonts()` can list every installed
 *      font, but it is Chromium-only and prompts for permission. Offered as a
 *      bonus where available; never depended on.
 *
 * Nothing here can break text: an unresolved family simply falls through to the
 * system stack, because the custom name is always the FIRST entry of a full
 * fallback list rather than the whole declaration.
 */

const GOOGLE_LINK_ID = "aurora-google-font";
const PROBE_TEXT = "mmmmmmmmmmlli";
const BASES = ["monospace", "serif", "sans-serif"];

/* ------------------------------------------------------------ local probe -- */

/**
 * True when `family` is installed on this machine.
 *
 * The trick: a font-family list falls back left-to-right, so rendering
 * `"Family", monospace` gives monospace's exact width when Family is missing,
 * and a different width when it resolves. Comparing against all three generic
 * families avoids a false negative when the requested font happens to be
 * metrically identical to one of them.
 */
export function is_installed(family) {
	if (!family) return false;

	const span = document.createElement("span");
	span.textContent = PROBE_TEXT;
	span.setAttribute("aria-hidden", "true");
	span.style.cssText =
		"position:absolute;left:-9999px;top:-9999px;font-size:72px;white-space:nowrap;";
	document.body.appendChild(span);

	try {
		const baseline = {};
		for (const base of BASES) {
			span.style.fontFamily = base;
			baseline[base] = span.offsetWidth;
		}
		for (const base of BASES) {
			span.style.fontFamily = `"${family}",${base}`;
			if (span.offsetWidth !== baseline[base]) return true;
		}
		return false;
	} finally {
		span.remove();
	}
}

/* ----------------------------------------------------------- google fonts -- */

function google_url(family) {
	const name = family.trim().replace(/\s+/g, "+");
	return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
		name
	).replace(/%2B/g, "+")}:wght@400;500;600;700&display=swap`;
}

/**
 * Ask Google for `family`. Resolves true only once the browser confirms the
 * face is actually usable — a 404 from Google still "loads" the stylesheet, so
 * the link's onload is not proof of anything.
 */
export function load_from_google(family) {
	return new Promise((resolve) => {
		if (!family || !document.fonts) return resolve(false);

		document.getElementById(GOOGLE_LINK_ID)?.remove();

		const link = document.createElement("link");
		link.id = GOOGLE_LINK_ID;
		link.rel = "stylesheet";
		link.href = google_url(family);
		link.onerror = () => resolve(false);
		link.onload = () => {
			// the stylesheet arrived; now check a face really exists
			document.fonts
				.load(`400 16px "${family}"`)
				.then(() => resolve(document.fonts.check(`16px "${family}"`)))
				.catch(() => resolve(false));
		};
		document.head.appendChild(link);

		// offline or blocked by CSP — don't hang the panel
		setTimeout(() => resolve(document.fonts.check(`16px "${family}"`)), 4000);
	});
}

/* -------------------------------------------------------------- resolution -- */

/**
 * Work out how a font name can be satisfied.
 * @returns {Promise<"local"|"google"|"missing">}
 */
export async function resolve(family) {
	if (!family || !family.trim()) return "missing";
	if (is_installed(family)) return "local";
	return (await load_from_google(family)) ? "google" : "missing";
}

/** Write the family into the variable the stylesheet reads. */
export function apply(family) {
	document.documentElement.style.setProperty(
		"--aurora-font-custom",
		family ? `"${family.replace(/"/g, "")}"` : ""
	);
}

/* ------------------------------------------------------------ enumeration -- */

export function can_enumerate() {
	return typeof window.queryLocalFonts === "function";
}

/**
 * Every font installed on this machine. Chromium only, and it shows a
 * permission prompt, so it is only ever called from an explicit button press.
 */
export async function list_installed() {
	if (!can_enumerate()) return [];
	try {
		const faces = await window.queryLocalFonts();
		return [...new Set(faces.map((f) => f.family))].sort((a, b) =>
			a.localeCompare(b)
		);
	} catch (e) {
		// the user declined the prompt
		return [];
	}
}

/**
 * Suggestions for the datalist. Platform faces are filtered to the ones
 * actually present, so the list never offers something that won't render;
 * the Google names are always offered because they can be fetched on demand.
 */
const SYSTEM_CANDIDATES = [
	"SF Pro Text", "SF Pro Display", "Helvetica Neue", "Segoe UI Variable Text",
	"Segoe UI", "Roboto", "Arial", "Avenir Next", "Optima", "Georgia",
	"Times New Roman", "Menlo", "Consolas", "SF Mono", "Courier New",
];

const GOOGLE_SUGGESTIONS = [
	"Inter", "Manrope", "DM Sans", "Plus Jakarta Sans", "Outfit", "Sora",
	"Figtree", "Public Sans", "Work Sans", "Rubik", "Karla", "Nunito Sans",
	"Source Sans 3", "IBM Plex Sans", "Space Grotesk", "Geist", "Lexend",
	"Poppins", "Montserrat", "Raleway", "Playfair Display", "Merriweather",
	"Lora", "JetBrains Mono", "Fira Code", "IBM Plex Mono",
	// strong Arabic support, which this site needs
	"Cairo", "Tajawal", "IBM Plex Sans Arabic", "Noto Sans Arabic", "Almarai",
];

export function suggestions() {
	const local = SYSTEM_CANDIDATES.filter(is_installed);
	return { local, google: GOOGLE_SUGGESTIONS };
}
