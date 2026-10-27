"""A board's version: a counter in versions.json beside it, bumped when a build changes the board's bytes.
The version is also stamped into the board as a «v<N> · <date>» label beside its title; the hash skips the label."""

import hashlib
import json
import os
import re
from datetime import date

VERSIONS = os.environ.get("BOARD_VERSIONS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "versions.json"))
# the cell that holds each board's title; the label goes to its right
TITLES = {"crew-pm-flow": "7:232"}
LABEL_STYLE = "strokeColor=none;fillColor=none;html=0;whiteSpace=nowrap;align=left;verticalAlign=top;spacing=0;fontFamily=Helvetica Neue;fontSize=40;fontStyle=0;fontColor=#444444;"
LABEL = re.compile(r'\n\s*<mxCell id="bv-label".*?</mxCell>', re.S)


def stamp(text: str, board: str, entry: dict) -> str:
    height, width, x, y = re.search(
        rf'<mxCell id="{re.escape(TITLES[board])}".*?<mxGeometry height="(\d+)" width="(\d+)" x="(-?\d+)" y="(-?\d+)"', text, re.S
    ).groups()
    cell = (
        f'\n        <mxCell id="bv-label" parent="1" style="{LABEL_STYLE}" value="v{entry["version"]} · {entry["at"]}" vertex="1">'
        f'\n          <mxGeometry height="48" width="420" x="{int(x) + int(width) + 40}" y="{int(y) + int(height) - 48}" as="geometry" />'
        "\n        </mxCell>"
    )
    head, close, tail = text.rpartition("\n      </root>")
    return head + cell + close + tail


def bump(board: str, path: str) -> str:
    text = LABEL.sub("", open(path, encoding="utf-8").read())
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]
    versions = json.load(open(VERSIONS, encoding="utf-8")) if os.path.exists(VERSIONS) else {}
    entry = versions.get(board, {"version": 0, "hash": "", "at": ""})
    if entry["hash"] != digest:
        entry = {"version": entry["version"] + 1, "hash": digest, "at": date.today().isoformat()}
        versions[board] = entry
        with open(VERSIONS, "w", encoding="utf-8") as out:
            json.dump(versions, out, indent=2, sort_keys=True, ensure_ascii=False)
            out.write("\n")
    if board in TITLES:
        with open(path, "w", encoding="utf-8") as out:
            out.write(stamp(text, board, entry))
    line = f"🗺️ {board} v{entry['version']} ({entry['at']})"
    print(line)
    return line
