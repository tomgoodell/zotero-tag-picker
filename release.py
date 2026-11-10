"""Publish a new version of Tag Picker on GitHub.

    python release.py

Before running: bump "version" in src/manifest.json, add a "## <version>" section to
CHANGELOG.md, and commit. This then builds the .xpi, commits the refreshed updates.json,
pushes, and creates the GitHub release v<version> with the .xpi attached. Installed copies
of the plugin pick up the new version from updates.json on their next update check.
Needs Python 3, git, and the GitHub CLI (gh) logged in to the repository's account.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))


def run(*args, capture=False):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=capture)
    if result.returncode != 0:
        if capture:
            sys.stderr.write(result.stdout + result.stderr)
        sys.exit(f"failed: {' '.join(args)}")
    return result.stdout if capture else None


manifest = json.load(open(os.path.join(ROOT, "src", "manifest.json"), encoding="utf-8"))
version = manifest["version"]
tag = f"v{version}"

# Everything except updates.json (which the build rewrites) must already be committed
dirty = [line for line in run("git", "status", "--porcelain", capture=True).splitlines()
         if not line.endswith("updates.json")]
if dirty:
    sys.exit("Commit these changes first:\n" + "\n".join(dirty))

if run("git", "tag", "--list", tag, capture=True).strip():
    sys.exit(f"{tag} already exists. Bump the version in src/manifest.json first.")

changelog = open(os.path.join(ROOT, "CHANGELOG.md"), encoding="utf-8").read()
section = re.search(rf"^## {re.escape(version)}\b.*?$(.*?)(?=^## |\Z)", changelog, re.M | re.S)
if not section:
    sys.exit(f"CHANGELOG.md has no '## {version}' section.")
notes = section.group(1).strip()

run(sys.executable, "build.py")
xpi = os.path.join("build", f"zotero-tag-picker-{version}.xpi")

if run("git", "status", "--porcelain", "updates.json", capture=True).strip():
    run("git", "commit", "-q", "-m", f"updates.json for {version}", "updates.json")
run("git", "push", "-q", "origin", "main")

with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
    f.write(notes + "\n")
    notes_file = f.name
try:
    run("gh", "release", "create", tag, xpi, "--target", "main",
        "--title", f"Tag Picker {version}", "--notes-file", notes_file)
finally:
    os.remove(notes_file)

print(f"released {tag}")
