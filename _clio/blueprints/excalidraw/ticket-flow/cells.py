"""Prints the tickets-flow section of the draw.io builder as draw.io xml, for build.mjs.

python3 -I cells.py <path to ticket-flow.build.py>   (the notes tile's lines arrive as json on stdin)
Imports the builder as a module and runs its own build() and notes_tile(); no file is read or written but the builder.
"""

import importlib.util
import json
import sys
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location("ticket_flow_builder", sys.argv[1])
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

root = ET.Element("root")
ET.SubElement(root, "mxCell", id="0")
ET.SubElement(root, "mxCell", id="1", parent="0")
builder.NOTES.clear()
builder.build(root)
notes = [(n["cid"], n["title"], n["field"], n["note"]) for n in json.load(sys.stdin)]
builder.notes_tile(root, notes)
sys.stdout.write("<mxfile><diagram><mxGraphModel>" + ET.tostring(root, encoding="unicode") + "</mxGraphModel></diagram></mxfile>")
