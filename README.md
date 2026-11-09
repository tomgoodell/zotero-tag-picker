# Tag Picker for Zotero

Add tags to many Zotero items at once from a quick search-and-pick window, without reaching for the mouse.

Select one or more items, press **Ctrl+Alt+T** (**Cmd+Option+T** on a Mac), type a few letters, and press **Enter**. Pick as many tags as you like, then press **Enter** on the empty box to add them all to every selected item.

Works with **Zotero 10** on Windows, macOS and Linux.

## Install

1. Download the latest `zotero-tag-picker-<version>.xpi` from the [Releases page](https://github.com/tomgoodell/zotero-tag-picker/releases/latest).
   - In Firefox, right-click the link and choose **Save Link As…**. Otherwise Firefox tries to install it as a Firefox add-on.
2. In Zotero, open **Tools → Plugins**.
3. Click the gear icon (top right) and choose **Install Plugin From File…**, then pick the file you downloaded.

Zotero checks for new versions of Tag Picker automatically.

## Use

1. In your library, select the items you want to tag.
2. Press **Ctrl+Alt+T** (Mac: **Cmd+Option+T**), or right-click the items and choose **Add Tags…**.
3. Type to filter the list. Matches at the start of a tag come first, then matches at the start of any word, then anywhere.
4. Add a tag by clicking it or pressing **Enter**. Chosen tags appear above the list. If nothing matches what you typed, the last row offers to create it as a new tag.
5. When you're done, press **Enter** on the empty search box, press **Ctrl+Enter** (Mac: **Cmd+Enter**), or click **Apply**.

| Key | What it does |
|---|---|
| Enter | Add the highlighted tag, or apply when the box is empty |
| Ctrl+Enter / Cmd+Enter | Apply now |
| ↑ ↓ Page Up / Page Down | Move through the list |
| Backspace (empty box) | Remove the last chosen tag |
| Esc | Cancel without changing anything |

Items that already have a tag are left untouched.

## Settings

Open **Edit → Settings** (Mac: **Zotero → Settings**) and choose **Tag Picker** in the left column.

- **Where tags come from**
  - **Tags already used in this library** (the default).
  - **A text file of tags**, one per line. This is handy for keeping a fixed vocabulary.
  - **Both, merged.**
  - You can also include automatic tags (the ones added by journal databases), and choose whether new tags you type are saved to the text file.
- **Capitalization**: always lowercase (the default), ALWAYS UPPERCASE, Capitalize Each Word, or exactly as typed. Existing tags are shown and added in the chosen style.
- **List order**: most-used first, or alphabetical.
- **Keyboard shortcut**: type the combination out as text, such as `Ctrl+Shift+E`, `F13` or `Cmd+Option+T`. Pressing the keys in the box doesn't record them.
  - `Accel` means Ctrl on Windows and Linux, and Cmd on a Mac.
  - Leave the box empty for no shortcut. The right-click menu still works.

Changes take effect the next time you open the picker.

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
