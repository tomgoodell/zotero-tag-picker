// Default settings for Tag Picker (all under extensions.tagpicker.*)
pref("extensions.tagpicker.source", "library");        // library | file | both
pref("extensions.tagpicker.filePath", "");             // text file, one tag per line
pref("extensions.tagpicker.includeAutomatic", false);  // library source: also offer automatic tags
pref("extensions.tagpicker.saveNewToFile", true);      // add newly typed tags to the file (file / both)
pref("extensions.tagpicker.caseMode", "lower");        // lower | upper | title | asis
pref("extensions.tagpicker.sortOrder", "frequency");   // frequency | alpha
pref("extensions.tagpicker.pinColored", true);         // colored tags first, in number-key order
pref("extensions.tagpicker.shortcut", "Accel+Alt+T");  // Accel = Ctrl (Cmd on a Mac); e.g. F13; empty = no shortcut
pref("extensions.tagpicker.removeShortcut", "");       // opens the picker in Remove mode; empty = none
