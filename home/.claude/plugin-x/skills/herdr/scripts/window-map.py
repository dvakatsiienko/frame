# The window map: a shot of dima's herdr window with every part boxed, numbered and named, the legend under it.
# usage: uv run -q --with pillow python -I window-map.py <out.png> [shot.png]
# with no shot it takes a fresh one: the tray and the Files panel open for the shot and close after.
# the parts and their boxes live in window-map.json beside this file; a moved block means new boxes there.
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ORDER = ["ours", "zoo", "herdr"]


def herdr(*args):
    subprocess.run(["herdr-app", *args], check=True, capture_output=True)


def fresh_shot():
    path = Path(tempfile.mkdtemp()) / "shot.png"
    for block in ("tray", "panel"):
        herdr("do", "layout.toggle", json.dumps({"id": block}))
    try:
        subprocess.run(["sleep", "2"], check=True)
        herdr("shot", str(path))
    finally:
        for block in ("tray", "panel"):
            herdr("do", "layout.toggle", json.dumps({"id": block}))
    return path


def font(size):
    return ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", size)


def draw_map(spec, shot_path, out):
    shot = Image.open(shot_path).convert("RGB")
    width, height = shot.size
    scale = width / 1600
    colour = {k: tuple(v) for k, v in spec["kinds"].items()}
    draw = ImageDraw.Draw(shot, "RGBA")
    for part in spec["parts"]:
        c = colour[part["kind"]]
        for x0, y0, x1, y1 in part["boxes"]:
            box = [x0 * scale, y0 * scale, x1 * scale, y1 * scale]
            draw.rectangle(box, fill=c + (26,))
            draw.rectangle(box, outline=c + (255,), width=6)
            r = 34 if (y1 - y0) * scale > 90 else 26
            cx, cy = x0 * scale + r + 8, y0 * scale + r + 6
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (255,), outline=(255, 255, 255, 255), width=4)
            draw.text((cx, cy), str(part["n"]), font=font(40 if r > 30 else 32), fill="white", anchor="mm")

    rows = spec["parts"] + spec["notShown"]
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
    if len(sys.argv) < 2:
        sys.exit("usage: window-map.py <out.png> [shot.png]")
    spec = json.loads((HERE / "window-map.json").read_text())
    draw_map(spec, sys.argv[2] if len(sys.argv) > 2 else fresh_shot(), sys.argv[1])
