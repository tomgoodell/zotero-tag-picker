"""Build the Tag Picker .xpi and refresh updates.json.

    python build.py

Reads the version from src/manifest.json, writes build/zotero-tag-picker-<version>.xpi,
and points updates.json at that file's GitHub release download (tag v<version>).
The zip uses fixed timestamps, so the same source always gives the same file and hash.
"""
import hashlib
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
REPO = "tomgoodell/zotero-tag-picker"

manifest = json.load(open(os.path.join(SRC, "manifest.json"), encoding="utf-8"))
version = manifest["version"]
addon_id = manifest["applications"]["zotero"]["id"]
min_version = manifest["applications"]["zotero"]["strict_min_version"]
max_version = manifest["applications"]["zotero"]["strict_max_version"]

os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
xpi_name = f"zotero-tag-picker-{version}.xpi"
xpi_path = os.path.join(ROOT, "build", xpi_name)

files = []
for folder, _, names in os.walk(SRC):
    for name in names:
        full = os.path.join(folder, name)
        files.append((os.path.relpath(full, SRC).replace(os.sep, "/"), full))
files.sort()

with zipfile.ZipFile(xpi_path, "w", zipfile.ZIP_DEFLATED) as z:
    for arcname, full in files:
        info = zipfile.ZipInfo(arcname, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        with open(full, "rb") as f:
            z.writestr(info, f.read())

sha256 = hashlib.sha256(open(xpi_path, "rb").read()).hexdigest()

updates = {
    "addons": {
        addon_id: {
            "updates": [
                {
                    "version": version,
                    "update_link": f"https://github.com/{REPO}/releases/download/v{version}/{xpi_name}",
                    "update_hash": f"sha256:{sha256}",
                    "applications": {
                        "zotero": {
                            "strict_min_version": min_version,
                            "strict_max_version": max_version,
                        }
                    },
                }
            ]
        }
    }
}
with open(os.path.join(ROOT, "updates.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(updates, f, indent=2)
    f.write("\n")

print(f"built build/{xpi_name}")
print(f"sha256 {sha256}")
print("updated updates.json")
