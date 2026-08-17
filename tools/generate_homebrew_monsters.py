#!/usr/bin/env python3
"""
Generate data/homebrew-monsters.json from vault
`Session Planning/Homebrew Monsters/*.md`.

Each file's frontmatter becomes a monster entry that the combat tracker
merges into its catalog. See _SCHEMA.md in the folder for the format.

Usage:
  python3 tools/generate_homebrew_monsters.py [--vault PATH] [--out PATH]
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
    "D_D/Discovery D_D/Eldoria 2.0/Session Planning/Homebrew Monsters"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/homebrew-monsters.json")

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
    if fm.get("type") == "reference":
        return None  # skip _SCHEMA.md
    if not fm.get("id") or not fm.get("name"):
        print(f"  ! Missing id or name in {path.name}", file=sys.stderr)
        return None
    fm["homebrew"] = True
    fm["_source"] = path.name
    return fm


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)

    if not args.vault.exists():
        args.out.write_text(
            json.dumps({"monsters": [], "generated": True}, indent=2),
            encoding="utf-8",
        )
        print(f"No vault folder at {args.vault} — wrote empty homebrew monsters.")
        return

    monsters = []
    for md_path in sorted(args.vault.glob("*.md")):
        if md_path.name.startswith("_"):
            continue
        m = extract(md_path)
        if m:
            monsters.append(m)

    monsters.sort(key=lambda m: str(m.get("name", "")).lower())
    args.out.write_text(
        json.dumps({"monsters": monsters, "generated": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {len(monsters)} homebrew monsters → {args.out}")
    for m in monsters:
        print(f"  · {m.get('name')} (CR {m.get('cr', '?')})")


if __name__ == "__main__":
    main()
