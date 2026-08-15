#!/usr/bin/env python3
"""
Generate data/npcs.json from vault NPC frontmatter.

Reads every .md file in the vault's Characters/NPCs directory (skipping Groups/),
filters to entries with player-visible: true, extracts player-* frontmatter fields,
and writes a sorted JSON file that the player site consumes at runtime.

Hard-blocks: any NPC with an `alias` field that includes "Aurek" is force-hidden
regardless of player-visible — belt-and-braces against accidental Aurek exposure.

Usage:
  python3 tools/generate_npcs.py [--vault PATH] [--out PATH]

Defaults assume Brad's local paths.
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
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/npcs.json")
DEFAULT_OUT_DM = Path("/Users/Brad/Documents/GitHub/eldoria/data/npcs-dm.json")

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


def is_hard_blocked(path: Path, fm: dict) -> bool:
    """Belt-and-braces: never publish files whose *identity* is Aurek.
    Checks filename stem and title, NOT the alias field (which is DM-only
    metadata that Vaeloran's file legitimately carries)."""
    stem_low = path.stem.lower()
    title_low = str(fm.get("title", "")).lower()
    return "aurek" in stem_low or "aurek" in title_low


def normalise_badges(raw) -> list:
    """Accept badges as list of dicts {text, color} or plain strings."""
    if not raw:
        return []
    out = []
    for item in raw:
        if isinstance(item, dict):
            out.append({
                "text": str(item.get("text", "")).strip(),
                "color": str(item.get("color", "grey")).strip().lower(),
            })
        elif isinstance(item, str):
            out.append({"text": item.strip(), "color": "grey"})
    return [b for b in out if b["text"]]


def extract_npc(path: Path, fm: dict, dm_view: bool = False) -> dict:
    name = fm.get("title") or path.stem
    role = fm.get("player-role") or (fm.get("role", "") if dm_view else "")
    summary = fm.get("player-summary") or (fm.get("role", "") if dm_view else "")
    return {
        "id": path.stem.lower().replace(" ", "-").replace("'", ""),
        "name": name,
        "role": role,
        "avatar": fm.get("player-avatar", "".join(w[0] for w in str(name).split()[:2]).upper()),
        "avatarBg": fm.get("player-avatar-bg", ""),
        "summary": summary,
        "badges": normalise_badges(fm.get("player-badges")),
        "order": fm.get("player-order", 999),
        "visible": bool(fm.get("player-visible")),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--out-dm", type=Path, default=DEFAULT_OUT_DM)
    args = parser.parse_args()

    if not args.vault.exists():
        sys.exit(f"Vault path does not exist: {args.vault}")

    player_npcs = []
    dm_npcs = []
    skipped_hidden = 0
    skipped_blocked = 0
    scanned = 0

    for md_path in sorted(args.vault.glob("*.md")):
        if md_path.name.startswith("_"):
            continue
        scanned += 1
        fm = parse_frontmatter(md_path)
        if fm is None:
            continue
        if is_hard_blocked(md_path, fm):
            print(f"  ⚠  HARD-BLOCKED: {md_path.name} (Aurek alias detected)")
            skipped_blocked += 1
            continue
        # DM list: every NPC (visible + hidden).
        dm_entry = extract_npc(md_path, fm, dm_view=True)
        dm_npcs.append(dm_entry)
        # Player list: only player-visible NPCs.
        if fm.get("player-visible"):
            player_npcs.append(extract_npc(md_path, fm, dm_view=False))
        else:
            skipped_hidden += 1

    player_npcs.sort(key=lambda n: (n["order"], n["name"].lower()))
    dm_npcs.sort(key=lambda n: (n["name"].lower()))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"npcs": player_npcs, "generated": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    args.out_dm.parent.mkdir(parents=True, exist_ok=True)
    args.out_dm.write_text(
        json.dumps({"npcs": dm_npcs, "generated": True, "dm": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print()
    print(f"Scanned:        {scanned}")
    print(f"Player list:    {len(player_npcs)} → {args.out}")
    print(f"DM list:        {len(dm_npcs)} → {args.out_dm}")
    print(f"Hidden (flag):  {skipped_hidden}")
    print(f"Hard-blocked:   {skipped_blocked}")
    print()
    print("Player-visible NPCs (in render order):")
    for n in player_npcs:
        print(f"  {n['order']:>3}. {n['name']} — {n['role']}")


if __name__ == "__main__":
    main()
