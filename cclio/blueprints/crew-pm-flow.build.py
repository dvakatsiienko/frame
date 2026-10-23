#!/usr/bin/env python3
"""Redraw the FigJam board «🛼 crew and pm, end to end» as draw.io mxGraph XML.

One command:  python3 -I drawio-build.py  (reads figjam-crew-pm.json beside it,
writes ~/frame/cclio/blueprints/crew-pm-flow.drawio).

Every cell keeps its Figma node id, so a diff of his edit names the same tile the export does.
"""

import html
import json
import os
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "figjam-crew-pm.json")
TARGET = os.path.expanduser("~/frame/cclio/blueprints/crew-pm-flow.drawio")

# tiles changed on the board since the export
TEXT_FIXES = {
    "6:470": "🦉 no review request\ndima is never added; the gate in pr-flow.md decides",
    "23:380": "🦉 cclio:shape-lane\ngrill the ticket; the exit lines seal after the spec (PM 4)",
}
# layout fixes, as (dx, dy): the pm title sat inside PM 0 Roadmap (PM 0 was added above PM 1 later),
# and the loose sketch above it left a 1700 px hole
MOVES = {
    "7:234": (0, -981), "7:235": (0, -981),
    "37:474": (0, 760), "37:480": (0, 760), "37:510": (0, 760),
}

FONT = "Helvetica Neue"
MAGNET = {"TOP": (0.5, 0), "BOTTOM": (0.5, 1), "LEFT": (0, 0.5), "RIGHT": (1, 0.5)}


def hex_of(paint_list, fallback="none"):
    for paint in paint_list or []:
        if paint.get("type", "SOLID") == "SOLID" and "color" in paint:
            c = paint["color"]
            return "#%02X%02X%02X" % tuple(round(c[k] * 255) for k in "rgb")
    return fallback


def darker(hex_colour, factor=0.9):
    rgb = [int(hex_colour[i : i + 2], 16) for i in (1, 3, 5)]
    return "#%02X%02X%02X" % tuple(round(v * factor) for v in rgb)


def style(**kv):
    return ";".join(f"{k}={v}" for k, v in kv.items()) + ";"


def tile_label(text, small):
    """First line bold title, the rest a detail line — the readable.md shape."""
    title, _, detail = text.partition("\n")
    size_title, size_detail = (16, 14) if small else (26, 20)
    out = f'<b style="font-size:{size_title}px">{html.escape(title)}</b>'
    if detail:
        detail_html = "<br>".join(html.escape(line) for line in detail.split("\n"))
        out += f'<br><span style="font-size:{size_detail}px">{detail_html}</span>'
    return out


def main():
    doc = json.load(open(SOURCE))
    page = doc["document"]["children"][0]

    mxfile = ET.Element("mxfile", host="drawio-build.py")
    diagram = ET.SubElement(mxfile, "diagram", id="crew-pm", name="🛼 crew and pm, end to end")
    model = ET.SubElement(
        diagram, "mxGraphModel", grid="0", page="0", math="0", shadow="0", background="#FFFFFF"
    )
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", id="0")
    ET.SubElement(root, "mxCell", id="1", parent="0")

    edges = []

    def add_vertex(node, parent_id, origin):
        box = node["absoluteBoundingBox"]
        dx, dy = MOVES.get(node["id"], (0, 0))
        x, y = box["x"] + dx, box["y"] + dy
        cell = ET.SubElement(root, "mxCell", id=node["id"], parent=parent_id, vertex="1")
        kind = node["type"]
        if kind == "SECTION":
            fill = hex_of(node.get("fills"), "#FFFFFF")
            cell.set("value", node["name"])
            cell.set(
                "style",
                style(
                    rounded=1, absoluteArcSize=1, arcSize=24, container=1, collapsible=0,
                    fillColor=fill, strokeColor=darker(fill, 0.86), strokeWidth=2, noLabel=1,
                ),
            )
        elif kind == "SHAPE_WITH_TEXT":
            text = TEXT_FIXES.get(node["id"], node.get("characters", ""))
            small = box["width"] < 300
            cell.set("value", tile_label(text, small) if text else "")
            shape = "rhombus" if node.get("shapeType") == "DIAMOND" else "rounded=1"
            arc = min(node.get("cornerRadius", 24), 40)
            cell.set(
                "style",
                shape + ";" + style(
                    whiteSpace="wrap", html=1, absoluteArcSize=1, arcSize=arc * 2,
                    fillColor=hex_of(node.get("fills")), strokeColor=hex_of(node.get("strokes")),
                    strokeWidth=3, fontFamily=FONT, fontColor="#1E1E1E",
                    spacingLeft=20, spacingRight=20, spacing=8,
                ),
            )
        elif kind == "TEXT":
            st = node["style"]
            cell.set("value", node["characters"])
            cell.set(
                "style",
                style(
                    strokeColor="none", fillColor="none", html=0, whiteSpace="nowrap", align="left", verticalAlign="top",
                    spacing=0, fontFamily=FONT, fontSize=int(st["fontSize"]),
                    fontStyle=1 if st.get("fontWeight", 400) >= 700 else 0,
                    fontColor=hex_of(node.get("fills"), "#1E1E1E"),
                ),
            )
        geo = ET.SubElement(
            cell, "mxGeometry",
            x=str(round(x - origin[0])), y=str(round(y - origin[1])),
            width=str(round(box["width"])), height=str(round(box["height"])),
        )
        geo.set("as", "geometry")
        return box

    def walk(node, parent_id, origin):
        kind = node["type"]
        if kind == "CONNECTOR":
            edges.append(node)
            return
        if kind not in ("SECTION", "SHAPE_WITH_TEXT", "TEXT"):
            return
        box = add_vertex(node, parent_id, origin)
        if kind == "SECTION":
            for child in node.get("children", []):
                walk(child, node["id"], (box["x"], box["y"]))

    # sections first so they sit behind loose tiles and text
    top = sorted(page["children"], key=lambda n: n["type"] != "SECTION")
    for node in top:
        walk(node, "1", (0, 0))

    for node in edges:
        start, end = node["connectorStart"], node["connectorEnd"]
        st = dict(
            html=1, endArrow="open", endSize=14, startArrow="none", rounded=0,
            strokeColor=hex_of(node.get("strokes"), "#757575"), strokeWidth=3,
            fontFamily=FONT, fontSize=22, fontStyle=1, fontColor="#1E1E1E", labelBackgroundColor="#FFFFFF",
        )
        if node.get("connectorLineType") == "ELBOWED":
            st["edgeStyle"] = "orthogonalEdgeStyle"
            for end_name, prefix in ((start, "exit"), (end, "entry")):
                if end_name.get("magnet") in MAGNET:
                    mx, my = MAGNET[end_name["magnet"]]
                    st[prefix + "X"], st[prefix + "Y"] = mx, my
                    st[prefix + "Dx"], st[prefix + "Dy"] = 0, 0
        else:
            st["edgeStyle"] = "none"
        cell = ET.SubElement(
            root, "mxCell", id=node["id"], value=node.get("characters", ""), style=style(**st),
            parent="1", edge="1", source=start["endpointNodeId"], target=end["endpointNodeId"],
        )
        geo = ET.SubElement(cell, "mxGeometry", relative="1")
        geo.set("as", "geometry")

    ET.indent(mxfile)
    ET.ElementTree(mxfile).write(TARGET, encoding="utf-8", xml_declaration=False)
    print(f"{TARGET}: {len(root) - 2} cells, {len(edges)} arrows")


if __name__ == "__main__":
    main()
