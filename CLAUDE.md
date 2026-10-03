# CLAUDE.md — The Wayward Company (Eldoria 2.0)

Read this first, every session. Then read the vault's **DM Working Notes** (path below) before proposing any work — it holds the update log, deferred work, open questions and the full rule set.

## What this is

A static D&D 5e (2024 rules) campaign site for Brad's group, **The Wayward Company**, hosted on GitHub Pages. Three parts:

- **This repo** — `/Users/Brad/Documents/GitHub/eldoria/` → `https://BTodd-DM.github.io/eldoria/`
  - `index.html` — DM dashboard (password-gated)
  - `players.html` — player site (per-player identity)
  - `sheet.html` + `sheet-*.js` — interactive character sheets
  - `statblock.html`, `bestiary.html`, `world_map.html`, `aeloria_map.html`, `ironhold_map.html`
  - `data/*.json` — generated from the vault by `tools/*.py` — **never hand-edit; regenerate**
  - `maps/` — map images, copied in from the vault by `tools/generate_maps.py`
- **The Obsidian vault (source of truth for all campaign content)** —
  `/Users/Brad/Library/CloudStorage/OneDrive-WAVERLEYCHRISTIANCOLLEGE/D_D/Discovery D_D/Eldoria 2.0/`
  - Working notes: `Campaign Companion/DM Working Notes.md`
  - Current state: `00 - Current State.md`
  - Session prep: `Session Planning/` (lowest-numbered file = current session; played sessions move to `Session Planning/Archive/`)
  - Recaps: `Session Recaps/` · NPCs: `Characters/NPCs/` (+ `Groups/`) · Factions: `Factions/` · Maps: `Maps/`
  - PC backstories (verbatim, never paraphrase): `Characters/Player Characters/_Backstories - Verbatim Reference.md`
- **Firebase Realtime Database** — project `wayward-company`, free tier. Live sheet state, notes, combat, reveal trackers (`pantheon-knowledge`, `map-knowledge`, etc.). Rules in `firebase-rules.json`.

## Who you're working with

Brad — the DM. A teacher, not a programmer. Explain in plain English, keep it short, no jargon without a one-line gloss. He decides; you propose.

## Workflow rules (non-negotiable)

1. **Plan before editing site files.** For anything in this repo: propose the whole change in one short paragraph (goal, files touched, what could break, any choices he needs to make), then **wait for a clear yes** ("OK", "go", "yes", "do it", "ship it", "proceed", or a direct instruction). Screenshots or raw data are *not* approval. Aim for one edit, one commit — not edit → discover → patch loops.
2. **Vault files can be edited freely** as things are agreed in conversation. No approval needed, no commit (the vault is OneDrive, not git).
3. **Every repo change ends with a commit.** Title format: `Update N — short summary` (or a clear title if there's no update number), blank line, short bullet list of what changed and which files. Show it to Brad before committing. **Commit and push only after he says yes.**
4. **Number every update.** New work gets the next update number. Log it in DM Working Notes → "Numbered updates plan". Current next number: **61** (see Working Notes for 49–60).
5. **Deferred work gets written down immediately** in DM Working Notes → "Deferred work", in the same turn.
6. **After any JS/HTML push**, end with: `Hard-refresh: Cmd+Shift+R.`
7. **Anything user-facing ends with a `Test:` line** — one sentence on what to click to confirm it works.
8. **New Firebase path?** Top of the response: `⚠️ NEW FIREBASE PATH — publish rules before this works: /xyz` plus the link https://console.firebase.google.com/project/wayward-company/database/wayward-company-default-rtdb/rules — and give the rule in condensed one-line form for pasting.
9. **Vault frontmatter changed?** Run the matching generator (or `python3 tools/regenerate_all.py`) in the same turn.

## Content rules

- **No spoilers on player-facing surfaces** (`players.html`, `sheet.html`, `?player` maps, NPC directory, notes). Only show what the party has seen or plausibly learned. When unsure, keep it DM-only and ask.
- **Aurek Voln Drowhiss = Vaeloran Duskwhisper** — never on the player site. Only the party can discover it; no NPC discovery clocks.
- **Guilded Veil and Coin Cipher are separate organisations.** Never merge them.
- **Vaeloran's lichdom follows standard 5e rules** — no homebrew stage clocks.
- **Items and spells: official 2024 books only.** No homebrew unless Brad asks. Write mechanical summaries in your own words — don't reproduce published text.
- **Gods: only the canonical Eldoria pantheon** (Korvain, Luminos, Naturus, Thalasia, Aetherius, Sylvana, Solara, Mor'nyx, Lunara, Vellaris…). Never invent deities.
- **Calendar:** 12 months × 30 days; the 7-day **Lightweek** is Daystar, Moonwake, Stonefast, Greentide, Hearthen, Skywatch, Stillday. Never use real-world weekday names.
- **Names:** check the vault for clashes before inventing one (we've had to rename Halven, Halverin, three Miras, two Brams, Jorren).
- **Maps stay evergreen** — no "currently / post-Session N / party is at X" in map hotspot text.
- **XP is DM-only.** Never on the player site.
- **Free tier only.** No paid services.

## How the pipeline works

Vault `.md` (with YAML frontmatter) → `tools/generate_*.py` → `data/*.json` → site loads JSON at runtime.

| Generator | Reads | Writes |
|---|---|---|
| `generate_npcs.py` | `Characters/NPCs/` (`player-visible: true` only) | `data/npcs.json` |
| `generate_cues.py` | NPC cue frontmatter | `data/cues.json` |
| `generate_current_session.py` | lowest `Session Planning/Session NN` | `data/current-session.json` |
| `generate_factions.py` | `Factions/` | `data/factions.json` |
| `generate_maps.py` | `Maps/` (+ copies images to `maps/`) | `data/maps.json` |
| `generate_search_index.py` | whole vault | `data/search-index.json` |
| `generate_encounters.py`, `generate_random_encounters.py`, `generate_homebrew_monsters.py` | encounter / bestiary folders | `data/*.json` |
| `backup_monsters_to_vault.py` | Firebase `/monster-homebrew` | vault `Bestiary/from-app/` |
| `regenerate_all.py` | runs all of the above | — |

Python needs `pyyaml` and `markdown` (`pip3 install pyyaml markdown`).

## Session recap batch (when Brad brings a session recording)

Recaps are written in the **Cowork** tab, not here. Site-side follow-ups that land here: `players.html` recap card (new "Most recent" tag), `data/synopsis.json` (bump `version`), NPC `player-visible` flips + regenerate, archive the played session file so the next one becomes current.

## Style

Concise. No preamble. Lists for comparing options; prose otherwise. Ask before big batches.
