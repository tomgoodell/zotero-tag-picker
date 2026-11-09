/* Tag Picker for Zotero — bootstrap entry points */

var TagPicker;
var chromeHandle;

function install() {}
function uninstall() {}

async function startup({ id, version, rootURI }) {
	var aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"]
		.getService(Ci.amIAddonManagerStartup);
	var manifestURI = Services.io.newURI(rootURI + "manifest.json");
	chromeHandle = aomStartup.registerChrome(manifestURI, [
		["content", "zotero-tag-picker", rootURI + "content/"]
	]);

	// The settings pane is independent of the picker: if one fails, the other still loads
	try {
		Zotero.PreferencePanes.register({
			pluginID: id,
			src: rootURI + "content/prefs.xhtml",
			scripts: [rootURI + "content/prefs-pane.js"],
			label: "Tag Picker"
		});
	}
	catch (e) {
		Zotero.debug("Tag Picker: registering the settings pane failed: " + e);
		Zotero.logError(e);
	}

	Services.scriptloader.loadSubScript(rootURI + "tagpicker.js");
	TagPicker.init({ id, version, rootURI });
	TagPicker.start();
}

function onMainWindowLoad({ window }) {
	TagPicker?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	TagPicker?.removeFromWindow(window);
}

function shutdown() {
	TagPicker?.stop();
	TagPicker = undefined;
	chromeHandle?.destruct();
	chromeHandle = null;
}
