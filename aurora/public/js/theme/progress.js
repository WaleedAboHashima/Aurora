/**
 * Aurora — route/request progress bar.
 *
 * Frappe already freezes the screen for blocking calls, but most navigation is
 * non-blocking and gives no feedback at all. This wires a slim gradient bar to
 * two signals: router changes, and the count of in-flight frappe.call requests
 * (frappe.request keeps that in frappe.request.pending or via ajax events).
 */

let bar = null;
let wrapper = null;
let progress = 0;
let timer = null;
let inflight = 0;

function mount() {
	if (wrapper) return;
	wrapper = document.createElement("div");
	wrapper.className = "aurora-progress";
	wrapper.innerHTML = `<div class="aurora-progress-bar"></div>`;
	document.body.appendChild(wrapper);
	bar = wrapper.querySelector(".aurora-progress-bar");
}

function render() {
	if (bar) bar.style.width = `${progress}%`;
}

export function start() {
	mount();
	if (timer) return; // already running
	progress = 8;
	wrapper.classList.add("active");
	render();
	// creep towards 90% so the bar always feels alive on slow calls
	timer = setInterval(() => {
		const remaining = 90 - progress;
		progress += Math.max(0.4, remaining * 0.08);
		render();
	}, 180);
}

export function done() {
	if (!wrapper) return;
	clearInterval(timer);
	timer = null;
	progress = 100;
	render();
	setTimeout(() => {
		wrapper.classList.remove("active");
		setTimeout(() => {
			progress = 0;
			render();
		}, 220);
	}, 180);
}

export function init() {
	mount();

	// 1. route changes
	if (window.frappe?.router?.on) {
		frappe.router.on("change", () => start());
	}
	$(document).on("page-change", () => done());

	// 2. XHR traffic — jQuery global events cover every frappe.call()
	$(document).on("ajaxSend", () => {
		inflight += 1;
		if (inflight === 1) start();
	});
	$(document).on("ajaxComplete", () => {
		inflight = Math.max(0, inflight - 1);
		if (inflight === 0) done();
	});

	// safety net: never leave the bar stuck
	window.addEventListener("error", () => done());
}
