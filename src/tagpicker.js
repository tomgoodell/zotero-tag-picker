/* Tag Picker for Zotero — main logic (loaded into the bootstrap scope) */

TagPicker = {
	id: null,
	version: null,
	rootURI: null,
	PREF: "extensions.tagpicker.",
	FTL: "tag-picker.ftl",
	_windows: new Map(), // window -> { keyHandler, menuItems }
	_menuIDs: [],        // Zotero.MenuManager registrations
	_useMenuAPI: false,

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

	// Run one piece of setup on its own, so a Zotero change that breaks it
	// doesn't take the rest of the plugin down with it
	_try(what, fn) {
		try {
			return fn();
		}
		catch (e) {
			this.log(what + " failed: " + e);
			Zotero.logError(e);
			return undefined;
		}
	},

	start() {
		this._useMenuAPI = !!this._try("registering the item menu", () => this.registerMenus());
		this.addToAllWindows();
	},

	stop() {
		for (let menuID of this._menuIDs) {
			this._try("unregistering the item menu", () => Zotero.MenuManager.unregisterMenu(menuID));
		}
		this._menuIDs = [];
		this.removeFromAllWindows();
	},

	// ---------- menus ----------

	// Zotero 8+ has an official menu API; older or changed builds fall back to
	// adding items to the item context menu directly (see addToWindow)
	registerMenus() {
		if (!Zotero.MenuManager?.registerMenu) return false;
		let menuID = Zotero.MenuManager.registerMenu({
			menuID: "tag-picker-item-menu",
			pluginID: this.id,
			target: "main/library/item",
			menus: [
				{
					menuType: "menuitem",
					l10nID: "tag-picker-menu-add",
					onCommand: (event) => this.open(event.target.ownerGlobal, "add")
				},
				{
					menuType: "menuitem",
					l10nID: "tag-picker-menu-remove",
					onCommand: (event) => this.open(event.target.ownerGlobal, "remove")
				}
			]
		});
		if (!menuID) return false;
		this._menuIDs.push(menuID);
		return true;
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
		let entry = { keyHandler: null, menuItems: [] };
		this._windows.set(win, entry);

		this._try("adding the keyboard shortcut", () => {
			entry.keyHandler = (event) => this._onKeyDown(win, event);
			win.addEventListener("keydown", entry.keyHandler, true);
		});

		this._try("loading menu labels", () => win.MozXULElement.insertFTLIfNeeded(this.FTL));

		if (!this._useMenuAPI) {
			this._try("adding the item menu", () => {
				let itemMenu = doc.getElementById("zotero-itemmenu");
				if (!itemMenu) throw new Error("#zotero-itemmenu not found");
				for (let [mode, label] of [["add", "Add Tags…"], ["remove", "Remove Tags…"]]) {
					let menuItem = doc.createXULElement("menuitem");
					menuItem.id = "zotero-tag-picker-itemmenu-" + mode;
					menuItem.setAttribute("label", label);
					menuItem.addEventListener("command", () => this.open(win, mode));
					itemMenu.appendChild(menuItem);
					entry.menuItems.push(menuItem);
				}
			});
		}
	},

	removeFromWindow(win) {
		let entry = this._windows.get(win);
		if (!entry) return;
		if (entry.keyHandler) win.removeEventListener("keydown", entry.keyHandler, true);
		for (let menuItem of entry.menuItems) menuItem.remove();
		this._try("removing menu labels", () => win.document.querySelector(`link[href="${this.FTL}"]`)?.remove());
		this._windows.delete(win);
	},

	// ---------- shortcuts ----------

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

	matchesShortcut(spec, event) {
		if (!spec) return false;
		if (event.ctrlKey != spec.ctrl || event.altKey != spec.alt
				|| event.shiftKey != spec.shift || event.metaKey != spec.meta) {
			return false;
		}
		let want = spec.key.toLowerCase();
		if (want == "space") want = " ";
		// Also match the physical key for letters and digits: on a Mac, Option changes
		// event.key (Option+T gives "†"), and Ctrl+Alt is AltGr on many Windows layouts
		let code = /^[a-z]$/.test(want) ? "Key" + want.toUpperCase()
			: /^[0-9]$/.test(want) ? "Digit" + want : null;
		return event.key.toLowerCase() == want || (code && event.code == code);
	},

	_onKeyDown(win, event) {
		let mode = null;
		let spec;
		for (let [m, prefName] of [["add", "shortcut"], ["remove", "removeShortcut"]]) {
			let s = this.parseShortcut(this.pref(prefName));
			if (this.matchesShortcut(s, event)) {
				mode = m;
				spec = s;
				break;
			}
		}
		if (!mode) return;
		// Only in the library view, where there is an item selection. An unknown value
		// (Zotero renamed something) counts as the library, so the shortcut keeps working.
		let tabType = win.Zotero_Tabs?.selectedType;
		if (typeof tabType == "string" && tabType != "library") return;
		// A letter shortcut must not swallow typing in a note, search box or field
		if (spec.key.length == 1 && this._isTyping(event)) return;
		event.preventDefault();
		event.stopPropagation();
		this.open(win, mode);
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
		let types = includeAutomatic ? [0, 1] : [0];
		try {
			let sql = "SELECT name, COUNT(*) AS n FROM tags JOIN itemTags USING (tagID) "
				+ "JOIN items USING (itemID) LEFT JOIN deletedItems USING (itemID) "
				+ "WHERE items.libraryID = ? AND deletedItems.itemID IS NULL "
				+ "AND itemTags.type IN (" + types.join(", ") + ") "
				+ "GROUP BY name";
			let rows = await Zotero.DB.queryAsync(sql, [libraryID]);
			let counts = new Map();
			for (let r of rows) counts.set(r.name, r.n);
			return counts;
		}
		catch (e) {
			// Zotero's database layout changed: fall back to its own tag list, without usage counts
			this.log("tag count query failed, listing tags without counts: " + e);
			let tags = await Zotero.Tags.getAll(libraryID, types);
			return new Map(tags.map(t => [t.tag ?? t.name, 0]));
		}
	},

	// Map of tag name -> { color, position }; empty if colors can't be read
	libraryColors(libraryID) {
		return this._try("reading tag colors", () => Zotero.Tags.getColors(libraryID)) || new Map();
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

	_byName(a, b) {
		return a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" });
	},

	// Colored tags first, in the order of their number keys, as in Zotero's tag selector
	_pinColored(list) {
		if (!this.pref("pinColored")) return list;
		let colored = list.filter(e => e.color).sort((a, b) => a.position - b.position);
		return colored.concat(list.filter(e => !e.color));
	},

	// Build the list shown in Add mode: [{ tag, count, color, position }]
	async buildList(libraryID, colors) {
		let source = this.pref("source");
		let caseMode = this.pref("caseMode");
		let counts = await this.libraryTagCounts(libraryID, this.pref("includeAutomatic"));
		let names = [];
		let warning = "";
		if (source == "library" || source == "both") {
			names.push(...counts.keys());
			// A colored tag can exist before any item has it
			names.push(...colors.keys());
		}
		if (source == "file" || source == "both") {
			let fromFile = await this.fileTags();
			if (fromFile === null) warning = "Couldn't read the tag file — check Settings › Tag Picker.";
			else if (!this.pref("filePath")) warning = "No tag file chosen — set one in Settings › Tag Picker.";
			else names.push(...fromFile);
		}
		// Colored tags keep their exact name: changing its case would make a different, uncolored tag
		let shownName = (name) => (caseMode == "asis" || colors.has(name)) ? name : this.applyCase(name, caseMode);
		// Merge by the cased form, summing usage counts of every spelling that maps to it
		let merged = new Map();
		for (let name of names) {
			let shown = shownName(name);
			if (!merged.has(shown)) merged.set(shown, 0);
		}
		for (let [name, n] of counts) {
			let shown = shownName(name);
			if (merged.has(shown)) merged.set(shown, merged.get(shown) + n);
		}
		let list = [...merged].map(([tag, count]) => {
			let c = colors.get(tag);
			return { tag, count, color: c?.color || null, position: c?.position ?? 0 };
		});
		if (this.pref("sortOrder") == "frequency") list.sort((a, b) => b.count - a.count || this._byName(a, b));
		else list.sort((a, b) => this._byName(a, b));
		return { list: this._pinColored(list), warning };
	},

	// Build the list shown in Remove mode: the tags on the selected items, exactly as named
	tagsOnItems(items, colors) {
		let counts = new Map();
		for (let item of items) {
			for (let { tag } of item.getTags()) counts.set(tag, (counts.get(tag) || 0) + 1);
		}
		let list = [...counts].map(([tag, count]) => {
			let c = colors.get(tag);
			return { tag, count, color: c?.color || null, position: c?.position ?? 0 };
		});
		list.sort((a, b) => b.count - a.count || this._byName(a, b));
		return this._pinColored(list);
	},

	// ---------- open + apply ----------

	async open(win, mode = "add") {
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
		// Where the keyboard focus was (usually the item list), to hand it back afterwards
		let prevFocus = win.document.activeElement;
		let colors = this.libraryColors(libraryID);
		let { list, warning } = await this.buildList(libraryID, colors);
		let io = {
			mode,
			list,
			removeList: this.tagsOnItems(items, colors),
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

		if (result.mode == "remove") {
			let changed = await this.removeTags(items, result.tags);
			this.notify(win, `Removed ${this._tagWords(result.tags)} from ${this._itemWords(changed)}.`, changed, prevFocus);
			return;
		}
		let changed = await this.applyTags(items, result.tags);
		this.notify(win, `Added ${this._tagWords(result.tags)} to ${this._itemWords(changed)}.`, changed, prevFocus);
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

	_tagWords(tags) {
		return tags.length == 1 ? `“${tags[0]}”` : `${tags.length} tags`;
	},

	_itemWords(n) {
		return `${n} item${n == 1 ? "" : "s"}`;
	},

	// Label this transaction's saves as one step in Zotero's Edit › Undo (Zotero 10+)
	_stageUndo(action, count) {
		if (!Zotero.UndoHistory?.stageAction) return;
		this._try("recording undo", () => Zotero.UndoHistory.stageAction(action, { count }));
	},

	_undoAvailable() {
		return !!(Zotero.UndoHistory?.isEnabled?.());
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
			if (changed) this._stageUndo("undo-action-add-tag", changed);
		});
		this.log(`added [${tags.join(", ")}] to ${changed} of ${items.length} item(s)`);
		return changed;
	},

	async removeTags(items, tags) {
		let changed = 0;
		await Zotero.DB.executeTransaction(async () => {
			for (let item of items) {
				let itemChanged = false;
				for (let tag of tags) {
					if (item.removeTag(tag)) itemChanged = true;
				}
				if (itemChanged) {
					await item.save();
					changed++;
				}
			}
			if (changed) this._stageUndo("undo-action-remove-tag", changed);
		});
		// Let Zotero clear out tags no item uses any more, as its own remove does
		if (changed) Zotero.Prefs.set("purge.tags", true);
		this.log(`removed [${tags.join(", ")}] from ${changed} of ${items.length} item(s)`);
		return changed;
	},

	// Brief confirmation in the corner of the Zotero window
	notify(win, text, changed, prevFocus) {
		this._try("showing the confirmation", () => {
			let pw = new Zotero.ProgressWindow({ window: win });
			pw.changeHeadline("Tag Picker");
			if (!changed) {
				pw.addDescription("No changes: the items were already tagged that way.");
			}
			else {
				pw.addDescription(text);
				if (this._undoAvailable()) {
					pw.addDescription(`To reverse it: Edit › Undo (${Zotero.isMac ? "⌘Z" : "Ctrl+Z"}).`);
				}
			}
			pw.show();
			pw.startCloseTimer(changed ? 5000 : 3000);
		});
		// On Windows the confirmation is its own window and takes the keyboard focus,
		// so Ctrl+Z (undo) would go to it instead of the library. Hand the focus back
		// once it has opened (it loads asynchronously, hence the repeats).
		let refocus = () => this._try("restoring focus", () => {
			win.focus();
			if (prevFocus?.isConnected) prevFocus.focus();
		});
		for (let ms of [0, 100, 300, 700]) win.setTimeout(refocus, ms);
	}
};
