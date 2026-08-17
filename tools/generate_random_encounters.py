#!/usr/bin/env python3
"""
Generate data/random-encounters.json from vault
`Session Planning/Random Encounters/*.md`.

Each file is a d100 (or dN) random-encounter table for a region.
Frontmatter shape:
  ---
  region: Aeloria Streets
  die: d100
  time: any | night | day
  tags: [urban, aeloria]
  entries:
    - range: [1, 10]
      description: A pickpocket lifts a coin pouch.
      monsters:
        - id: bandit
          count: 1
    - range: [11, 25]
      description: Two Watch officers stop the party for questioning.
      monsters:
        - id: guard
          count: 2
  ---

The body is prose the DM can read at the table.

Usage:
  python3 tools/generate_random_encounters.py [--vault PATH] [--out PATH]
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
    "D_D/Discovery D_D/Eldoria 2.0/Session Planning/Random Encounters"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/random-encounters.json")

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
        "region": fm.get("region") or path.stem,
        "die": fm.get("die", "d100"),
        "time": fm.get("time", "any"),
        "tags": fm.get("tags") or [],
        "entries": fm.get("entries") or [],
        "body": body,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)

    if not args.vault.exists():
        args.out.write_text(
            json.dumps({"tables": [], "generated": True}, indent=2),
            encoding="utf-8",
        )
        print(f"No vault folder at {args.vault} — wrote empty tables.")
        return

    tables = []
    for md_path in sorted(args.vault.glob("*.md")):
        if md_path.name.startswith("_"):
            continue
        t = extract(md_path)
        if t:
            tables.append(t)

    tables.sort(key=lambda t: t["region"].lower())
    args.out.write_text(
        json.dumps({"tables": tables, "generated": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {len(tables)} tables → {args.out}")
    for t in tables:
        print(f"  · {t['region']} ({t['die']}) — {len(t['entries'])} entries")


if __name__ == "__main__":
    main()
