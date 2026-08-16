#!/usr/bin/env python3
"""
Generate data/search-index.json from vault content for DM global search.

Scans predefined vault folders, extracts title / type / path / body /
tags from each .md file, and writes a single flat index the client can
filter live. Body is capped to keep the JSON size reasonable.

DM-only search — never referenced from players.html. Full unrestricted
content indexed (including DM-eyes-only sections).

Usage:
  python3 tools/generate_search_index.py [--vault PATH] [--out PATH]
"""
import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("Requires PyYAML: pip3 install pyyaml")

DEFAULT_VAULT = Path(
    "/Users/Brad/Library/CloudStorage/OneDrive-WAVERLEYCHRISTIANCOLLEGE/"
    "D_D/Discovery D_D/Eldoria 2.0"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/search-index.json")

# Folders to scan, and the "type" label to attach to each entry.
FOLDERS = [
    ("Characters/NPCs",       "npc"),
    ("Characters/Player Characters", "pc"),
    ("Locations",             "location"),
    ("Plot Threads",          "plot"),
    ("Factions",              "faction"),
    ("Items and Artifacts",   "item"),
    ("Lore Facts",            "lore-fact"),
    ("Session Recaps",        "session-recap"),
    ("Session Planning",      "session-prep"),
    ("Bestiary",              "monster"),
    ("Pantheon",              "pantheon"),
    ("Lore and Legends",      "lore"),
    ("History",               "history"),
    ("Campaign Companion",    "meta"),
]

BODY_CAP = 800  # chars per entry — bounds JSON size while keeping useful excerpts

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def extract(path: Path) -> dict | None:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return None
    m = FRONTMATTER_RE.match(text)
    body = text[m.end():] if m else text
    fm = {}
    if m:
        try:
            fm = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError:
            fm = {}
    # Title: frontmatter or first # heading or filename
    title = fm.get("title")
    if not title:
        th = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
        title = th.group(1).strip() if th else path.stem
    # Strip markdown syntax for the body excerpt
    plain = body
    plain = re.sub(r"^#+\s+", "", plain, flags=re.MULTILINE)
    plain = re.sub(r"\[\[([^\]|]+\|)?([^\]]+)\]\]", r"\2", plain)  # wiki-links → display text
    plain = re.sub(r"\*\*([^*]+)\*\*", r"\1", plain)
    plain = re.sub(r"\*([^*]+)\*", r"\1", plain)
    plain = re.sub(r"`([^`]+)`", r"\1", plain)
    plain = re.sub(r"^>\s*", "", plain, flags=re.MULTILINE)
    plain = re.sub(r"^\|.*$", "", plain, flags=re.MULTILINE)  # table rows
    plain = re.sub(r"\s+", " ", plain).strip()
    if len(plain) > BODY_CAP:
        plain = plain[:BODY_CAP].rsplit(" ", 1)[0] + "…"
    tags_raw = fm.get("tags") or []
    if isinstance(tags_raw, str):
        tags = [tags_raw]
    elif isinstance(tags_raw, list):
        tags = [str(t) for t in tags_raw]
    else:
        tags = []
    return {
        "id": path.stem.lower().replace(" ", "-").replace("'", ""),
        "title": str(title),
        "body": plain,
        "tags": tags,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if not args.vault.exists():
        sys.exit(f"Vault path does not exist: {args.vault}")

    entries = []
    counts = {}
    for folder, kind in FOLDERS:
        base = args.vault / folder
        if not base.exists():
            continue
        for md_path in sorted(base.rglob("*.md")):
            # Skip index / archive / obviously-DM-only helper files
            name = md_path.name
            if name.startswith("_"):
                continue
            entry = extract(md_path)
            if not entry:
                continue
            rel_path = str(md_path.relative_to(args.vault))
            entry["type"] = kind
            entry["path"] = rel_path
            entries.append(entry)
            counts[kind] = counts.get(kind, 0) + 1

    # Alphabetical by title within type — client can regroup
    entries.sort(key=lambda e: (e["type"], e["title"].lower()))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"entries": entries, "generated": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    total = len(entries)
    size_kb = args.out.stat().st_size / 1024
    print(f"Indexed {total} entries → {args.out} ({size_kb:.1f} KB)")
    for k in sorted(counts):
        print(f"  {k:<15} {counts[k]:>4}")


if __name__ == "__main__":
    main()
