/* Tag Picker — settings pane */

// Zotero runs this script before it inserts the pane's markup, so wait for the
// elements and wire them up with listeners (inline handlers can't see this scope)
var TagPicker_Prefs = {
	isMac: Zotero.isMac,

	init() {
		this.message = document.getElementById("tp-shortcut-message");
		document.getElementById("tp-browse").addEventListener("command", () => this.browse());
		for (let [inputID, clearID] of [["tp-shortcut", "tp-shortcut-clear"],
				["tp-remove-shortcut", "tp-remove-shortcut-clear"]]) {
			let input = document.getElementById(inputID);
			this.initRecorder(input);
			document.getElementById(clearID).addEventListener("command", () => this.save(input, ""));
		}
	},

	whenReady(tries = 0) {
		if (document.getElementById("tp-shortcut") && document.getElementById("tp-browse")) {
			try {
				this.init();
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		else if (tries < 200) {
			setTimeout(() => this.whenReady(tries + 1), 50);
		}
	},

	// ---------- shortcut recorder ----------

	// Show a stored shortcut the way this computer names the keys
	pretty(text) {
		if (!text) return "";
		return text.split("+").map((part) => {
			let l = part.trim().toLowerCase();
			if (l == "accel") return this.isMac ? "Cmd" : "Ctrl";
			if (this.isMac && l == "alt") return "Option";
			return part.trim();
		}).join("+");
	},

	initRecorder(input) {
		input.placeholder = "(none)";
		input.addEventListener("syncfrompreference", () => {
			input.value = this.pretty(input.value);
		});
		input.addEventListener("focus", () => {
			input.classList.add("recording");
			input.dataset.before = input.value;
			input.placeholder = "Press the keys…";
		});
		input.addEventListener("blur", () => {
			input.classList.remove("recording");
			input.placeholder = "(none)";
		});
		input.addEventListener("keydown", (event) => this.record(event, input));
	},

	record(event, input) {
		let k = event.key;
		let anyModifier = event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
		// Plain Tab still moves between fields
		if (k == "Tab" && !anyModifier) return;
		event.preventDefault();
		event.stopPropagation();
		if (["Control", "Shift", "Alt", "Meta", "OS", "AltGraph"].includes(k)) return; // wait for the real key
		if (k == "Escape") {
			input.value = input.dataset.before || "";
			this.say("");
			input.blur();
			return;
		}
		if ((k == "Backspace" || k == "Delete") && !anyModifier) {
			this.save(input, "");
			return;
		}

		// Name the physical key for letters and digits: Option on a Mac changes event.key
		let key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3)
			: /^Digit[0-9]$/.test(event.code) ? event.code.slice(5)
			: k == " " ? "Space"
			: k.length == 1 ? k.toUpperCase()
			: k;
		if (key.length == 1 && !(event.ctrlKey || event.altKey || event.metaKey)) {
			this.say(`Add ${this.isMac ? "Cmd, Option or Control" : "Ctrl or Alt"} to a letter or number key, so it doesn't get in the way of typing.`);
			return;
		}

		let parts = [];
		if (event.ctrlKey) parts.push("Ctrl");
		if (event.metaKey) parts.push(this.isMac ? "Cmd" : "Win");
		if (event.altKey) parts.push(this.isMac ? "Option" : "Alt");
		if (event.shiftKey) parts.push("Shift");
		parts.push(key);
		this.save(input, parts.join("+"));
	},

	save(input, text) {
		input.value = text;
		input.dataset.before = text;
		// The `preference` binding saves on "input"
		input.dispatchEvent(new Event("input"));
		let other = input.id == "tp-shortcut" ? "tp-remove-shortcut" : "tp-shortcut";
		let otherValue = document.getElementById(other)?.value;
		this.say(text && otherValue && otherValue.toLowerCase() == text.toLowerCase()
			? "That's the same as the other shortcut, so only Add will open."
			: "");
	},

	say(text) {
		if (!this.message) return;
		this.message.textContent = text;
		this.message.hidden = !text;
	},

	// ---------- tag file ----------

	async browse() {
		var current = Zotero.Prefs.get("extensions.tagpicker.filePath", true);
		var path = null;
		try {
			path = await this.browseWithZotero(current);
		}
		catch (e) {
			// Zotero's picker module moved or changed: use Firefox's own file picker
			Zotero.debug("Tag Picker: Zotero file picker unavailable, using the built-in one: " + e);
			path = await this.browseWithMozilla(current);
		}
		// Setting the pref updates the text box through its preference binding
		if (path) Zotero.Prefs.set("extensions.tagpicker.filePath", path, true);
	},

	async browseWithZotero(current) {
		var { FilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");
		var fp = new FilePicker();
		fp.init(window, "Choose a tag file", fp.modeOpen);
		fp.appendFilters(fp.filterText);
		fp.appendFilters(fp.filterAll);
		if (current) {
			try {
				fp.displayDirectory = PathUtils.parent(current);
			}
			catch (e) {}
		}
		return (await fp.show()) == fp.returnOK ? fp.file : null;
	},

	browseWithMozilla(current) {
		var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
		// Newer Firefox takes a browsing context, older takes the window
		try {
			fp.init(window.browsingContext, "Choose a tag file", Ci.nsIFilePicker.modeOpen);
		}
		catch (e) {
			fp.init(window, "Choose a tag file", Ci.nsIFilePicker.modeOpen);
		}
		fp.appendFilters(Ci.nsIFilePicker.filterText | Ci.nsIFilePicker.filterAll);
		if (current) {
			try {
				let dir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
				dir.initWithPath(PathUtils.parent(current));
				fp.displayDirectory = dir;
			}
			catch (e) {}
		}
		return new Promise((resolve) => fp.open((result) => {
			resolve(result == Ci.nsIFilePicker.returnOK ? fp.file.path : null);
		}));
	}
};

TagPicker_Prefs.whenReady();
