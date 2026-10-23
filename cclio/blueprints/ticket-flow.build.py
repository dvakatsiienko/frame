#!/usr/bin/env python3
"""Draw «🗺️ tickets flow — how a ticket lives today, across the pocket and linear» into crew-pm-flow.drawio.

One command:  python3 -I ticket-flow.build.py
It removes only the cells whose id starts with `tf-`, appends the section again, checks it by numbers
(every edge's ends exist, no tile overlaps another or a cell outside the section, every tile inside its
band, no text taller than its tile), and writes the file back. Every other cell stays as it was.
"""

import html
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crew-pm-flow.drawio")
PREFIX = "tf-"
# one of our cells as text, self-closing or with its geometry inside (draw.io writes id first)
OURS = re.compile(r'\n\s*<mxCell id="tf-[^"]*"(?:[^>]*/>|.*?</mxCell>)', re.S)

# the section starts at dima's «draw tickets flow somewhere here» tile (6859, -1584, 120 wide),
# just right of it, so the tile stays visible and the legend (x ≤ 6906) stays clear
ORIGIN_X, ORIGIN_Y = 7000, -1584
TILE_W, TILE_H = 520, 160
COL_STEP, ROW_STEP = 630, 370
PAD, ROW0 = 56, 200
COLS = 6
BAND_W = PAD * 2 + (COLS - 1) * COL_STEP + TILE_W
BAND_GAP = 160
FONT = "Helvetica Neue"

# the legend's colour families: (fill, stroke)
KIND = {
    "dima": ("#DCCCFF", "#874FFF"),
    "cclio": ("#C2E5FF", "#3DADFF"),
    "script": ("#CDF4D3", "#66D575"),
    "member": ("#FFE0C2", "#FF9E42"),
    "file": ("#FFECBD", "#FFC943"),
    "event": ("#D9D9D9", "#B3B3B3"),
    "weak": ("#FFDBDB", "#E54D4D"),
    "note": ("#F2F2F2", "#8C8C8C"),
}

# a tile: (id, col, row, kind, title, detail, file); a band: (id, header, sources, tiles, edges)
# an edge: (source, target, exit magnet, entry magnet, label); a weak-spot link: (weak tile, its tile)
BANDS = [
    (
        "b1", "🚪 1 — a drop is born: how does his want enter?",
        "habit-shared-files § the obsidian channel · cclio:boot step 3 · craft-pm § wishes · craft-fleet-flow stage 1",
        [
            ("drop", 0, 0, "event", "🔔 dima drops a want", "a line in the vault inbox from his phone, or a mid-session prompt", "_hq/inbox.md · boot step 3"),
            ("groom", 1, 0, "member", "🎼 composer grooms it", "inbox-prep at boot → inbox-composer.md; a prompt → a quiet prompt-groom chore", "boot step 3 · craft-pm § wishes"),
            ("parse", 2, 0, "cclio", "🦉 the parse", "EVERY item, the smallest aside too, gets a pocket item and its place in the order", "boot step 3 · fleet-flow stage 1"),
            ("wlines", 3, 0, "file", "📄 numbered W-lines", "his fold, one point per line W1…, ❓ marks his questions; the raw drop stays in the notes", "craft-pm § wishes"),
            ("keeper", 1, 1, "member", "🐬 wishkeeper checks meaning", "every ask of the raw inbox kept in meaning, not only present", "boot step 3 (step 8's brief)"),
            ("elsewhere", 2, 1, "event", "🔔 an ask born elsewhere", "a grill, a sweep plan, a log or test-drive line: born in the pocket too", "habit-shared-files § the birth gate"),
            ("cover", 3, 1, "script", "⚙️ wish-cover.ts", "every first use copies only the W-lines it settles; exits 0 before it ships", "craft-pm § wishes"),
        ],
        [
            ("drop", "groom", "R", "L", ""), ("groom", "parse", "R", "L", ""), ("parse", "wlines", "R", "L", ""),
            ("groom", "keeper", "B", "T", "checked"), ("elsewhere", "parse", "T", "B", ""),
            ("wlines", "cover", "B", "T", "at first use"),
        ],
        [],
    ),
    (
        "b2", "📋 2 — the pocket item: what holds it in shape?",
        "habit-shared-files § the pocket · script/pocket-add.ts · pocket-move.ts · pocket-check.ts · backlog.config.yml",
        [
            ("chore", 0, 0, "member", "🎼 a pocket-write chore", "a write with its fields known goes to composer; one that needs wording stays cclio's", "habit-shared-files § the pocket"),
            ("add", 1, 0, "script", "⚙️ pocket-add.ts", "born green: open, a priority band + ordinal, a type, one size; xs due +1 day, s +3", "script/pocket-add.ts"),
            ("item", 2, 0, "file", "📄 the item, pk-N", "a Backlog.md task: open · claimed · waiting · done; size xs · s · m", "pocket/tasks/ · backlog.config.yml"),
            ("move", 3, 0, "script", "⚙️ pocket-move.ts", "now · next · later: to the end of that band's order (ordinal 1000·10^band)", "script/pocket-move.ts"),
            ("shape", 4, 0, "script", "⚙️ pocket-check: the shape", "fields from the config, one size, ordinal in its band, a wish has W-lines, no note line lost", "script/pocket-check.ts"),
            ("clock", 4, 1, "script", "⚙️ pocket-check: the clock", "now ≤ 3 · open ≤ 5 · untouched > 1 day · due passed · waiting needs its line + a due", "runs at boot, after add and move, on each status move"),
            ("notes", 2, 1, "file", "📄 notes, appended only", "--append-notes, never --notes; his raw drop and quoted steers live here", "habit-shared-files § the pocket"),
            ("mirror", 1, 1, "script", "⚙️ the phone mirror", "pocket.md in the vault, read-only: a phone edit is lost, his asks go to the inbox", ".claude/hooks/pocket-mirror.sh"),
            ("w-size", 5, 0, "weak", "⚠️ a size the config lacks", "the contract lists xs · s · m · l; the config holds xs · s · m, so an l item reds", "my reading · habit-shared-files vs backlog.config.yml"),
        ],
        [
            ("chore", "add", "R", "L", ""), ("add", "item", "R", "L", ""), ("item", "move", "R", "L", ""),
            ("move", "shape", "R", "L", ""), ("shape", "clock", "B", "T", ""),
            ("item", "notes", "B6", "T6", ""), ("item", "mirror", "B2", "T", "mirrored"),
        ],
        [("w-size", "shape")],
    ),
    (
        "b3", "❓ 3 — the birth gate: where does an item go, the turn it is born?",
        "habit-shared-files § the birth gate · craft-pm § the freebie rule · pocket-check.ts · cclio:halt phase 4",
        [
            ("free", 0, 0, "cclio", "❓ the freebie test", "1–5 tool calls i can name, no word of his, no lane", "craft-pm § the freebie rule"),
            ("solved", 1, 0, "cclio", "✅ solved that turn", "by whoever holds it, the main lane or a side lane; still reported, every time", "craft-pm § the freebie rule"),
            ("when", 1, 1, "cclio", "❓ when can it be done?", "moving it to linear is never its solve, only a postponement", "habit-shared-files § the pocket"),
            ("w-fate", 2, 1, "weak", "⚠️ two fates for a non-freebie", "craft-pm: born parked; the pocket contract: stays, linear, waiting or parked", "my reading · craft-pm vs habit-shared-files"),
            ("stays", 0, 2, "cclio", "🏃 stays: today or tomorrow", "by-hand work, small things, plus at most one long main-lane ticket", "habit-shared-files § the pocket"),
            ("linear", 1, 2, "cclio", "🎫 → linear, in its milestone", "a week out, or waiting on a lane or a date; the pocket item dies", "habit-shared-files · craft-pm § milestones"),
            ("wait", 2, 2, "cclio", "🔔 waiting", "a «waiting for:» first line + a due date, when the wait ends today or tomorrow", "habit-shared-files · pocket-check.ts"),
            ("park", 3, 2, "cclio", "🛑 parked", "born with a «parked: <reason>» line; a «can't» names the probe it ran", "habit-shared-files · pocket-check.ts"),
            ("count", 4, 2, "script", "⚙️ born parked, solved today", "the halt counts parked items done that day: each one the gate should have solved", "cclio:halt phase 4 · craft-pm"),
            ("w-horizon", 2, 3, "weak", "⚠️ the horizon has no check", "45 of 65 items wait, 33 on a lane or a ticket; pocket-check wants a due, never how near", "my reading · pocket-check.ts, pocket/tasks/ on 10-23"),
        ],
        [
            ("free", "solved", "R", "L", "yes"), ("free", "when", "B", "L", "no"),
            ("when", "stays", "B", "T", ""), ("when", "linear", "B", "T", ""), ("when", "wait", "B", "T", ""),
            ("when", "park", "B", "T", ""), ("park", "count", "R", "L", ""),
        ],
        [("w-fate", "when"), ("w-horizon", "wait")],
    ),
    (
        "b4", "🎫 4 — the linear ticket: what does a ticket carry?",
        "cclio:pm SKILL.md + references/body.md · craft-pm § fold or drop, § milestones first · habit-shared-files § the pocket",
        [
            ("search", 0, 0, "cclio", "🦉 search before create", "the dupe, the right parent and relations; the run marker + the title stem", "craft-pm § fold or drop · body.md"),
            ("triage", 1, 0, "cclio", "🎫 born in Triage", "x as cclio -- linear issue create, never --state; a ticket must earn existence", "cclio:pm § the door · craft-pm"),
            ("mile", 2, 0, "cclio", "🎑 milestone first", "«which milestone?» on create, move, close; a guard refuses a bare create (FRM-417)", "craft-pm § milestones first"),
            ("fields", 3, 0, "file", "📄 every field", "role · kind · p3 · size XS·S·M like FRM-N · project · parent · milestone · delegate", "cclio:pm § the fields"),
            ("body", 4, 0, "file", "📄 the body, a spec seed", "lane · wish W-lines · dima notes · why · stories · proposed · decided · open · exit · out · refs", "pm references/body.md"),
            ("gate", 4, 1, "cclio", "❓ the assumption gate", "a fact dima never said → needs human + a ? line; to-spec only with open empty", "cclio:pm § the fields · body.md"),
            ("promote", 3, 1, "dima", "🙋‍♂️ out of Triage is his", "dima promotes it; a human ticket is his to start", "cclio:pm § the door"),
            ("pointer", 2, 1, "cclio", "🎫 back as a pointer item", "only when the main lane takes it for today or tomorrow: «ticket: FRM-N»", "habit-shared-files § the pocket"),
            ("w-pointer", 1, 1, "weak", "⚠️ a pointer, or dead?", "craft-pm: the item becomes a pointer the moment a ticket exists; the contract: it dies", "my reading · craft-pm § wishes vs habit-shared-files"),
            ("standing", 0, 1, "cclio", "🎫 a standing story", "an empty body, no comments; each round is a child ticket with the wish, pr and report", "pm references/body.md"),
        ],
        [
            ("search", "triage", "R", "L", ""), ("triage", "mile", "R", "L", ""), ("mile", "fields", "R", "L", ""),
            ("fields", "body", "R", "L", ""), ("body", "gate", "B", "T", ""), ("gate", "promote", "L", "R", ""),
            ("promote", "pointer", "L", "R", ""), ("triage", "standing", "B", "T", "or a story"),
        ],
        [("w-pointer", "pointer")],
    ),
    (
        "b5", "🍴 5 — shaping: what turns a ticket into a lane?",
        "cclio:shape-idea · cclio:shape-lane (+ exit-lines.md) · craft-fleet-flow stages 2–4 · pm references/body.md",
        [
            ("idea", 0, 0, "cclio", "🦉 shape-idea, optional", "an intricate wish: want + grill, prior art, sharpen, the cut, the done test", "cclio:shape-idea steps 1–6"),
            ("out", 1, 0, "file", "📄 its outputs", "PRODUCT.md, an FTR.md draft, GLOSSARY.md words, ADRs", "cclio:shape-idea step 7"),
            ("shaped", 2, 0, "dima", "🙋‍♂️ «shaped»", "only then design or code; a step is skipped only on his word", "shape-idea · fleet-flow stages 2–3"),
            ("prep", 0, 1, "dima", "🙋‍♂️ «prep», «grill FRM-N»", "or «next chunk»: a chunk is picked for a lane", "cclio:shape-lane"),
            ("read", 1, 1, "cclio", "🦉 read what is settled", "the wish block + decided, or the pocket notes before a ticket, never both", "shape-lane § 0 · wish-cover.ts"),
            ("card", 2, 1, "file", "📄 the chunk card", "an h2 + two lines: why we have it, what we want out of it", "shape-lane § 1"),
            ("grill", 3, 1, "dima", "🙋‍♂️ the grill", "matt's ❓ rounds, the frontier only; his orbit answers fold into decided", "shape-lane § 2"),
            ("spec", 4, 1, "file", "📄 the spec", "side lanes, coder jobs of 3+: .scratch/<feature>/spec.md, «wish: FRM-N»", "shape-lane § 2.5 · body.md (a quick lane skips it)"),
            ("w-park", 5, 1, "weak", "⚠️ a spec can sit for days", "nothing ages an undispatched spec; cli lane 1's has sat since 10-20", "my reading · shape-lane § 2.5"),
            ("exit", 4, 2, "cclio", "🦉 the exit lines", "3–6 given/when/then in the ticket's exit, sealed from the spec; the want line last", "shape-lane § 3 · exit-lines.md"),
            ("w-exit", 5, 2, "weak", "⚠️ exit lines in two homes", "the ticket's exit section and the spec, which the coder cuts into slice checklists", "my reading · shape-lane § 2.5, § 3"),
            ("critic", 3, 2, "member", "🐦‍⬛ the blind critic", "ccrow:plan-critique sees only the want + the lines; each finding folded", "shape-lane § 3"),
            ("seal", 2, 2, "script", "⚙️ the seal", "x brief preflight passes; the print collapses to «🔒 N exit lines, sealed»", "shape-lane § 4"),
            ("ask", 1, 2, "cclio", "🪐 the spawn ask", "its own orbit ask; the skill ends here, the spawn is x:crew-lead's", "shape-lane § 5"),
        ],
        [
            ("idea", "out", "R", "L", ""), ("out", "shaped", "R", "L", ""), ("shaped", "prep", "B", "T", "then a prep"),
            ("prep", "read", "R", "L", ""), ("read", "card", "R", "L", ""), ("card", "grill", "R", "L", ""),
            ("grill", "spec", "R", "L", ""), ("spec", "exit", "B", "T", ""), ("exit", "critic", "L", "R", ""),
            ("critic", "seal", "L", "R", ""), ("seal", "ask", "L", "R", ""),
        ],
        [("w-park", "spec"), ("w-exit", "exit")],
    ),
    (
        "b6", "🏃 6 — the lane: how does the ticket get built?",
        "x:crew-coder how-you-work.md · cclio:shape-lane § 2.5 · craft-fleet-flow stages 5–9, three kinds of work",
        [
            ("kinds", 0, 0, "file", "🛼 three kinds of work", "freebie: in place · quick: on main, no pr · side: worktree, pr, verifier", "craft-fleet-flow"),
            ("brief", 1, 0, "cclio", "📋 brief and spawn", "x brief check passes; a verifier by default, yes/no on a quick lane", "fleet-flow stage 5 · x:crew-lead"),
            ("cut", 2, 0, "member", "🔧 the coder cuts the spec", "matt's to-tickets after reading the code, so the slices follow real seams", "how-you-work.md · shape-lane § 2.5"),
            ("slices", 3, 0, "file", "📄 the slices", ".scratch/<feature>/issues/, never linear; each spec exit line in one checklist", "how-you-work.md · body.md"),
            ("plan", 4, 0, "file", "📄 the lane plan", "~/.local/state/x/lanes/<feature>/lane-plan.md, one line per ticket", "how-you-work.md § the lane plan"),
            ("w-pocket", 5, 0, "weak", "⚠️ a pocket item → a coder job", "no defined path: a lane's tickets never enter the pocket, nothing says how one leaves it", "my reading · habit-shared-files, shape-lane § 2.5"),
            ("sealorder", 4, 1, "cclio", "🦉 cclio seals the order", "at «[ask] lane-plan ready to seal»; re-sealed after a [progress] ping", "shape-lane § 2.5"),
            ("w-glide", 5, 1, "weak", "⚠️ the glide card copies it", "its ticket lines copied by hand at each seal and land, until FRM-410", "my reading · shape-lane § 2.5"),
            ("build", 3, 1, "member", "🔧 build, test-first", "tdd per ticket, [x] at its commit; his steers go under ## unsealed", "how-you-work.md"),
            ("verify", 2, 1, "member", "🔎 the pr and the verifier", "the verifier says clean, or its round-3 stop goes to cclio", "fleet-flow stages 6–7"),
            ("land", 1, 1, "cclio", "🔀 land", "cclio merges by the pr-flow gate; the spec dir moves to .scratch/_archive/", "fleet-flow stage 8"),
            ("look", 0, 1, "dima", "🙋‍♂️ the look card", "what, where, try, proven, not checked; a shot for anything rendered", "how-you-work.md · fleet-flow stage 9"),
        ],
        [
            ("kinds", "brief", "R", "L", ""), ("brief", "cut", "R", "L", ""), ("cut", "slices", "R", "L", ""),
            ("slices", "plan", "R", "L", ""), ("plan", "sealorder", "B", "T", ""), ("sealorder", "build", "L", "R", ""),
            ("build", "verify", "L", "R", ""), ("verify", "land", "L", "R", ""), ("land", "look", "L", "R", ""),
        ],
        [("w-pocket", "plan"), ("w-glide", "sealorder")],
    ),
    (
        "b7", "🏁 7 — the end: how does a ticket close and leave?",
        "pm references/closing.md · craft-pm § the ask-guard · cclio:halt phases 0, 1.5, 3.5, 4.5 · pocket-check.ts",
        [
            ("sweep", 0, 0, "script", "⚙️ the lingering sweep", "the halt lists In Progress + In Review; a merged pr with open asks → Todo", "cclio:halt phase 0"),
            ("list", 1, 0, "cclio", "🦉 «closable, because …»", "auto-close only stale, dupe, a freebie done in place; the rest wait for his word", "pm references/closing.md"),
            ("guard", 2, 0, "dima", "🙋‍♂️ the ask-guard", "each ask of his printed with its destination; no verdict, no close", "closing.md · craft-pm § the ask-guard"),
            ("closed", 3, 0, "cclio", "🎫 closed, a closing word", "in the body; the milestone's count read the same turn", "closing.md · craft-pm § milestones first"),
            ("pdone", 4, 0, "cclio", "✅ the pointer set done", "the same turn, with a «close:» line citing each W-line", "closing.md · pocket-check.ts"),
            ("net", 5, 0, "script", "⚙️ pocket-check's net", "an open item whose ticket linear closed reds: flip it to done", "pocket-check.ts · habit-shared-files"),
            ("archive", 4, 1, "script", "⚙️ the halt files it", "backlog task archive, every done item; one listed past its day reds", "cclio:halt phase 1.5 · pocket-check.ts"),
            ("w-order", 5, 1, "weak", "⚠️ filed before the gazette", "the contract files it after the gazette carries it; the halt archives at 1.5, posts at 4.5", "my reading · habit-shared-files vs cclio:halt"),
            ("inbox", 3, 1, "script", "⚙️ the inbox reset", "halt-sweep.ts copies his template over; it refuses a line without ✅", "cclio:halt phase 1.5"),
            ("linarch", 2, 1, "script", "⚙️ x linear archive", "closed tickets untouched for 14 days; the free plan caps at 250", "cclio:halt phase 3.5 · cclio:pm"),
            ("gazette", 1, 1, "cclio", "📝 the gazette carries it", "the day's done items and the fleet ops numbers, posted at the halt", "cclio:halt phase 4.5"),
        ],
        [
            ("sweep", "list", "R", "L", ""), ("list", "guard", "R", "L", ""), ("guard", "closed", "R", "L", ""),
            ("closed", "pdone", "R", "L", ""), ("net", "pdone", "L", "R", ""), ("pdone", "archive", "B", "T", ""),
            ("archive", "inbox", "L", "R", ""), ("inbox", "linarch", "L", "R", ""), ("linarch", "gazette", "L", "R", ""),
        ],
        [("w-order", "archive")],
    ),
]

NOTE = (
    "note", 4, 0, 2,
    "📄 proposed redesign (PK-263)",
    "shape-lane splits into a prep with dima that signs a chunk, and a machine dispatch that writes the spec and exit lines — drawn after the grill",
    "not today's flow",
)
NOTE_BAND = "b5"

MAGNET = {"R": (1, 0.5), "L": (0, 0.5), "T": (0.5, 0), "B": (0.5, 1),
          "B2": (0.2, 1), "B6": (0.6, 1), "T6": (0.6, 0)}


def style(**kv):
    return ";".join(f"{k}={v}" for k, v in kv.items()) + ";"


def label(title, detail, source):
    return (
        f'<b style="font-size:26px">{html.escape(title)}</b>'
        f'<br><span style="font-size:20px">{html.escape(detail)}</span>'
        f'<br><i style="font-size:16px;color:#5C5C5C">{html.escape(source)}</i>'
    )


def text_height(title, detail, source, width):
    """A rough height of the label: chars per line by font size, 1.2 line height."""
    usable = width - 56
    def lines(text, char_w):
        wide = sum(2 if ord(c) > 0x2000 else 1 for c in text)
        return math.ceil(wide * char_w / usable)
    return 1.2 * (26 * lines(title, 15) + 20 * lines(detail, 10) + 16 * lines(source, 8.2)) + 16


def tile_style(kind, dashed=False):
    fill, stroke = KIND[kind]
    return "rounded=1;" + style(
        whiteSpace="wrap", html=1, absoluteArcSize=1, arcSize=80, fillColor=fill, strokeColor=stroke,
        strokeWidth=3, fontFamily=FONT, fontColor="#1E1E1E", spacingLeft=20, spacingRight=20, spacing=8,
        dashed=1 if dashed else 0,
    )


def text_style(size, bold):
    return style(
        strokeColor="none", fillColor="none", html=0, whiteSpace="nowrap", align="left", verticalAlign="top",
        spacing=0, fontFamily=FONT, fontSize=size, fontStyle=1 if bold else 0, fontColor="#1E1E1E",
    )


def add(root, cid, parent, value, st, x, y, w, h, **extra):
    cell = ET.SubElement(root, "mxCell", id=cid, value=value, style=st, parent=parent, **extra)
    geo = ET.SubElement(cell, "mxGeometry", x=str(x), y=str(y), width=str(w), height=str(h))
    geo.set("as", "geometry")
    return cell


def edge(root, cid, src, dst, value, st):
    cell = ET.SubElement(root, "mxCell", id=cid, value=value, style=st, parent="1", edge="1", source=src, target=dst)
    geo = ET.SubElement(cell, "mxGeometry", relative="1")
    geo.set("as", "geometry")


def arrow_style(exit_m, entry_m):
    ex, ey = MAGNET[exit_m]
    nx, ny = MAGNET[entry_m]
    return style(
        html=1, endArrow="open", endSize=14, startArrow="none", rounded=0, strokeColor="#757575", strokeWidth=3,
        fontFamily=FONT, fontSize=20, fontStyle=1, fontColor="#1E1E1E", labelBackgroundColor="#FFFFFF",
        edgeStyle="orthogonalEdgeStyle", exitX=ex, exitY=ey, exitDx=0, exitDy=0, entryX=nx, entryY=ny, entryDx=0, entryDy=0,
    )


WEAK_LINK = style(html=1, endArrow="none", startArrow="none", dashed=1, strokeColor="#E54D4D", strokeWidth=3, edgeStyle="none")


def build(root):
    """Appends the section; returns {tile id: (band id, x, y, w, h, text height)} in absolute coordinates."""
    tiles = {}
    add(root, "tf-title", "1", "🗺️ tickets flow — how a ticket lives today, across the pocket and linear",
        text_style(48, True), ORIGIN_X + PAD, ORIGIN_Y, 1900, 58, vertex="1")
    add(root, "tf-subtitle", "1",
        "the files as they read on 2026-10-23, not a redesign · ⚠️ red tiles are my reading, every other tile names its file",
        text_style(24, False), ORIGIN_X + PAD, ORIGIN_Y + 74, 1500, 30, vertex="1")
    y = ORIGIN_Y + 160
    previous = None
    for band_id, header, sources, band_tiles, edges, weak_links in BANDS:
        rows = max(row for _, _, row, *_ in band_tiles) + 1
        height = ROW0 + (rows - 1) * ROW_STEP + TILE_H + PAD
        bid = f"{PREFIX}{band_id}"
        add(root, bid, "1", "", style(rounded=1, absoluteArcSize=1, arcSize=24, container=1, collapsible=0,
            fillColor="#EFF4FF", strokeColor="#CED2DB", strokeWidth=2, noLabel=1), ORIGIN_X, y, BAND_W, height, vertex="1")
        add(root, f"{bid}-head", bid, header, text_style(40, True), PAD, 40, 2400, 48, vertex="1")
        add(root, f"{bid}-src", bid, sources, text_style(22, False), PAD, 100, 2400, 27, vertex="1")
        placed = [(*t, 1) for t in band_tiles]
        if band_id == NOTE_BAND:
            nid, col, row, span, title, detail, source = NOTE
            placed.append((nid, col, row, "note", title, detail, source, span))
        for tid, col, row, kind, title, detail, source, span in placed:
            x, ty = PAD + col * COL_STEP, ROW0 + row * ROW_STEP
            w = TILE_W + (span - 1) * COL_STEP
            add(root, f"{bid}-{tid}", bid, label(title, detail, source), tile_style(kind, dashed=kind == "note"),
                x, ty, w, TILE_H, vertex="1")
            tiles[f"{bid}-{tid}"] = (bid, ORIGIN_X + x, y + ty, w, TILE_H, text_height(title, detail, source, w))
        for src, dst, exit_m, entry_m, value in edges:
            edge(root, f"{bid}-e-{src}-{dst}", f"{bid}-{src}", f"{bid}-{dst}", value, arrow_style(exit_m, entry_m))
        for weak, target in weak_links:
            edge(root, f"{bid}-w-{weak}-{target}", f"{bid}-{weak}", f"{bid}-{target}", "", WEAK_LINK)
        if previous:
            st = arrow_style("B", "T").replace("exitX=0.5", "exitX=0.03").replace("entryX=0.5", "entryX=0.03")
            edge(root, f"{PREFIX}join-{previous}-{band_id}", f"{PREFIX}{previous}", bid, "", st)
        previous = band_id
        tiles[bid] = (None, ORIGIN_X, y, BAND_W, height, 0)
        y += height + BAND_GAP
    return tiles


def absolute_boxes(root):
    cells = {c.get("id"): c for c in root.iter("mxCell")}
    def position(cell):
        geo = cell.find("mxGeometry")
        x, y = float(geo.get("x", 0)), float(geo.get("y", 0))
        parent = cells.get(cell.get("parent"))
        if parent is not None and parent.get("vertex") == "1":
            px, py = position(parent)
            x, y = x + px, y + py
        return x, y
    boxes = {}
    for cid, cell in cells.items():
        geo = cell.find("mxGeometry")
        if cell.get("vertex") == "1" and geo is not None:
            x, y = position(cell)
            boxes[cid] = (x, y, float(geo.get("width", 0)), float(geo.get("height", 0)), cell.get("parent"))
    return cells, boxes


def overlaps(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


def check(root, tiles):
    cells, boxes = absolute_boxes(root)
    problems = []
    edges = [c for c in cells.values() if c.get("edge") == "1"]
    for e in edges:
        for end in ("source", "target"):
            if e.get(end) and e.get(end) not in cells:
                problems.append(f"edge {e.get('id')}: {end} {e.get(end)} is missing")
    ours = {cid: b for cid, b in boxes.items() if cid.startswith(PREFIX)}
    tops = {cid: b for cid, b in ours.items() if b[4] == "1"}  # bands and the title lines
    leaves = {cid: b for cid, b in ours.items() if b[4] != "1"}
    others = {cid: b for cid, b in boxes.items() if not cid.startswith(PREFIX)}
    for group in (tops, leaves):
        ids = sorted(group)
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                if group[a][4] == group[b][4] and overlaps(group[a], group[b]):
                    problems.append(f"overlap: {a} × {b}")
    for cid, box in tops.items():
        for oid, other in others.items():
            if overlaps(box, other):
                problems.append(f"overlap with a cell outside the section: {cid} × {oid}")
    for cid, box in leaves.items():
        band = boxes[box[4]]
        if not (box[0] >= band[0] and box[1] >= band[1] and box[0] + box[2] <= band[0] + band[2]
                and box[1] + box[3] <= band[1] + band[3]):
            problems.append(f"{cid} sits outside its band {box[4]}")
    for tid, (_, _, _, w, h, need) in tiles.items():
        if need > h:
            problems.append(f"{tid}: text ~{need:.0f} px in a {h} px tile")
    tile_count = sum(1 for t in tiles.values() if t[0])
    weak = sum(1 for cid in tiles if "-w-" in cid)
    ours_edges = [e for e in edges if e.get("id", "").startswith(PREFIX)]
    return problems, tile_count, weak, len(ours_edges)


def main():
    # a text splice, never a re-serialise: every other cell keeps its bytes (ET would re-escape &#39;)
    text = open(TARGET, encoding="utf-8").read()
    text = OURS.sub("", text)
    root = ET.fromstring(text).find("diagram/mxGraphModel/root")
    before = len(root)
    tiles = build(root)
    problems, tile_count, weak, edge_count = check(root, tiles)
    for problem in problems:
        print(f"🔴 {problem}")
    if problems:
        sys.exit(1)
    section = list(root)[before:]
    for cell in section:
        ET.indent(cell, space="  ", level=4)
    block = "".join("\n        " + ET.tostring(cell, encoding="unicode").rstrip() for cell in section)
    head, close, tail = text.rpartition("\n      </root>")
    open(TARGET, "w", encoding="utf-8").write(head + block + close + tail)
    print(f"{TARGET}: {tile_count} tiles ({weak} weak spots), {edge_count} arrows, {len(BANDS)} bands, all checks green")


if __name__ == "__main__":
    main()
