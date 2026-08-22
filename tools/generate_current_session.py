#!/usr/bin/env python3
"""
Generate data/current-session.json from the vault's Session Planning folder.

Rule: "current session" is the LOWEST-numbered file in Session Planning/
(excluding Session Planning/Archive/). Once a session is played, move its
file into Archive/ and the next-lowest becomes current automatically.

Output includes the session title, session number, and the full body rendered
to HTML — EXCEPT the "## DM checklist" section, which is a prep tool and not
useful during play. Frontmatter is stripped. Wiki-links [[X|Y]] and [[X]]
render as their display text (no linking, since site has no vault pages).

Usage:
  python3 tools/generate_current_session.py [--vault PATH] [--out PATH]
"""
import argparse
import json
import re
import sys
from pathlib import Path

try:
    import markdown as md
except ImportError:
    sys.exit("Requires markdown: pip3 install markdown")

DEFAULT_VAULT = Path(
    "/Users/Brad/Library/CloudStorage/OneDrive-WAVERLEYCHRISTIANCOLLEGE/"
    "D_D/Discovery D_D/Eldoria 2.0/Session Planning"
)
DEFAULT_OUT = Path("/Users/Brad/Documents/GitHub/eldoria/data/current-session.json")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
SESSION_NUM_RE = re.compile(r"Session\s*0*(\d+)", re.IGNORECASE)
WIKI_LINK_PIPE_RE = re.compile(r"\[\[([^\]|]+)\|([^\]]+)\]\]")
WIKI_LINK_PLAIN_RE = re.compile(r"\[\[([^\]]+)\]\]")
DM_CHECKLIST_RE = re.compile(
    r"^##\s+DM checklist.*?(?=^##\s|\Z)", re.DOTALL | re.MULTILINE | re.IGNORECASE
)


def extract_session_number(path: Path, body: str) -> int | None:
    """Prefer frontmatter `session:` field; fall back to filename."""
    fm_match = FRONTMATTER_RE.match(body)
    if fm_match:
        fm_text = fm_match.group(1)
        for line in fm_text.splitlines():
            m = re.match(r"^\s*session:\s*(\d+)", line, re.IGNORECASE)
            if m:
                return int(m.group(1))
    m = SESSION_NUM_RE.search(path.stem)
    return int(m.group(1)) if m else None


def extract_title(body: str, fallback: str) -> str:
    fm_match = FRONTMATTER_RE.match(body)
    if fm_match:
        for line in fm_match.group(1).splitlines():
            m = re.match(r"^\s*title:\s*(.+?)\s*$", line, re.IGNORECASE)
            if m:
                return m.group(1).strip('"').strip("'")
    # First H1 in body?
    stripped = FRONTMATTER_RE.sub("", body, count=1).strip()
    for line in stripped.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def strip_wiki_links(text: str) -> str:
    text = WIKI_LINK_PIPE_RE.sub(lambda m: m.group(2), text)
    text = WIKI_LINK_PLAIN_RE.sub(lambda m: m.group(1).split("/")[-1], text)
    return text


def clean_body(body: str) -> str:
    body = FRONTMATTER_RE.sub("", body, count=1)
    body = DM_CHECKLIST_RE.sub("", body)
    body = strip_wiki_links(body)
    return body.strip() + "\n"


def render_html(body: str) -> str:
    return md.markdown(
        body,
        extensions=["extra", "sane_lists", "tables", "smarty"],
        output_format="html5",
    )


def find_current_session(vault: Path) -> Path | None:
    if not vault.is_dir():
        print(f"! Vault path not found: {vault}", file=sys.stderr)
        return None
    candidates: list[tuple[int, Path]] = []
    for path in vault.iterdir():
        if not path.is_file() or path.suffix.lower() != ".md":
            continue
        # Ignore anything in Archive/ (handled by iterdir at this level anyway;
        # Archive is a sibling directory, not a file).
        try:
            body = path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"! Could not read {path.name}: {e}", file=sys.stderr)
            continue
        n = extract_session_number(path, body)
        if n is None:
            continue
        candidates.append((n, path))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", type=Path, default=DEFAULT_VAULT)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    path = find_current_session(args.vault)
    if path is None:
        print("! No candidate session file found; writing empty payload.")
        payload = {
            "sessionNumber": None,
            "title": "No current session file",
            "sourceFile": None,
            "html": "<p><em>No session file found in Session Planning/.</em></p>",
        }
    else:
        body = path.read_text(encoding="utf-8")
        number = extract_session_number(path, body)
        title = extract_title(body, path.stem)
        cleaned = clean_body(body)
        html = render_html(cleaned)
        payload = {
            "sessionNumber": number,
            "title": title,
            "sourceFile": path.name,
            "html": html,
        }
        print(f"  → Current session: #{number} — {title} ({path.name})")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  → Wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
