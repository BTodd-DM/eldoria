#!/usr/bin/env python3
"""
Generate data/cues.json from vault NPC frontmatter.

Scans every .md in Characters/NPCs/ and emits an entry for any NPC that has
a `cue:` block. Output is DM-only — this JSON is never referenced by
players.html. cue-cards.js consumes it on the DM dashboard.

Usage:
  python3 tools/generate_cues.py [--vault PATH] [--out PATH]
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
    "D_D/Discovery D_D/Eldoria 2.0/Characters/NPCs"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/cues.json")

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

    cues = []
    for md_path in sorted(args.vault.glob("*.md")):
        if md_path.name.startswith("_"):
            continue
        fm = parse_frontmatter(md_path)
        if fm is None:
            continue
        cue = fm.get("cue")
        if not cue or not isinstance(cue, dict):
            continue
        title = fm.get("title") or md_path.stem
        cid = md_path.stem.lower().replace(" ", "-").replace("'", "")
        cues.append({
            "id": cid,
            "name": title,
            "role": str(fm.get("role", "")),
            "location": str(fm.get("location", "")),
            "voice": str(cue.get("voice", "")),
            "opening": str(cue.get("opening", "")),
            "wants": str(cue.get("wants", "")),
            "secrets": list(cue.get("secrets") or []),
            "exit": str(cue.get("exit", "")),
        })

    cues.sort(key=lambda c: c["name"].lower())

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"cues": cues, "generated": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Cue cards found: {len(cues)}")
    print(f"Written:         {args.out}")
    for c in cues:
        print(f"  · {c['name']} — {c['role'][:60]}")


if __name__ == "__main__":
    main()
