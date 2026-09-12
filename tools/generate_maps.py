#!/usr/bin/env python3
"""
Generate data/maps.json from the vault's Maps folder.

Each Maps/*.md file is one map entry. Frontmatter fields:
  title       — display title (falls back to filename)
  region      — grouping label (e.g. "Aelorian Territories")
  image       — optional image URL or repo-relative path (shown as thumbnail
                / opens full-screen when clicked)
  page        — optional link to a standalone HTML page (like
                ironhold_map.html); when present, clicking the map opens
                that page in a new tab
  tags        — list of tags
  order       — optional sort key (lower = earlier)
Body: markdown description that renders in the map card / modal.

Wiki-links [[X|Y]] and [[X]] are stripped to their display text.

Usage:
  python3 tools/generate_maps.py [--vault PATH] [--out PATH]
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
    "D_D/Discovery D_D/Eldoria 2.0/Maps"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/maps.json")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
WIKI_LINK_PIPE_RE = re.compile(r"\[\[([^\]|]+)\|([^\]]+)\]\]")
WIKI_LINK_PLAIN_RE = re.compile(r"\[\[([^\]]+)\]\]")
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)


def strip_wiki_links(text: str) -> str:
    text = WIKI_LINK_PIPE_RE.sub(lambda m: m.group(2), text)
    text = WIKI_LINK_PLAIN_RE.sub(lambda m: m.group(1).split("/")[-1], text)
    return text


def parse_frontmatter(text: str) -> tuple[dict, str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except Exception:
        fm = {}
    return fm, text[m.end():]


def extract_summary(body: str) -> str:
    without_h1 = H1_RE.sub("", body, count=1)
    para: list[str] = []
    for line in without_h1.splitlines():
        stripped = line.strip()
        if not stripped:
            if para:
                break
            continue
        if stripped.startswith(("#", "|", ">", "-", "*")):
            if para:
                break
            continue
        para.append(stripped)
        if sum(len(p) for p in para) > 320:
            break
    return " ".join(para)[:320].strip()


def process_file(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    title = (fm.get("title") or "").strip()
    if not title:
        m = H1_RE.search(body)
        title = m.group(1).strip() if m else path.stem
    body_clean = strip_wiki_links(body)
    summary = extract_summary(body_clean)
    html = md.markdown(
        body_clean.strip() + "\n",
        extensions=["extra", "sane_lists", "tables", "smarty"],
        output_format="html5",
    )
    tags = fm.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    return {
        "id": path.stem.lower().replace(" ", "-").replace("'", ""),
        "title": title,
        "sourceFile": path.name,
        "region": fm.get("region") or "",
        "image": fm.get("image") or "",
        "page": fm.get("page") or "",
        "tags": tags,
        "order": fm.get("order") if isinstance(fm.get("order"), (int, float)) else 100,
        "summary": summary,
        "html": html,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    if not args.vault.is_dir():
        print(f"! Maps folder not found: {args.vault} — writing empty catalog.")
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text("[]\n", encoding="utf-8")
        return 0

    entries: list[dict] = []
    for path in sorted(args.vault.iterdir()):
        if not path.is_file() or path.suffix.lower() != ".md":
            continue
        if path.name.startswith("_"):
            continue
        try:
            e = process_file(path)
        except Exception as ex:
            print(f"! Failed to process {path.name}: {ex}", file=sys.stderr)
            continue
        if e:
            entries.append(e)
    entries.sort(key=lambda x: (x.get("order", 100), x["title"].lower()))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  → {len(entries)} maps → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
