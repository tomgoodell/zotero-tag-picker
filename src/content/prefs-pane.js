/* Tag Picker — settings pane */

var TagPicker_Prefs = {
	async browse() {
		var { FilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");
		var fp = new FilePicker();
		fp.init(window, "Choose a tag file", fp.modeOpen);
		fp.appendFilters(fp.filterText);
		fp.appendFilters(fp.filterAll);
		var current = Zotero.Prefs.get("extensions.tagpicker.filePath", true);
		if (current) {
			try {
				fp.displayDirectory = PathUtils.parent(current);
			}
			catch (e) {}
		}
		if ((await fp.show()) != fp.returnOK) return;
		// Setting the pref updates the text box through its preference binding
		Zotero.Prefs.set("extensions.tagpicker.filePath", fp.file, true);
	}
};
