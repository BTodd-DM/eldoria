#!/usr/bin/env python3
"""
Generate data/lore.json from vault Lore Facts frontmatter.

Reads every .md file in the vault's Lore Facts directory, extracts
the fact metadata, and writes a sorted JSON file that the site consumes.

Usage:
  python3 tools/generate_lore.py [--vault PATH] [--out PATH]
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
    "D_D/Discovery D_D/Eldoria 2.0/Lore Facts"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/lore.json")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def parse_frontmatter(path: Path) -> dict | None:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ! Cannot read {path.name}: {e}", file=sys.stderr)
        return None
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        print(f"  ! YAML error in {path.name}: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if not args.vault.exists():
        sys.exit(f"Vault path does not exist: {args.vault}")

    facts = []
    for md_path in sorted(args.vault.glob("*.md")):
        if md_path.name.startswith("_"):
            continue
        fm = parse_frontmatter(md_path)
        if fm is None:
            continue
        fid = fm.get("id") or md_path.stem.lower().replace(" ", "-").replace("'", "")
        facts.append({
            "id": str(fid),
            "topic": fm.get("topic", ""),
            "text": fm.get("text", ""),
            "spoiler": fm.get("spoiler-level", "revealed"),
            "order": fm.get("player-order", 999),
            "initialKnown": fm.get("initial-known", {}) or {},
        })

    # Sort by (topic, order) for stable output
    facts.sort(key=lambda f: (f["topic"].lower(), f["order"]))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"facts": facts, "generated": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Scanned:  {len(facts)}")
    print(f"Written:  {args.out}")
    print()
    print("Facts by topic:")
    current_topic = None
    for f in facts:
        if f["topic"] != current_topic:
            current_topic = f["topic"]
            print(f"\n  {current_topic}")
        marks = "".join("✓" if f["initialKnown"].get(pc, False) else "·" for pc in ("torren", "sylas", "orin"))
        print(f"    [{marks}]  {f['text'][:70]}{'…' if len(f['text']) > 70 else ''}")


if __name__ == "__main__":
    main()
