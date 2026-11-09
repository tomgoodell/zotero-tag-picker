/* Tag Picker — the search window */

// This is a XUL window, so plain createElement() would make XUL elements
const html = (name) => document.createElementNS("http://www.w3.org/1999/xhtml", name);
const isMac = navigator.platform.startsWith("Mac");

var TagPickerDialog = {
	io: null,
	all: [],        // [{ tag, count }]
	shown: [],      // rows currently listed: { tag, count, isNew }
	chosen: [],     // tags picked so far
	newTags: [],    // chosen tags that weren't in the list
	highlight: 0,
	navigated: false, // arrowed through the list since the last search change

	init() {
		this.io = window.arguments[0];
		this.all = this.io.list.map(e => ({ tag: e.tag, count: e.count }));

		this.search = document.getElementById("tp-search");
		this.listEl = document.getElementById("tp-list");
		this.chosenEl = document.getElementById("tp-chosen");

		if (this.io.warning) {
			let w = document.getElementById("tp-warning");
			w.textContent = this.io.warning;
			w.hidden = false;
		}
		let n = this.io.itemCount;
		document.getElementById("tp-status").textContent =
			`${n} item${n == 1 ? "" : "s"} selected · v${this.io.version}`;
		document.getElementById("tp-hint").textContent =
			`Click or Enter adds · Enter on empty box (or ${isMac ? "⌘" : "Ctrl+"}Enter) applies · Esc cancels`;

		this.search.addEventListener("input", () => this.refilter());
		window.addEventListener("keydown", (e) => this.onKey(e), true);
		document.getElementById("tp-cancel").addEventListener("click", () => window.close());
		document.getElementById("tp-apply").addEventListener("click", () => this.apply());

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
		// Offer the typed text as a new tag when nothing matches it exactly
		if (q) {
			let typed = this.io.applyCase(this.query());
			if (!this.all.some(e => e.tag.toLowerCase() == typed.toLowerCase())) {
				this.shown.push({ tag: typed, count: 0, isNew: true });
			}
		}
		this.highlight = 0;
		this.navigated = false;
		this.renderList();
	},

	renderList() {
		this.listEl.replaceChildren();
		this.shown.forEach((e, i) => {
			let row = html("div");
			row.className = "tp-row";
			if (i == this.highlight) row.classList.add("highlight");
			if (this.chosen.includes(e.tag)) row.classList.add("chosen");
			if (e.isNew) row.classList.add("new");
			let name = html("span");
			name.className = "tp-name";
			name.textContent = e.isNew ? `Create “${e.tag}”` : e.tag;
			let count = html("span");
			count.className = "tp-count";
			count.textContent = e.isNew ? "new" : (e.count || "");
			row.append(name, count);
			row.addEventListener("click", (ev) => {
				// One click adds. Ignore the 2nd click of a double-click: the list has
				// already re-rendered, so it would land on a different tag.
				if (ev.detail > 1) return;
				this.highlight = i;
				this.pick();
			});
			this.listEl.append(row);
		});
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
			let label = html("span");
			label.textContent = tag;
			let x = html("span");
			x.className = "tp-chip-x";
			x.textContent = "×";
			x.title = "Remove";
			x.addEventListener("click", () => this.unchoose(tag));
			chip.append(label, x);
			this.chosenEl.append(chip);
		}
		document.getElementById("tp-apply").disabled = !this.chosen.length;
	},

	pick() {
		let e = this.shown[this.highlight];
		if (!e) return;
		if (!this.chosen.includes(e.tag)) {
			this.chosen.push(e.tag);
			if (e.isNew) {
				this.newTags.push(e.tag);
				this.all.push({ tag: e.tag, count: 0 });
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

	apply() {
		if (!this.chosen.length) return;
		this.io.resultJSON = JSON.stringify({ tags: this.chosen, newTags: this.newTags });
		window.close();
	},

	onKey(e) {
		switch (e.key) {
			case "Enter":
				e.preventDefault();
				// Ctrl+Enter (Cmd+Enter on a Mac) always applies; plain Enter adds the highlighted
				// tag when you've typed or arrowed to one, and applies on an untouched empty box
				if ((isMac ? e.metaKey : e.ctrlKey) || (!this.query() && !this.navigated)) this.apply();
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
