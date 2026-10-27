"""A board's version: a counter in versions.json beside it, bumped when a build changes the board's bytes."""

import hashlib
import json
import os
from datetime import date

VERSIONS = os.environ.get("BOARD_VERSIONS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "versions.json"))


def bump(board: str, path: str) -> str:
    digest = hashlib.sha256(open(path, "rb").read()).hexdigest()[:12]
    versions = json.load(open(VERSIONS, encoding="utf-8")) if os.path.exists(VERSIONS) else {}
    entry = versions.get(board, {"version": 0, "hash": "", "at": ""})
    if entry["hash"] != digest:
        entry = {"version": entry["version"] + 1, "hash": digest, "at": date.today().isoformat()}
        versions[board] = entry
        with open(VERSIONS, "w", encoding="utf-8") as out:
            json.dump(versions, out, indent=2, sort_keys=True, ensure_ascii=False)
            out.write("\n")
    line = f"🗺️ {board} v{entry['version']} ({entry['at']})"
    print(line)
    return line
