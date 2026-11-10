# Changelog

## 1.3.0 — first public release

- Search-and-pick window for adding tags to every selected item at once.
- **Remove mode**: pick from the tags on the selected items and take them off all of them. Switch with the buttons at the top, or Ctrl+R (Cmd+R on a Mac).
- **Undo**: every add or remove is one step in Zotero's own Edit › Undo (Ctrl+Z / Cmd+Z), with Redo.
- **Tag colors**: colored tags show their color and, optionally, come first in number-key order. They always keep their exact name.
- Tags come from your library, a text file, or both.
- Capitalization: lowercase, UPPERCASE, Title Case, or as typed.
- List sorted by how often each tag is used, or alphabetically.
- Keyboard shortcuts for Add (default Ctrl+Alt+T / Cmd+Option+T) and Remove (off by default), set by pressing the keys in Settings. "Add Tags…" and "Remove Tags…" are on the item right-click menu.
- A short confirmation appears after each change.
- **Help** window explaining every setting and key: the ? button or F1 in the picker, or "Tag Picker Help…" in Settings.
- Letter shortcuts are ignored while you're typing in a note or field.
- Works on Windows, macOS and Linux, and degrades gracefully if a future Zotero changes the menu, database or file-picker internals it relies on.
