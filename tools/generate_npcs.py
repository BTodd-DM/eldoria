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


AELORIA_MARKERS = [
    "aeloria", "spire of the silver eclipse", "silver eclipse",
    "wayfarer's rest", "wayfarers rest", "pig's head", "pigs head",
    "temple of luminos", "grand bazaar", "kolt's depot", "kolts depot",
    "scholars' circle", "scholars circle", "high spires", "merchants rise",
    "ashgate", "copper light", "city hall", "aelorian territories",
]
IRONHOLD_MARKERS = [
    "ironhold", "grey kettle", "broken anvil", "ashfall", "envoy's rest",
    "envoys rest", "anvilhome", "forge council", "foundry row",
    "warehouse #14", "warehouse 14", "the slag", "rustpocket",
    "council ward", "stonecut", "halvor's compound",
]

def bucket_location(loc: str) -> str:
    """Bucket a free-form location string into a display region."""
    low = (loc or "").lower()
    if any(m in low for m in IRONHOLD_MARKERS): return "Ironhold"
    if any(m in low for m in AELORIA_MARKERS):  return "Aeloria Crossroads"
    if "aurum" in low or "auranova" in low or "aurora peaks" in low: return "Aurora Peaks"
    if "frostwood" in low:     return "Frostwood Marsh"
    if "verdant" in low or "sylvarian" in low: return "Verdant Expanse"
    if "stonemarked" in low or "duskmere" in low: return "Northern Reaches"
    if "ember" in low or "wastes" in low: return "Ember Wastes"
    if "serpent" in low or "azure" in low: return "Serpent Isles"
    if "celestial" in low:     return "Celestial Plateau"
    if "stillbrook" in low:    return "On the Road"
    return "On the Road"


def extract_npc(path: Path, fm: dict) -> dict:
    name = fm.get("title") or path.stem
    region = fm.get("player-region") or bucket_location(str(fm.get("location", "")))
    return {
        "id": path.stem.lower().replace(" ", "-").replace("'", ""),
        "name": name,
        "role": fm.get("player-role", ""),
        "avatar": fm.get("player-avatar", "".join(w[0] for w in str(name).split()[:2]).upper()),
        "avatarBg": fm.get("player-avatar-bg", ""),
        "summary": fm.get("player-summary", ""),
        "badges": normalise_badges(fm.get("player-badges")),
        "order": fm.get("player-order", 999),
        "region": region,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if not args.vault.exists():
        sys.exit(f"Vault path does not exist: {args.vault}")

    npcs = []
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
        if not fm.get("player-visible"):
            skipped_hidden += 1
            continue
        if is_hard_blocked(md_path, fm):
            print(f"  ⚠  HARD-BLOCKED: {md_path.name} (Aurek alias detected)")
            skipped_blocked += 1
            continue
        # Only show NPCs the party has actually met or heard about.
        # Accept either tag `met` / `heard-of` or explicit frontmatter
        # `player-status: met|heard-of` (heard-of shown with a note badge).
        tags = [str(t).lower() for t in (fm.get("tags") or [])]
        status = str(fm.get("player-status") or "").lower()
        has_met = "met" in tags or status == "met"
        has_heard = "heard-of" in tags or "heard_of" in tags or status in ("heard-of", "heard_of")
        if not (has_met or has_heard):
            skipped_hidden += 1
            continue
        npc = extract_npc(md_path, fm)
        if has_heard and not has_met:
            npc.setdefault("badges", []).insert(0, {"text": "heard about", "color": "grey"})
        npcs.append(npc)

    npcs.sort(key=lambda n: (n["order"], n["name"].lower()))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"npcs": npcs, "generated": True}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print()
    print(f"Scanned:        {scanned}")
    print(f"Visible:        {len(npcs)}")
    print(f"Hidden (flag):  {skipped_hidden}")
    print(f"Hard-blocked:   {skipped_blocked}")
    print(f"Written:        {args.out}")
    print()
    for n in npcs:
        print(f"  {n['order']:>3}. {n['name']} — {n['role']}")


if __name__ == "__main__":
    main()
