#!/usr/bin/env python3
"""
Firebase Rules diff — reports which top-level paths in the repo's
firebase-rules.json are missing from the deployed Firebase Realtime
Database (or would fail because rules aren't published).

Approach: we can't read deployed rules directly (Firebase doesn't expose
them via REST). Instead, we test WRITE against a probe path for each
top-level key. If the write succeeds with the response body containing
the value, the rule is published. If we get PERMISSION_DENIED, it's not.

Usage:
  python3 tools/check_firebase_rules.py

Requires: standard library only (urllib).
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

REPO_RULES = Path(__file__).resolve().parent.parent / "firebase-rules.json"
FIREBASE_URL = "https://wayward-company-default-rtdb.asia-southeast1.firebasedatabase.app"
PROBE_PATH = "_rules_diff_probe"  # ephemeral value we'll delete after


def top_paths(rules_json):
    """Return the top-level rule keys that have .write:true (i.e., we expect writes to succeed)."""
    tree = rules_json.get("rules", {})
    result = []
    for key, val in tree.items():
        if key.startswith("."):
            continue  # skip .read/.write at root
        if isinstance(val, dict):
            # Either the path itself has .write:true, or it's got a $var child with .write:true
            if val.get(".write") is True:
                result.append(key)
                continue
            for subkey, subval in val.items():
                if subkey.startswith("$") and isinstance(subval, dict) and subval.get(".write") is True:
                    result.append(key + "/some_key")
                    break
    return result


def try_write(path):
    """Attempt a PUT to Firebase at <FIREBASE_URL>/<path>/<probe>.json."""
    url = f"{FIREBASE_URL}/{path}/{PROBE_PATH}.json"
    body = json.dumps({"probe": True, "note": "rules_diff_probe"}).encode()
    req = urllib.request.Request(url, data=body, method="PUT",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            r.read()
        # Success — clean up the probe
        del_req = urllib.request.Request(url, method="DELETE")
        try:
            with urllib.request.urlopen(del_req, timeout=8) as _:
                pass
        except Exception:
            pass
        return True, "ok"
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode(errors="replace")
        except Exception:
            body = ""
        if e.code == 401 or "permission" in body.lower() or "denied" in body.lower():
            return False, "PERMISSION_DENIED"
        return False, f"HTTP {e.code}: {body[:60]}"
    except Exception as e:
        return False, str(e)


def main():
    if not REPO_RULES.exists():
        sys.exit(f"Missing: {REPO_RULES}")
    rules = json.loads(REPO_RULES.read_text())
    expected = top_paths(rules)
    if not expected:
        print("No writable top-level paths found in firebase-rules.json.")
        return

    print("=" * 60)
    print("Firebase rules diff — testing writes against deployed DB…")
    print(f"DB: {FIREBASE_URL}")
    print("=" * 60)

    missing = []
    for path in expected:
        ok, msg = try_write(path)
        marker = "✓" if ok else "✗"
        print(f"  {marker}  /{path:<40}  {msg}")
        if not ok:
            missing.append(path)

    print("=" * 60)
    if missing:
        print(f"⚠  {len(missing)} path(s) failed. Deployed rules are out of sync with repo.")
        print(f"   Republish rules from firebase-rules.json in the Firebase console:")
        print(f"   https://console.firebase.google.com/project/wayward-company/database/wayward-company-default-rtdb/rules")
        sys.exit(1)
    print(f"✓  All {len(expected)} paths accept writes. Deployed rules match repo.")


if __name__ == "__main__":
    main()
