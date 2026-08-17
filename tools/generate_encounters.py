#!/usr/bin/env python3
"""
Generate data/encounters.json from vault Session Planning/Encounters/ folder.
Each .md file with frontmatter becomes a preset the combat tracker can load.

Usage:
  python3 tools/generate_encounters.py [--vault PATH] [--out PATH]
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
    "D_D/Discovery D_D/Eldoria 2.0/Session Planning/Encounters"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/encounters.json")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.DOTALL)


def extract(path: Path):
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        print(f"  ! YAML error in {path.name}: {e}", file=sys.stderr)
        return None
    body = m.group(2).strip()
    return {
        "id": path.stem.lower().replace(" ", "-").replace("'", "").replace("—", "-"),
        "title": fm.get("title") or path.stem,
        "description": fm.get("description", ""),
        "cr": str(fm.get("cr", "")),
        "difficulty": fm.get("difficulty", ""),
        "tags": fm.get("tags") or [],
        "monsters": fm.get("monsters") or [],
        "body": body,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if not args.vault.exists():
        # Empty output — folder may not exist yet
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps({"encounters": [], "generated": True}, indent=2), encoding="utf-8")
        print(f"No vault folder at {args.vault} — wrote empty encounters.json")
        return

    encounters = []
    for md_path in sorted(args.vault.glob("*.md")):
        if md_path.name.startswith("_"):
            continue
        e = extract(md_path)
        if e:
            encounters.append(e)

    encounters.sort(key=lambda x: x["title"].lower())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"encounters": encounters, "generated": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {len(encounters)} encounters → {args.out}")
    for e in encounters:
        cnt = sum(m.get("count", 1) for m in e["monsters"])
        print(f"  · {e['title']} — {cnt} combatants, CR {e['cr'] or '?'}")


if __name__ == "__main__":
    main()
