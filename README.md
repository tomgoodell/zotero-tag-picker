# Tag Picker for Zotero

Add or remove tags on many Zotero items at once from a quick search-and-pick window, without reaching for the mouse.

Select one or more items, press **Ctrl+Alt+T** (**Cmd+Option+T** on a Mac), type a few letters, and press **Enter**. Pick as many tags as you like, then press **Enter** on the empty box to add them all to every selected item. Changed your mind? **Edit › Undo**.

Works with **Zotero 10** on Windows, macOS and Linux.

## Install

1. Download the latest `zotero-tag-picker-<version>.xpi` from the [Releases page](https://github.com/tomgoodell/zotero-tag-picker/releases/latest).
   - In Firefox, right-click the link and choose **Save Link As…**. Otherwise Firefox tries to install it as a Firefox add-on.
2. In Zotero, open **Tools → Plugins**.
3. Click the gear icon (top right) and choose **Install Plugin From File…**, then pick the file you downloaded.

Zotero checks for new versions of Tag Picker automatically.

## Use

1. In your library, select the items you want to tag.
2. Press **Ctrl+Alt+T** (Mac: **Cmd+Option+T**), or right-click the items and choose **Add Tags…** or **Remove Tags…**.
3. Type to filter the list. Matches at the start of a tag come first, then matches at the start of any word, then anywhere.
4. Pick a tag by clicking it or pressing **Enter**. Picked tags appear below the list. In Add mode, if nothing matches what you typed, the last row offers to create it as a new tag.
5. When you're done, press **Enter** on the empty search box, press **Ctrl+Enter** (Mac: **Cmd+Enter**), or click **Add** / **Remove**.

**Removing tags:** click **Remove tags** at the top of the window, or press **Ctrl+R** (Mac: **Cmd+R**). The list then shows the tags on the selected items, with how many of them have each one, such as "3 of 5".

**Undo:** each add or remove is a single step in Zotero's **Edit › Undo** (Ctrl+Z / Cmd+Z), and **Redo** works too. Zotero won't undo if something else has changed the items since.

**Tag colors:** tags you've given a color in Zotero show a colored dot. By default they're listed first, in the same order as their number keys.

| Key | What it does |
|---|---|
| Enter | Pick the highlighted tag, or apply when the box is empty |
| Ctrl+Enter / Cmd+Enter | Apply now |
| Ctrl+R / Cmd+R | Switch between Add and Remove |
| ↑ ↓ Page Up / Page Down | Move through the list |
| Backspace (empty box) | Unpick the last picked tag |
| F1 (or the ? button) | Help |
| Esc | Cancel without changing anything |

When you add a tag, items that already have it are left untouched.

## Settings

Open **Edit → Settings** (Mac: **Zotero → Settings**) and choose **Tag Picker** in the left column.

- **Where tags come from** (for adding):
  - **Tags already used in this library** (the default): every tag on at least one item in the library you're tagging in, which is My Library or the group the items belong to.
    - Tags from your other libraries, tags only on items in the trash, and automatic tags are left out. You can switch on automatic tags with the checkbox.
    - Colored tags are always included.
  - **A text file of tags**, one per line. Only the tags in your file are offered, which is handy for a fixed vocabulary or for sharing one list across libraries and computers.
  - **Both, merged**: everything from both, with duplicates shown once.
  - You can choose whether new tags you type are saved to the text file.
  - Remove mode always lists exactly the tags on the selected items.
- **Capitalization**: always lowercase (the default), ALWAYS UPPERCASE, Capitalize Each Word, or exactly as typed. Existing tags are shown and added in the chosen style. Colored tags always keep their exact name.
- **List order**: most-used first, or alphabetical. Optionally, colored tags come first.
- **Keyboard shortcuts**: there's one for opening in Add mode and one for opening in Remove mode, which is off by default.
  - Click a box and press the keys you want.
  - Backspace clears a box, and Esc leaves it unchanged.
  - Letter and number keys need Ctrl or Alt (Cmd, Option or Control on a Mac), so they don't get in the way of typing.

Changes take effect the next time you open the picker. The **Tag Picker Help…** button at the top of the pane explains every setting.

## Privacy

Tag Picker works entirely inside Zotero. It sends nothing over the network. The only file it reads or writes is the tag file you choose in its settings, if any.

## Build from source

Requires Python 3.

```
python build.py
```

This writes `build/zotero-tag-picker-<version>.xpi` and updates `updates.json`.

## License

[MIT](LICENSE)
