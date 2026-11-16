# The window map: a shot of dima's herdr window with every part boxed, numbered and named, the legend under it.
# usage: uv run -q --with pillow python -I window-map.py <out.png> [shot.png]
#        python -I window-map.py --boxes <layout.json> <width>x<height>   (the visible parts' boxes as json, no picture)
# with no shot it shoots the window as it is, touching no layout. each part names a node of the layout the window shows
# (`herdr-app status` names it, ~/.config/herdr-app/layouts/<name>.json holds it): its box is solved from that tree at the
# window's size, a node the file reads hidden is listed under the shot and never drawn.
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ORDER = ["ours", "herdr"]


def fresh_shot():
    path = Path(tempfile.mkdtemp()) / "shot.png"
    subprocess.run(["herdr-app", "shot", str(path)], check=True, capture_output=True)
    return path


def app_home():
    return Path(os.environ.get("HERDR_APP_HOME") or Path.home() / ".config/herdr-app")


def shown_layout():
    status = json.loads(subprocess.run(["herdr-app", "status"], check=True, capture_output=True, text=True).stdout)
    return app_home() / "layouts" / f"{status['layout']}.json"


def window_size():
    bounds = json.loads((app_home() / "window.json").read_text())["bounds"]
    return bounds[2], bounds[3]


def pair(value):
    return (value, value) if isinstance(value, (int, float)) else tuple(value or (0, 0))


def solve(node, rect, boxes):
    """Lay a layout node out in rect (x0, y0, x1, y1), points; boxes gets every node a hidden one does not cut off, by id."""
    boxes[node["id"]] = rect
    kids = [k for k in node.get("children", []) if not k.get("hidden")]
    kind = node.get("type")
    if kind == "stack":
        # a stack's children share its whole rect
        for kid in kids:
            solve(kid, rect, boxes)
        return
    if not kids:
        return
    px, py = pair(node.get("padding"))
    x0, y0, x1, y1 = rect[0] + px, rect[1] + py, rect[2] - px, rect[3] - py
    gap = node.get("gap", 0)
    along = (x1 - x0) if kind == "row" else (y1 - y0)
    sizes = [k.get("size") or {"weight": 1} for k in kids]
    fixed = sum(s.get("px", 0) for s in sizes) + gap * (len(kids) - 1)
    weights = sum(s.get("weight", 0) for s in sizes)
    spare = max(along - fixed, 0)
    at = x0 if kind == "row" else y0
    for kid, size in zip(kids, sizes):
        length = size["px"] if "px" in size else spare * size["weight"] / weights
        child = (at, y0, at + length, y1) if kind == "row" else (x0, at, x1, at + length)
        solve(kid, child, boxes)
        at += length + gap


def part_boxes(spec, layout, width, height):
    """(visible, hidden): the parts drawn with their boxes in points, and the parts whose node the layout hides."""
    boxes = {}
    solve(layout, (0, 0, width, height), boxes)
    visible, hidden = [], []
    for part in spec["parts"]:
        rect = boxes.get(part["node"])
        if not rect:
            hidden.append(part)
            continue
        x0, y0, x1, y1 = rect
        top = part.get("top")
        if top is not None:
            y0, y1 = y0 + top, (y0 + top + part["height"]) if part.get("height") else y1
        visible.append((part, [x0, y0, x1, y1]))
    return visible, hidden


def font(size):
    from PIL import ImageFont

    return ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", size)


def draw_map(spec, layout, size, shot_path, out):
    from PIL import Image, ImageDraw

    shot = Image.open(shot_path).convert("RGB")
    width, height = shot.size
    scale = width / size[0]
    visible, hidden = part_boxes(spec, layout, *size)
    colour = {k: tuple(v) for k, v in spec["kinds"].items()}
    draw = ImageDraw.Draw(shot, "RGBA")
    for part, (x0, y0, x1, y1) in visible:
        c = colour[part["kind"]]
        box = [x0 * scale, y0 * scale, x1 * scale, y1 * scale]
        draw.rectangle(box, fill=c + (26,))
        draw.rectangle(box, outline=c + (255,), width=6)
        r = 34 if (y1 - y0) * scale > 90 else 26
        cx, cy = x0 * scale + r + 8, y0 * scale + r + 6
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (255,), outline=(255, 255, 255, 255), width=4)
        draw.text((cx, cy), str(part["n"]), font=font(40 if r > 30 else 32), fill="white", anchor="mm")

    shown = [part for part, _ in visible] + [{**part, "what": part["what"] + " (hidden now)"} for part in hidden]
    rows = sorted(shown, key=lambda part: part["n"]) + spec["notShown"]
    row_h, pad = 66, 56
    canvas = Image.new("RGB", (width, height + pad * 2 + 100 + (len(rows) + 1) * row_h), (250, 250, 248))
    canvas.paste(shot, (0, 0))
    d = ImageDraw.Draw(canvas)
    text = font(40)
    y = height + pad
    d.text((pad, y), spec["title"], font=font(48), fill=(20, 20, 20))
    x = width - pad - 1500
    for kind in ORDER:
        d.rounded_rectangle([x, y + 6, x + 44, y + 50], 8, fill=colour[kind])
        d.text((x + 60, y + 4), spec["kindLabels"][kind], font=text, fill=(40, 40, 40))
        x += 60 + d.textlength(spec["kindLabels"][kind], font=text) + 60
    y += 100
    cols = [pad, pad + 110, pad + 1100, pad + 1980, pad + 2950]
    for head, cx in zip(["#", "what it is", "today", "→ name", "who made it"], cols):
        d.text((cx, y), head, font=text, fill=(120, 120, 120))
    y += row_h
    for row in rows:
        c = colour[row["kind"]]
        if "n" in row:
            r = 26
            d.ellipse([cols[0], y + 2, cols[0] + 2 * r, y + 2 + 2 * r], fill=c)
            d.text((cols[0] + r, y + 2 + r), str(row["n"]), font=font(30), fill="white", anchor="mm")
        else:
            d.text((cols[0] + 10, y), "—", font=text, fill=c)
        d.text((cols[1], y), row["what"], font=text, fill=(20, 20, 20))
        d.text((cols[2], y), row["today"], font=text, fill=(80, 80, 80))
        d.text((cols[3], y), row["name"], font=text, fill=(20, 20, 20))
        d.text((cols[4], y), spec["kindLabels"][row["kind"]], font=text, fill=c)
        y += row_h
    canvas.save(out)
    print(out, canvas.size)


if __name__ == "__main__":
    spec = json.loads((HERE / "window-map.json").read_text())
    if len(sys.argv) == 4 and sys.argv[1] == "--boxes":
        width, height = (float(n) for n in sys.argv[3].split("x"))
        visible, _ = part_boxes(spec, json.loads(Path(sys.argv[2]).read_text()), width, height)
        print(json.dumps({part["node"] + (f"+{part['top']}" if "top" in part else ""): box for part, box in visible}))
        sys.exit(0)
    if len(sys.argv) < 2:
        sys.exit("usage: window-map.py <out.png> [shot.png] | --boxes <layout.json> <width>x<height>")
    draw_map(
        spec,
        json.loads(shown_layout().read_text()),
        window_size(),
        sys.argv[2] if len(sys.argv) > 2 else fresh_shot(),
        sys.argv[1],
    )
