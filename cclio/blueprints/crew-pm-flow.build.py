#!/usr/bin/env python3
"""Redraw the pm half of crew-pm-flow.drawio from crew-pm-flow.tiles.json (beside this file).
One command:  python3 -I crew-pm-flow.build.py  (PM_BOARD=<file> points it at a copy; the `tf-` cells stay as they are).
"""

import json
import os
import re
import sys
import xml.etree.ElementTree as ET

# -I keeps the script's own dir off sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import board_version  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(HERE, "crew-pm-flow.tiles.json")
TARGET = os.environ.get("PM_BOARD", os.path.join(HERE, "crew-pm-flow.drawio"))
# any cell as text, self-closing or with its geometry inside; the pm half is every one but `tf-`, 0 and 1
CELL = re.compile(r'\n\s*<mxCell\b([^>]*?)(?:/>|>.*?</mxCell>)', re.S)
KEEP = re.compile(r'\bid="(?:tf-[^"]*|0|1)"')
ROOT_CELL = '<mxCell id="1" parent="0" />'


def cell_xml(tile):
    attrs = tile["attrs"]
    cell = ET.Element("mxCell", {"id": attrs["id"], **{k: v for k, v in sorted(attrs.items()) if k != "id"}})
    geo = tile["geometry"]
    ET.SubElement(cell, "mxGeometry", {**{k: v for k, v in sorted(geo.items()) if k != "as"}, "as": geo["as"]})
    ET.indent(cell, space="  ", level=4)
    return "\n        " + ET.tostring(cell, encoding="unicode").rstrip()


def main():
    # a text splice, never a re-serialise: every `tf-` cell keeps its bytes
    text = open(TARGET, encoding="utf-8").read()
    text = CELL.sub(lambda m: m.group(0) if KEEP.search(m.group(1)) else "", text)
    tiles = json.load(open(TILES, encoding="utf-8"))
    at = text.index(ROOT_CELL) + len(ROOT_CELL)
    text = text[:at] + "".join(cell_xml(t) for t in tiles) + text[at:]
    open(TARGET, "w", encoding="utf-8").write(text)
    print(f"{TARGET}: {len(tiles)} pm cells written")
    board_version.bump("crew-pm-flow", TARGET)


if __name__ == "__main__":
    main()
