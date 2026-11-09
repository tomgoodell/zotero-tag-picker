/* Tag Picker for Zotero — main logic (loaded into the bootstrap scope) */

TagPicker = {
	id: null,
	version: null,
	rootURI: null,
	PREF: "extensions.tagpicker.",
	_windows: new Map(), // window -> { keyHandler, menuItem }

	init({ id, version, rootURI }) {
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
	},

	pref(name) {
		return Zotero.Prefs.get(this.PREF + name, true);
	},

	log(msg) {
		Zotero.debug("Tag Picker: " + msg);
	},

	// ---------- window wiring ----------

	addToAllWindows() {
		for (let win of Zotero.getMainWindows()) {
			if (win.ZoteroPane) this.addToWindow(win);
		}
	},

	removeFromAllWindows() {
		for (let win of [...this._windows.keys()]) this.removeFromWindow(win);
	},

	addToWindow(win) {
		if (this._windows.has(win)) return;
		let doc = win.document;

		let keyHandler = (event) => this._onKeyDown(win, event);
		win.addEventListener("keydown", keyHandler, true);

		let menuItem = null;
		let itemMenu = doc.getElementById("zotero-itemmenu");
		if (itemMenu) {
			menuItem = doc.createXULElement("menuitem");
			menuItem.id = "zotero-tag-picker-itemmenu";
			menuItem.setAttribute("label", "Add Tags…");
			menuItem.addEventListener("command", () => this.open(win));
			itemMenu.appendChild(menuItem);
		}
		this._windows.set(win, { keyHandler, menuItem });
	},

	removeFromWindow(win) {
		let entry = this._windows.get(win);
		if (!entry) return;
		win.removeEventListener("keydown", entry.keyHandler, true);
		entry.menuItem?.remove();
		this._windows.delete(win);
	},

	// ---------- shortcut ----------

	// "Ctrl+Alt+F13" -> { ctrl, alt, shift, meta, key }
	parseShortcut(text) {
		if (!text || !text.trim()) return null;
		let parts = text.split("+").map(s => s.trim()).filter(Boolean);
		let spec = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
		for (let p of parts) {
			let l = p.toLowerCase();
			// "Accel" = Cmd on a Mac, Ctrl elsewhere, so one setting suits both
			if (l == "accel") spec[Zotero.isMac ? "meta" : "ctrl"] = true;
			else if (l == "ctrl" || l == "control") spec.ctrl = true;
			else if (l == "alt" || l == "option" || l == "opt") spec.alt = true;
			else if (l == "shift") spec.shift = true;
			else if (l == "meta" || l == "win" || l == "cmd" || l == "command") spec.meta = true;
			else spec.key = p;
		}
		return spec.key ? spec : null;
	},

	_onKeyDown(win, event) {
		let spec = this.parseShortcut(this.pref("shortcut"));
		if (!spec) return;
		if (event.ctrlKey != spec.ctrl || event.altKey != spec.alt
				|| event.shiftKey != spec.shift || event.metaKey != spec.meta) {
			return;
		}
		let want = spec.key.toLowerCase();
		let isChar = want.length == 1;
		// Also match the physical key for letters and digits: on a Mac, Option changes
		// event.key (Option+T gives "†"), and Ctrl+Alt is AltGr on many Windows layouts
		let code = /^[a-z]$/.test(want) ? "Key" + want.toUpperCase()
			: /^[0-9]$/.test(want) ? "Digit" + want : null;
		if (event.key.toLowerCase() != want && !(code && event.code == code)) return;
		// Only in the library view, where there is an item selection
		if (win.Zotero_Tabs && win.Zotero_Tabs.selectedType != "library") return;
		// A letter shortcut must not swallow typing in a note, search box or field
		if (isChar && this._isTyping(event)) return;
		event.preventDefault();
		event.stopPropagation();
		this.open(win);
	},

	_isTyping(event) {
		let el = event.composedTarget || event.target;
		if (!el || !el.localName) return false;
		if (el.isContentEditable) return true;
		// Note editors live in iframes/browsers inside the main window
		return ["input", "textarea", "iframe", "browser", "note-editor", "editable-text"].includes(el.localName)
			|| !!el.closest?.("note-editor, editable-text");
	},

	// ---------- case handling ----------

	applyCase(tag, mode = this.pref("caseMode")) {
		tag = tag.trim().replace(/\s+/g, " ");
		switch (mode) {
			case "lower": return tag.toLowerCase();
			case "upper": return tag.toUpperCase();
			case "title": return tag.toLowerCase().replace(/(^|[\s\-\/(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
			default: return tag;
		}
	},

	// ---------- tag sources ----------

	async libraryTagCounts(libraryID, includeAutomatic) {
		let sql = "SELECT name, COUNT(*) AS n FROM tags JOIN itemTags USING (tagID) "
			+ "JOIN items USING (itemID) LEFT JOIN deletedItems USING (itemID) "
			+ "WHERE items.libraryID = ? AND deletedItems.itemID IS NULL "
			+ (includeAutomatic ? "" : "AND itemTags.type = 0 ")
			+ "GROUP BY name";
		let rows = await Zotero.DB.queryAsync(sql, [libraryID]);
		let counts = new Map();
		for (let r of rows) counts.set(r.name, r.n);
		return counts;
	},

	async fileTags() {
		let path = this.pref("filePath");
		if (!path) return [];
		try {
			let text = await IOUtils.readUTF8(path);
			return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
		}
		catch (e) {
			this.log("could not read tag file " + path + ": " + e);
			return null; // signals an error to the caller
		}
	},

	async addToFile(newTags) {
		let path = this.pref("filePath");
		if (!path || !newTags.length) return;
		let existing = (await this.fileTags()) || [];
		let lower = new Set(existing.map(t => t.toLowerCase()));
		let added = newTags.filter(t => !lower.has(t.toLowerCase()));
		if (!added.length) return;
		let all = existing.concat(added).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
		// tmpPath: write to a temp file and swap it in, so the list is never left half-written
		await IOUtils.writeUTF8(path, all.join("\r\n") + "\r\n", { tmpPath: path + ".tmp" });
		this.log("added to tag file: " + added.join(", "));
	},

	// Build the list shown in the picker: [{ tag, count }]
	async buildList(libraryID) {
		let source = this.pref("source");
		let caseMode = this.pref("caseMode");
		let counts = await this.libraryTagCounts(libraryID, this.pref("includeAutomatic"));
		let names = [];
		let warning = "";
		if (source == "library" || source == "both") names.push(...counts.keys());
		if (source == "file" || source == "both") {
			let fromFile = await this.fileTags();
			if (fromFile === null) warning = "Couldn't read the tag file — check Settings › Tag Picker.";
			else if (!this.pref("filePath")) warning = "No tag file chosen — set one in Settings › Tag Picker.";
			else names.push(...fromFile);
		}
		// Merge by the cased form, summing usage counts of every spelling that maps to it
		let merged = new Map();
		for (let name of names) {
			let shown = caseMode == "asis" ? name : this.applyCase(name, caseMode);
			if (!merged.has(shown)) merged.set(shown, 0);
		}
		for (let [name, n] of counts) {
			let shown = caseMode == "asis" ? name : this.applyCase(name, caseMode);
			if (merged.has(shown)) merged.set(shown, merged.get(shown) + n);
		}
		let list = [...merged].map(([tag, count]) => ({ tag, count }));
		let byName = (a, b) => a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" });
		if (this.pref("sortOrder") == "frequency") list.sort((a, b) => b.count - a.count || byName(a, b));
		else list.sort(byName);
		return { list, warning };
	},

	// ---------- open + apply ----------

	async open(win) {
		let pane = win.ZoteroPane;
		if (!pane) return;
		let items = pane.getSelectedItems().filter(i => i.isRegularItem() || i.isNote() || i.isAttachment());
		if (!items.length) {
			Zotero.alert(win, "Tag Picker", "Select one or more items first.");
			return;
		}
		let libraryID = items[0].libraryID;
		if (!Zotero.Libraries.get(libraryID).editable) {
			Zotero.alert(win, "Tag Picker", "This library is read-only.");
			return;
		}
		let { list, warning } = await this.buildList(libraryID);
		let io = {
			list,
			warning,
			itemCount: items.length,
			version: this.version,
			applyCase: (t) => this.applyCase(t),
			// The dialog writes its answer back as a JSON string: objects created inside the
			// dialog become dead objects once its window closes.
			resultJSON: ""
		};
		win.openDialog("chrome://zotero-tag-picker/content/picker.xhtml", "zotero-tag-picker",
			"chrome,modal,centerscreen,resizable", io);
		if (!io.resultJSON) return;
		let result = JSON.parse(io.resultJSON);
		if (!result.tags.length) return;

		await this.applyTags(items, result.tags);
		let source = this.pref("source");
		if (result.newTags.length && this.pref("saveNewToFile") && (source == "file" || source == "both")) {
			try {
				await this.addToFile(result.newTags);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	},

	async applyTags(items, tags) {
		let changed = 0;
		await Zotero.DB.executeTransaction(async () => {
			for (let item of items) {
				let itemChanged = false;
				for (let tag of tags) {
					// hasTag first: addTag() reports a change for a manual tag the item already has
					if (!item.hasTag(tag) && item.addTag(tag)) itemChanged = true;
				}
				if (itemChanged) {
					await item.save();
					changed++;
				}
			}
		});
		this.log(`added [${tags.join(", ")}] to ${changed} of ${items.length} item(s)`);
	}
};
