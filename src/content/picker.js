/* Tag Picker — the search window */

// This is a XUL window, so plain createElement() would make XUL elements
const html = (name) => document.createElementNS("http://www.w3.org/1999/xhtml", name);
const isMac = navigator.platform.startsWith("Mac");
const accel = isMac ? "⌘" : "Ctrl+";
// Drawing thousands of rows on every keystroke is slow; the rest appear as you type
const MAX_ROWS = 500;

var TagPickerDialog = {
	io: null,
	mode: "add",    // add | remove
	lists: null,    // { add: [{ tag, count, color, position }], remove: [...] }
	shown: [],      // rows currently listed: { tag, count, color, isNew }
	chosen: [],     // tags picked so far (in the current mode)
	newTags: [],    // chosen tags that weren't in the list
	highlight: 0,
	navigated: false, // arrowed through the list since the last search change
	// How the Add list is built: { source: library|file|both, includeAutomatic, sortOrder: frequency|alpha }
	settings: null,
	rebuilds: 0,      // counts setting changes, so a slow rebuild can't overwrite a newer one

	init() {
		this.io = window.arguments[0];
		this.lists = { add: this.copy(this.io.list), remove: this.copy(this.io.removeList) };
		let s = this.io.settings;
		this.settings = { source: s.source, includeAutomatic: s.includeAutomatic, sortOrder: s.sortOrder };

		this.search = document.getElementById("tp-search");
		this.listEl = document.getElementById("tp-list");
		this.chosenEl = document.getElementById("tp-chosen");
		this.applyBtn = document.getElementById("tp-apply");
		this.autoBox = document.getElementById("tp-auto");

		this.showWarning(this.io.warning);
		for (let [name, values] of Object.entries(this.choices)) {
			for (let v of values) {
				document.getElementById(`tp-${name}-${v}`).addEventListener("click", () => this.change(name, v));
			}
		}
		this.autoBox.addEventListener("change", () => this.change("includeAutomatic", this.autoBox.checked));
		this.renderSettings();
		let n = this.io.itemCount;
		document.getElementById("tp-status").textContent =
			`${n} item${n == 1 ? "" : "s"} selected · v${this.io.version}`;

		this.search.addEventListener("input", () => this.refilter());
		window.addEventListener("keydown", (e) => this.onKey(e), true);
		document.getElementById("tp-cancel").addEventListener("click", () => window.close());
		document.getElementById("tp-help").addEventListener("click", () => this.help());
		this.applyBtn.addEventListener("click", () => this.apply());
		for (let m of ["add", "remove"]) {
			document.getElementById("tp-mode-" + m).addEventListener("click", () => {
				// Clicking the current mode again shouldn't throw away the picks
				if (this.mode != m) this.setMode(m);
				else this.search.focus();
			});
		}

		this.setMode(this.io.mode == "remove" ? "remove" : "add");
	},

	get all() {
		return this.lists[this.mode];
	},

	// Own copies of the lists the main window built
	copy(list) {
		return list.map(e => ({ tag: e.tag, count: e.count, color: e.color, position: e.position }));
	},

	showWarning(text) {
		let w = document.getElementById("tp-warning");
		w.textContent = text || "";
		w.hidden = !text;
	},

	// The button groups in the top row: setting -> its values (button ids are tp-<setting>-<value>)
	choices: {
		source: ["file", "library", "both"],
		sortOrder: ["frequency", "alpha"]
	},

	renderSettings() {
		for (let [name, values] of Object.entries(this.choices)) {
			for (let v of values) {
				let btn = document.getElementById(`tp-${name}-${v}`);
				btn.classList.toggle("selected", v == this.settings[name]);
				btn.setAttribute("aria-pressed", v == this.settings[name]);
			}
		}
		this.autoBox.checked = this.settings.includeAutomatic;
	},

	// Change how the Add list is built. The choice is saved as the setting.
	async change(name, value) {
		this.search.focus();
		if (this.settings[name] == value) return;
		this.settings[name] = value;
		this.renderSettings();
		let ticket = ++this.rebuilds;
		let built = await this.io.rebuild({ ...this.settings });
		if (ticket != this.rebuilds || window.closed) return;
		if (!built) {
			this.showWarning("Couldn't rebuild the tag list — see Help › Debug Output Logging.");
			return;
		}
		let list = this.copy(built.list);
		// Keep every pick, even one the new source doesn't offer: it's still a tag to add
		for (let tag of this.mode == "add" ? this.chosen : []) {
			if (!list.some(e => e.tag == tag)) list.push({ tag, count: 0, color: null, position: 0 });
		}
		this.lists.add = list;
		this.showWarning(built.warning);
		if (this.mode == "add") {
			this.refilter();
			this.renderChosen();
		}
	},

	setMode(mode) {
		this.mode = mode;
		// Picks belong to one mode; switching starts fresh rather than mixing adds and removes
		this.chosen = [];
		this.newTags = [];
		let adding = mode == "add";
		document.title = adding ? "Add Tags" : "Remove Tags";
		for (let m of ["add", "remove"]) {
			let btn = document.getElementById("tp-mode-" + m);
			btn.classList.toggle("selected", m == mode);
			btn.setAttribute("aria-selected", m == mode);
		}
		document.documentElement.classList.toggle("tp-removing", !adding);
		this.search.placeholder = adding ? "Search or type a new tag…" : "Search the tags on these items…";
		document.getElementById("tp-chosen-label").textContent = adding ? "Adding:" : "Removing:";
		this.applyBtn.textContent = adding ? "Add" : "Remove";
		document.getElementById("tp-hint").textContent =
			`Click or Enter picks · Enter on empty box (or ${accel}Enter) applies · ${accel}R switches Add/Remove · Esc cancels · F1 help`;
		this.search.value = "";
		this.refilter();
		this.renderChosen();
		this.search.focus();
	},

	query() {
		return this.search.value.trim().replace(/\s+/g, " ");
	},

	refilter() {
		let q = this.query().toLowerCase();
		let starts = [], wordStarts = [], inside = [];
		for (let e of this.all) {
			let t = e.tag.toLowerCase();
			if (!q || t.startsWith(q)) starts.push(e);
			else if (t.includes(" " + q) || t.includes("-" + q) || t.includes("(" + q)) wordStarts.push(e);
			else if (t.includes(q)) inside.push(e);
		}
		this.shown = [...starts, ...wordStarts, ...inside];
		// Offer the typed text as a new tag when nothing matches it exactly (Add mode only)
		if (q && this.mode == "add") {
			let typed = this.io.applyCase(this.query());
			if (!this.all.some(e => e.tag.toLowerCase() == typed.toLowerCase())) {
				this.shown.push({ tag: typed, count: 0, color: null, isNew: true });
			}
		}
		this.highlight = 0;
		this.navigated = false;
		this.renderList();
	},

	// A colored tag's color, as a small dot
	dot(color) {
		let d = html("span");
		d.className = "tp-dot";
		if (color) d.style.backgroundColor = color;
		else d.classList.add("none");
		return d;
	},

	renderList() {
		this.listEl.replaceChildren();
		if (!this.shown.length) {
			let empty = html("div");
			empty.className = "tp-empty";
			empty.textContent = this.mode == "remove"
				? (this.all.length ? "No matching tags on these items." : "These items have no tags.")
				: "No tags yet — type one to create it.";
			this.listEl.append(empty);
			return;
		}
		// Rows that can't be drawn are still reachable by typing; keep the highlighted one in range
		let limit = Math.max(MAX_ROWS, this.highlight + 1);
		let anyColor = this.shown.some(e => e.color);
		this.shown.slice(0, limit).forEach((e, i) => {
			let row = html("div");
			row.className = "tp-row";
			if (i == this.highlight) row.classList.add("highlight");
			if (this.chosen.includes(e.tag)) row.classList.add("chosen");
			if (e.isNew) row.classList.add("new");
			if (anyColor) row.append(this.dot(e.color));
			let name = html("span");
			name.className = "tp-name";
			name.textContent = e.isNew ? `Create “${e.tag}”` : e.tag;
			let count = html("span");
			count.className = "tp-count";
			count.textContent = e.isNew ? "new"
				: this.mode == "remove" ? `${e.count} of ${this.io.itemCount}`
				: (e.count || "");
			row.append(name, count);
			row.addEventListener("click", (ev) => {
				// One click picks. Ignore the 2nd click of a double-click: the list has
				// already re-rendered, so it would land on a different tag.
				if (ev.detail > 1) return;
				this.highlight = i;
				this.pick();
			});
			this.listEl.append(row);
		});
		if (this.shown.length > limit) {
			let more = html("div");
			more.className = "tp-empty";
			more.textContent = `…and ${this.shown.length - limit} more. Type to narrow the list.`;
			this.listEl.append(more);
		}
		this.listEl.children[this.highlight]?.scrollIntoView({ block: "nearest" });
	},

	renderChosen() {
		this.chosenEl.replaceChildren();
		if (!this.chosen.length) {
			let none = html("span");
			none.textContent = "(none)";
			none.style.opacity = "0.6";
			none.style.paddingTop = "3px";
			this.chosenEl.append(none);
		}
		for (let tag of this.chosen) {
			let chip = html("span");
			chip.className = "tp-chip";
			let color = this.all.find(e => e.tag == tag)?.color;
			if (color) chip.append(this.dot(color));
			let label = html("span");
			label.textContent = tag;
			let x = html("span");
			x.className = "tp-chip-x";
			x.textContent = "×";
			x.title = "Unpick";
			x.addEventListener("click", () => this.unchoose(tag));
			chip.append(label, x);
			this.chosenEl.append(chip);
		}
		this.applyBtn.disabled = !this.chosen.length;
	},

	pick() {
		let e = this.shown[this.highlight];
		if (!e) return;
		if (!this.chosen.includes(e.tag)) {
			this.chosen.push(e.tag);
			if (e.isNew) {
				this.newTags.push(e.tag);
				this.all.push({ tag: e.tag, count: 0, color: null, position: 0 });
			}
		}
		if (this.search.value) {
			this.search.value = "";
			this.refilter();
		}
		else {
			// Browsing the full list: keep the place instead of jumping back to the top
			this.renderList();
		}
		this.navigated = false;
		this.renderChosen();
		this.search.focus();
	},

	unchoose(tag) {
		this.chosen = this.chosen.filter(t => t != tag);
		this.newTags = this.newTags.filter(t => t != tag);
		this.renderChosen();
		this.renderList();
		this.search.focus();
	},

	move(delta) {
		if (!this.shown.length) return;
		this.highlight = Math.max(0, Math.min(this.shown.length - 1, this.highlight + delta));
		this.navigated = true;
		this.renderList();
	},

	help() {
		// Modal too, so it sits on top of this window instead of behind it
		window.openDialog("chrome://zotero-tag-picker/content/help.xhtml", "tag-picker-help",
			"chrome,modal,centerscreen,resizable,width=580,height=640");
		this.search.focus();
	},

	apply() {
		if (!this.chosen.length) return;
		this.io.resultJSON = JSON.stringify({ mode: this.mode, tags: this.chosen, newTags: this.newTags });
		window.close();
	},

	onKey(e) {
		let accelDown = isMac ? e.metaKey : e.ctrlKey;
		if (accelDown && e.key.toLowerCase() == "r") {
			e.preventDefault();
			this.setMode(this.mode == "add" ? "remove" : "add");
			return;
		}
		switch (e.key) {
			case "F1":
				e.preventDefault();
				this.help();
				break;
			case "Enter":
				// A focused button handles Enter itself
				if (e.target.localName == "button") return;
				e.preventDefault();
				// Ctrl+Enter (Cmd+Enter on a Mac) always applies; plain Enter picks the highlighted
				// tag when you've typed or arrowed to one, and applies on an untouched empty box
				if (accelDown || (!this.query() && !this.navigated)) this.apply();
				else this.pick();
				break;
			case "Escape":
				e.preventDefault();
				window.close();
				break;
			case "ArrowDown":
				e.preventDefault();
				this.move(1);
				break;
			case "ArrowUp":
				e.preventDefault();
				this.move(-1);
				break;
			case "PageDown":
				e.preventDefault();
				this.move(10);
				break;
			case "PageUp":
				e.preventDefault();
				this.move(-10);
				break;
			case "Backspace":
				if (!this.search.value && this.chosen.length) {
					e.preventDefault();
					this.unchoose(this.chosen[this.chosen.length - 1]);
				}
				break;
		}
	}
};
