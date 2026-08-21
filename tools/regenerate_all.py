#!/usr/bin/env python3
"""Run every JSON generator in one shot. Use after vault edits."""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

GENERATORS = [
    "generate_npcs.py",
    "generate_cues.py",
    "generate_search_index.py",
    "generate_encounters.py",
    "generate_random_encounters.py",
    "generate_homebrew_monsters.py",
    "backup_monsters_to_vault.py",
]

def main():
    print("=" * 60)
    print("Regenerating all data JSONs from vault…")
    print("=" * 60)
    failed = 0
    for name in GENERATORS:
        script = HERE / name
        if not script.exists():
            print(f"\n! Skipping {name} — not found")
            continue
        print(f"\n▶  {name}")
        print("-" * 60)
        result = subprocess.run([sys.executable, str(script)])
        if result.returncode != 0:
            failed += 1
            print(f"! {name} exited {result.returncode}")
    print("\n" + "=" * 60)
    print(f"Done. {len(GENERATORS) - failed} / {len(GENERATORS)} generators succeeded.")
    if failed:
        sys.exit(1)

if __name__ == "__main__":
    main()
