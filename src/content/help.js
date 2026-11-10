/* Tag Picker — help window */

window.addEventListener("DOMContentLoaded", () => {
	// Name the keys the way this computer does
	if (navigator.platform.startsWith("Mac")) {
		for (let el of document.querySelectorAll(".accel")) el.textContent = "Cmd";
		for (let el of document.querySelectorAll(".alt")) el.textContent = "Option";
	}
	let close = document.getElementById("help-close");
	close.addEventListener("click", () => window.close());
	window.addEventListener("keydown", (e) => {
		if (e.key == "Escape") {
			e.preventDefault();
			window.close();
		}
	});
	close.focus();
});
