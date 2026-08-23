#!/usr/bin/env python3
"""
Generate data/factions.json from the vault's Factions folder.

One entry per faction file (skips _Factions Index.md and Faction Relationship
Map.md). Each entry has:
  - id       : slug of the file
  - title    : from H1 or frontmatter title, falls back to filename
  - summary  : first blockquote paragraph if present, else first non-empty
               paragraph after H1
  - tags     : from frontmatter
  - meta     : dict of misc frontmatter (type, leader, patron, region, etc.)
  - html     : full body rendered to HTML (frontmatter stripped, wiki-links
               reduced to display text)

Usage:
  python3 tools/generate_factions.py [--vault PATH] [--out PATH]
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
try:
    import markdown as md
except ImportError:
    sys.exit("Requires markdown: pip3 install markdown")

DEFAULT_VAULT = Path(
    "/Users/Brad/Library/CloudStorage/OneDrive-WAVERLEYCHRISTIANCOLLEGE/"
    "D_D/Discovery D_D/Eldoria 2.0/Factions"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/factions.json")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
WIKI_LINK_PIPE_RE = re.compile(r"\[\[([^\]|]+)\|([^\]]+)\]\]")
WIKI_LINK_PLAIN_RE = re.compile(r"\[\[([^\]]+)\]\]")
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)

SKIP_FILES = {"_Factions Index.md", "Faction Relationship Map.md"}


def parse_frontmatter(text: str) -> tuple[dict, str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except Exception:
        fm = {}
    return fm, text[m.end():]


def strip_wiki_links(text: str) -> str:
    text = WIKI_LINK_PIPE_RE.sub(lambda m: m.group(2), text)
    text = WIKI_LINK_PLAIN_RE.sub(lambda m: m.group(1).split("/")[-1], text)
    return text


def extract_summary(body: str) -> str:
    """First blockquote after H1, else first non-empty paragraph after H1."""
    without_h1 = H1_RE.sub("", body, count=1)
    lines = without_h1.splitlines()
    # Blockquote pass
    quote: list[str] = []
    for line in lines:
        stripped = line.strip()
        if quote:
            if stripped.startswith(">"):
                quote.append(stripped.lstrip(">").strip())
            else:
                break
        elif stripped.startswith(">"):
            quote.append(stripped.lstrip(">").strip())
    if quote:
        summary = " ".join(q for q in quote if q).strip()
        if summary:
            return summary[:400]
    # Paragraph pass — first non-empty non-heading non-table line, up to 400 chars
    para: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if para:
                break
            continue
        if stripped.startswith("#") or stripped.startswith("|") or stripped.startswith("-"):
            if para:
                break
            continue
        para.append(stripped)
        if sum(len(p) for p in para) > 400:
            break
    return " ".join(para)[:400].strip()


def render_html(body: str) -> str:
    return md.markdown(
        body,
        extensions=["extra", "sane_lists", "tables", "smarty"],
        output_format="html5",
    )


def process_file(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    title = (fm.get("title") or "").strip()
    if not title:
        m = H1_RE.search(body)
        title = m.group(1).strip() if m else path.stem
    body_no_wiki = strip_wiki_links(body)
    summary = extract_summary(body_no_wiki)
    html = render_html(body_no_wiki.strip() + "\n")
    tags = fm.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    meta_keys = ("type", "leader", "patron", "region", "status", "connection",
                 "faction_type", "alignment", "role")
    meta = {k: fm.get(k) for k in meta_keys if fm.get(k)}
    return {
        "id": path.stem.lower().replace(" ", "-").replace("'", ""),
        "title": title,
        "sourceFile": path.name,
        "summary": summary,
        "tags": tags,
        "meta": meta,
        "html": html,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    if not args.vault.is_dir():
        print(f"! Vault folder not found: {args.vault}", file=sys.stderr)
        return 1

    entries: list[dict] = []
    for path in sorted(args.vault.iterdir()):
        if not path.is_file() or path.suffix.lower() != ".md":
            continue
        if path.name in SKIP_FILES:
            continue
        try:
            entry = process_file(path)
        except Exception as e:
            print(f"! Failed to process {path.name}: {e}", file=sys.stderr)
            continue
        if entry:
            entries.append(entry)

    entries.sort(key=lambda x: x["title"].lower())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  → {len(entries)} factions → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
