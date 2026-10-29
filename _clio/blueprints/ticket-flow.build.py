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

# -I keeps the script's own dir off sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import board_version  # noqa: E402

TARGET = os.environ.get("PM_BOARD", os.path.join(os.path.dirname(os.path.abspath(__file__)), "crew-pm-flow.drawio"))
PREFIX = "tf-"
# one of our cells as text, self-closing or with its geometry inside (draw.io writes id first)
OURS = re.compile(r'\n\s*<mxCell id="tf-[^"]*"(?:[^>]*/>|.*?</mxCell>)', re.S)

# the section starts at dima's «draw tickets flow somewhere here» tile (6859, -1584, 120 wide),
# just right of it, so the tile stays visible and the legend (x ≤ 6906) stays clear
ORIGIN_X, ORIGIN_Y = 0, -1584
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
    "clio": ("#C2E5FF", "#3DADFF"),
    "script": ("#CDF4D3", "#66D575"),
    "member": ("#FFE0C2", "#FF9E42"),
    "file": ("#FFECBD", "#FFC943"),
    "event": ("#D9D9D9", "#B3B3B3"),
    "weak": ("#FFDBDB", "#E54D4D"),
}

# a tile: (id, col, row, kind, title, detail, file); a band: (id, header, sources, tiles, edges)
# an edge: (source, target, exit magnet, entry magnet, label); a weak-spot link: (weak tile, its tile)
BANDS = [
    (
        "b1", "🚪 1 — a drop is born: how does his want enter?",
        "habit-shared-files § the obsidian channel · clio:boot step 3 · craft-pm § wishes · craft-fleet-flow stage 1",
        [
            ("drop", 0, 0, "event", "🔔 dima drops a want", "a line in the vault inbox from his phone, or a mid-session prompt", "_hq/inbox.md · boot step 3"),
            ("groom", 1, 0, "member", "🎀 helga grooms it", "inbox-prep at boot; a wish-bearing prompt → prompt-groom.ts before its fold, a miss reds in pocket-check", "boot step 3 · craft-pm § wishes · FRM-418"),
            ("parse", 2, 0, "clio", "🦉 the parse", "EVERY item, the smallest aside too, gets a pocket item and its place in the order", "boot step 3 · fleet-flow stage 1"),
            ("wlines", 3, 0, "file", "📄 numbered W-lines", "his fold, one point per line W1…, ❓ marks his questions; the raw drop stays in the notes", "craft-pm § wishes"),
            ("keeper", 1, 1, "member", "🐬 wishkeeper checks meaning", "every ask of the raw inbox kept in meaning, not only present", "boot step 3 (step 8's brief)"),
            ("elsewhere", 2, 1, "event", "🔔 an ask born elsewhere", "a grill, a sweep plan, a log or test-drive line: it gets a home too, never that line alone", "habit-shared-files § the pocket"),
            ("cover", 3, 1, "script", "⚙️ wish-cover.ts", "a first use copies only the W-lines it settles, read from the ticket's wish block first, else its pocket item; its hook blocks a red", "craft-pm § wishes"),
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
            ("chore", 0, 0, "member", "🎀 a pocket-write chore", "a write with its fields known goes to helga; one that needs wording stays clio's", "habit-shared-files § the pocket"),
            ("add", 1, 0, "script", "⚙️ pocket-add.ts", "born green: open, a band + ordinal, a type, one size, a due only when asked; it names linear matches first", "script/pocket-add.ts"),
            ("item", 2, 0, "file", "📄 the item, pk-N", "a Backlog.md task: open · claimed · waiting · done; size xs · s · m", "pocket/tasks/ · backlog.config.yml"),
            ("move", 3, 0, "script", "⚙️ pocket-move.ts", "now · next · later: to the end of that band's order (ordinal 1000·10^band)", "script/pocket-move.ts"),
            ("shape", 4, 0, "script", "⚙️ pocket-check: the shape", "fields from the config, one size, ordinal in its band, a wish has W-lines, no note line lost", "script/pocket-check.ts"),
            ("clock", 4, 1, "script", "⚙️ pocket-check: the clock", "now ≤ 3 · triage due · a wait past tomorrow · an open item behind a ticket · an item leaving unclosed · lost notes, archive too", "runs at boot, after add and move, on each status move"),
            ("notes", 2, 1, "file", "📄 notes, appended only", "--append-notes, never --notes; his raw drop and quoted steers live here", "habit-shared-files § the pocket"),
        ],
        [
            ("chore", "add", "R", "L", ""), ("add", "item", "R", "L", ""), ("item", "move", "R", "L", ""),
            ("move", "shape", "R", "L", ""), ("shape", "clock", "B", "T", ""),
            ("item", "notes", "B6", "T6", ""),
        ],
        [],
    ),
    (
        "b3", "❓ 3 — the birth test: does linear already own this outcome?",
        "habit-shared-files § the pocket · craft-pm § the freebie rule · pocket-check.ts · clio:halt phase 1.5",
        [
            ("free", 0, 0, "clio", "❓ the freebie test", "1–5 tool calls i can name, no word of his, no lane; it runs first", "craft-pm § the freebie rule"),
            ("solved", 1, 0, "clio", "✅ solved that turn", "no pocket item: the commit and the reply are its record; still reported", "craft-pm § the freebie rule · habit-shared-files"),
            ("owns", 1, 1, "clio", "❓ does linear own it?", "one outcome never lives in both stores; moving to linear is a postponement, never a solve", "habit-shared-files § the pocket"),
            ("net", 2, 1, "event", "🔔 the inbox net", "every inbox item lands in the pocket at the parse; the test runs at the halt's sort, so a landing lives ≤ 1 day", "habit-shared-files · clio:halt phase 1.5"),
            ("body", 0, 2, "clio", "🎫 a line in its ticket", "yes: a body line of the owning ticket, before any new ticket, even when worked this minute", "habit-shared-files § the pocket"),
            ("stays", 1, 2, "clio", "🏃 pocket: today or tomorrow", "no, and soon: the main lane's scope, clio's open questions, shapeless ideas; no count cap", "habit-shared-files § the pocket"),
            ("linear", 2, 2, "clio", "🎫 → linear, in its milestone", "no, and later: a wait on a lane, a window or a date too; nothing ever moves back", "habit-shared-files · craft-pm § milestones"),
            ("wait", 1, 3, "clio", "🔔 waiting, ends by tomorrow", "a «waiting for:» first line + a due; a wait past tomorrow reds", "habit-shared-files · pocket-check.ts"),
            ("triage", 2, 3, "script", "⚙️ the 3-day triage", "items untouched 2+ days, revalidated by hand: still main lane, or out to linear; a stayer gets «kept: <date> — <why>»", "pocket-check.ts · boot · habit-shared-files"),
        ],
        [
            ("free", "solved", "R", "L", "yes"), ("free", "owns", "B", "L", "no"), ("net", "owns", "L", "R", "at the halt"),
            ("owns", "body", "B", "T", "yes"), ("owns", "stays", "B", "T", "no, soon"), ("owns", "linear", "B6", "T", "no, later"),
            ("stays", "wait", "B", "T", ""), ("wait", "triage", "R", "L", "every 3 days"),
        ],
        [],
    ),
    (
        "b4", "🎫 4 — the linear ticket: what does a ticket carry?",
        "clio:pm SKILL.md + references/body.md · craft-pm § fold or drop, § milestones first · habit-shared-files § the pocket",
        [
            ("search", 0, 0, "clio", "🦉 search before create", "the dupe, the right parent and relations; the run marker + the title stem", "craft-pm § fold or drop · body.md"),
            ("triage", 1, 0, "clio", "🎫 born in Triage", "x as clio -- linear issue create, never --state; a ticket must earn existence", "clio:pm § the door · craft-pm"),
            ("mile", 2, 0, "clio", "🎑 milestone first", "«which milestone?» on create, move, close; x-mod-guard refuses a bare one (FRM-417)", "craft-pm § milestones first"),
            ("fields", 3, 0, "file", "📄 every field", "role · kind · p3 · size XS·S·M like FRM-N · project · parent · milestone · delegate", "clio:pm § the fields"),
            ("body", 4, 0, "file", "📄 the body, a spec seed", "lane · wish · dima notes · why · stories · proposed · decided · open · 🎯 done test · out · refs · ## signed", "pm references/body.md"),
            ("gate", 4, 1, "clio", "❓ the assumption gate", "a fact dima never said → needs human + a ? line; to-spec only with open empty", "clio:pm § the fields · body.md"),
            ("promote", 3, 1, "dima", "🙋‍♂️ out of Triage is his", "his sign moves it to Todo; a human ticket is his to start", "clio:pm § the door"),
            ("dies", 2, 1, "clio", "✅ its pocket item dies", "the turn the ticket is born: «ticket: FRM-N» + a «close:» line, his raw drop kept in its notes", "habit-shared-files § the pocket · craft-pm § wishes"),
            ("standing", 0, 1, "clio", "🎫 a standing story", "an empty body, no comments; each round is a child ticket with the wish, pr and report", "pm references/body.md"),
        ],
        [
            ("search", "triage", "R", "L", ""), ("triage", "mile", "R", "L", ""), ("mile", "fields", "R", "L", ""),
            ("fields", "body", "R", "L", ""), ("body", "gate", "B", "T", ""), ("gate", "promote", "L", "R", ""),
            ("triage", "dies", "B6", "T", "same turn"), ("triage", "standing", "B", "T", "or a story"),
        ],
        [],
    ),
    (
        "b5", "🧭 5 — lane init: which states does a chunk walk?",
        "craft-fleet-flow § lane init · rules/fleet-vibe.md lane-init words · pm references/body.md",
        [
            ("wish", 0, 0, "event", "🌠 a wish", "his words, folded into W-lines; the fold proposes «shape-idea or not»", "craft-pm § wishes"),
            ("shaped", 1, 0, "file", "🎫 a shaped ticket", "through shape-idea when he picks it, else folded straight into a full ticket", "fleet-flow § lane init"),
            ("signed", 2, 0, "dima", "✍️ signed", "his whole answer to the grill: the signed label + a dated, hashed ## signed line", "clio:shape-lane § 4"),
            ("pick", 3, 0, "dima", "🙋‍♂️ his pick", "«what can we dispatch?» — his pick is the summon word, no second ask", "shape-lane-dispatch § 1"),
            ("sealed", 4, 0, "script", "🦭 sealed", "spec + exit lines written and preflight green, before codie starts", "shape-lane-dispatch § 2–4"),
            ("dispatched", 5, 0, "member", "🚀 dispatched", "codie starts: In Progress, the codie app as delegate, the signed label off", "shape-lane-dispatch § 5"),
            ("green", 5, 1, "clio", "🟢 greenlight", "clio's yes on codie's lane plan, after the summon", "shape-lane-dispatch § 5"),
            ("build", 4, 1, "member", "🔧 build", "the lane runs (band 8)", "fleet-flow stages 6–9"),
            ("t-ticket", 0, 1, "file", "🎫 the ticket holds", "the wish, the 🎯 done test, the ## signed block", "fleet-flow § lane init · body.md"),
            ("t-spec", 1, 1, "file", "📐 the spec holds", "the how and the exit lines: .scratch/<feature>/spec.md", "fleet-flow § lane init"),
            ("t-plan", 2, 1, "file", "📄 the lane plan holds", "the order of codie's tickets", "fleet-flow § lane init"),
        ],
        [
            ("wish", "shaped", "R", "L", ""), ("shaped", "signed", "R", "L", ""), ("signed", "pick", "R", "L", ""),
            ("pick", "sealed", "R", "L", ""), ("sealed", "dispatched", "R", "L", ""), ("dispatched", "green", "B", "T", ""),
            ("green", "build", "L", "R", ""),
        ],
        [],
    ),
    (
        "b6", "✍️ 6 — shaping and the sign: who says yes?",
        "clio:shape-idea · clio:shape-lane · craft-pm § wishes · craft-fleet-flow stages 2–4",
        [
            ("idea", 0, 0, "clio", "🦉 shape-idea, a pick", "a new app, a feature, a changed product part: want + grill, prior art, the cut, the done test", "clio:shape-idea steps 1–6"),
            ("out", 1, 0, "file", "📄 one shaped ticket", "wish, decided, the cut as out, the 🎯 done test; no files: PRODUCT.md is born at dispatch", "clio:shape-idea step 7"),
            ("plain", 2, 0, "clio", "🎫 plain work: a full ticket", "mechanical wishes skip shape-idea, folded straight into a full ticket, never a thin one", "craft-pm § wishes · clio:pm"),
            ("prep", 0, 1, "dima", "🙋‍♂️ you start a sign", "you say «prep», «sign» or «next chunk» («fast» for many); the ticket enters shape-lane, a wish signed on the spot folds first", "clio:shape-lane"),
            ("read", 1, 1, "clio", "🦉 read what is settled", "the wish block + decided; each round's proposal file passes the wish-cover hook", "shape-lane § 0"),
            ("card", 2, 1, "file", "📄 the chunk card", "an h2 + two lines: why we have it, what we want out of it", "shape-lane § 1"),
            ("mode", 3, 1, "clio", "❓ single or fast?", "single: one chunk per grill, the default; fast on his word: a triage first, only chunks needing no call of his", "shape-lane § 2"),
            ("grill", 4, 1, "dima", "🙋‍♂️ the grill", "matt's ❓ rounds, the frontier only; a fast chunk is self-grilled by clio, fully groomed", "shape-lane § 2"),
            ("fields", 5, 1, "file", "📄 what the sign carries", "done test · milestone · lane kind · repo · blocks order · merge: pre-approved for guards or merge-auto", "shape-lane § 3"),
            ("sign", 5, 2, "dima", "✍️ his whole answer is the sign", "a grill answered whole signs it; a fast chunk gets one ✍️ ask; a steer takes it back", "shape-lane § 4"),
            ("block", 4, 2, "file", "📄 the ## signed block", "«✍️ signed <date> · body <hash>», appended, never edited; every later body write adds a line", "shape-lane § 4 · body.md"),
            ("resign", 3, 2, "clio", "🔁 a re-sign", "a changed signed ticket goes through shape-lane again; a tiny change skips the grill, never the line", "shape-lane § 4 · fleet-flow § lane init"),
            ("w-hash", 2, 2, "weak", "⚠️ nothing enforces the line", "a body write without its ## signed line shows only at dispatch's hash check; the guard rides FRM-384", "my reading · shape-lane § 4"),
            ("main", 0, 2, "clio", "🐋 the main lane signs too", "our own steps as one chunk, lane: main, no codie, no spec; glide is its progress — a trial (FRM-419)", "fleet-flow § lane init"),
        ],
        [
            ("idea", "out", "R", "L", ""), ("out", "prep", "B", "T", "shaped"), ("plain", "prep", "B", "T", "or plain"),
            ("prep", "read", "R", "L", ""), ("read", "card", "R", "L", ""), ("card", "mode", "R", "L", ""),
            ("mode", "grill", "R", "L", ""), ("grill", "fields", "R", "L", ""), ("fields", "sign", "B", "T", ""),
            ("sign", "block", "L", "R", ""), ("block", "resign", "L", "R", "a change after"),
        ],
        [("w-hash", "resign")],
    ),
    (
        "b7", "🚀 7 — dispatch: how does a signed chunk become a running lane?",
        "clio:shape-lane-dispatch (+ exit-lines.md) · x:crew-lead · craft-fleet-flow § lane init, stage 5",
        [
            ("offer", 0, 0, "dima", "🙋‍♂️ «what can we dispatch?»", "signed, unblocked chunks by milestone; a hash off its last sign line → a re-sign", "shape-lane-dispatch § 1"),
            ("lane", 1, 0, "file", "🛼 a lane = one milestone", "its signed chunks in blocks order, one glide step each; a shift walks milestones in queue order", "fleet-flow § lane init"),
            ("spec", 2, 0, "file", "📐 the spec", ".scratch/<feature>/spec.md, wish: FRM-N, a section per chunk; PRODUCT.md for an app, skill or tool", "shape-lane-dispatch § 2 · to-spec"),
            ("exit", 3, 0, "clio", "🦉 the exit lines", "3–6 given/when/then per chunk, the want line last, seeded from the 🎯 done test", "dispatch § 3 · exit-lines.md"),
            ("critic", 4, 0, "member", "🐦‍⬛ the blind critic", "crow:plan-critique sees only the want + the lines; each finding folded", "shape-lane-dispatch § 3"),
            ("seal", 5, 0, "script", "🦭 the seal", "x brief preflight passes; the print collapses to «🦭 sealed, N exit lines»", "shape-lane-dispatch § 4"),
            ("spawn", 4, 1, "clio", "📋 the summon", "x:crew-lead: a fresh codie, a sixth sense by default; the brief runs to-tickets first, its quiz skipped", "shape-lane-dispatch § 5"),
            ("dispatched", 3, 1, "file", "🚀 dispatched", "the signed label off, In Progress, «🚀 dispatched <date>» appended; a cancel: Canceled + «🚫 cancelled»", "shape-lane-dispatch § 5"),
            ("plan", 2, 1, "file", "📄 the lane plan", "~/.local/state/x/lanes/<feature>/lane-plan.md: codie's ticket order", "dispatch § 5 · how-you-work.md"),
            ("green", 1, 1, "clio", "🟢 the greenlight", "clio reorders it against what comes next, final word; again after a [progress] ping", "shape-lane-dispatch § 5"),
            ("joiner", 0, 1, "clio", "➕ a joiner", "a signed chunk of the same milestone: a new spec section, a glide step, a steer", "shape-lane-dispatch § 6"),
            ("park", 0, 2, "clio", "🅿️ a park", "a call only dima can make parks the chunk, its reason in the spec; a shift takes the next", "dispatch § 6 · fleet-flow § lane init"),
            ("w-glide", 1, 2, "weak", "⚠️ the glide card copies it", "its ticket lines copied by hand at each greenlight and land, until FRM-410", "my reading · dispatch § 5"),
        ],
        [
            ("offer", "lane", "R", "L", ""), ("lane", "spec", "R", "L", ""), ("spec", "exit", "R", "L", ""),
            ("exit", "critic", "R", "L", ""), ("critic", "seal", "R", "L", ""), ("seal", "spawn", "B2", "T", ""),
            ("spawn", "dispatched", "L", "R", ""), ("dispatched", "plan", "L", "R", ""), ("plan", "green", "L", "R", ""),
            ("green", "joiner", "L", "R", "while it runs"), ("joiner", "park", "B", "T", "or"),
        ],
        [("w-glide", "green")],
    ),
    (
        "b8", "🏃 8 — the lane: how does the ticket get built?",
        "x:crew-codie how-you-work.md · craft-fleet-flow stages 6–9, three kinds of work · docs/knowledge/pr-flow.md",
        [
            ("kinds", 0, 0, "file", "🛼 three kinds of work", "freebie: in place · quick: on main, no pr, no sign · side and shift: worktree, pr, sixth sense", "craft-fleet-flow"),
            ("cut", 1, 0, "member", "🔧 codie cuts the spec", "matt's to-tickets after reading the code, so the slices follow real seams", "how-you-work.md · dispatch § 5"),
            ("slices", 2, 0, "file", "📄 the slices", ".scratch/<feature>/issues/, never linear; each exit line in one checklist", "how-you-work.md · body.md"),
            ("build", 3, 0, "member", "🔧 build, test-first", "tdd per ticket, [x] at its commit; his steers land under ## not greenlit", "how-you-work.md"),
            ("verify", 4, 0, "member", "🔎 the pr and sixth sense", "sixth sense says clean, or its round-3 stop goes to clio", "fleet-flow stages 6–7"),
            ("land", 5, 0, "clio", "🔀 land", "clio merges by the pr-flow gate; a self-edit waits for dima unless his sign pre-approved it", "fleet-flow stage 8"),
            ("w-merge", 5, 1, "weak", "⚠️ merge-auto takes no word", "a pre-approved self-edit lands by a hand gh merge; until FRM-458", "my reading · fleet-flow stage 8"),
            ("look", 4, 1, "dima", "🙋‍♂️ the look card", "what, where, try, proven, not checked; a shot for anything rendered", "how-you-work.md · fleet-flow stage 9"),
            ("modes", 3, 1, "file", "🔀 plain or stacked prs", "plain is the default; stacks an easy-to-delete add-on on trial, never breaking plain", "pr-flow.md · x/AGENTS.md · BYT-98"),
        ],
        [
            ("kinds", "cut", "R", "L", ""), ("cut", "slices", "R", "L", ""), ("slices", "build", "R", "L", ""),
            ("build", "verify", "R", "L", ""), ("verify", "land", "R", "L", ""), ("land", "look", "B2", "T", ""),
        ],
        [("w-merge", "land")],
    ),
    (
        "b9", "🏁 9 — the end: how does a ticket close and leave?",
        "pm references/closing.md · craft-pm § the ask-guard · clio:halt phases 0, 1.5, 3.5, 4.5 · pocket-check.ts",
        [
            ("sweep", 0, 0, "script", "⚙️ the lingering sweep", "the halt lists In Progress; landed (a merged pr or a quick lane's push) with open asks → Todo, a ↩️ line names why and what is left", "clio:halt phase 0"),
            ("list", 1, 0, "clio", "🦉 «closable, because …»", "auto-close only stale, dupe, a freebie done in place; the rest wait for his word", "pm references/closing.md"),
            ("guard", 2, 0, "dima", "🙋‍♂️ the ask-guard", "each ask of his printed with its destination; no verdict, no close", "closing.md · craft-pm § the ask-guard"),
            ("closed", 3, 0, "clio", "🎫 closed, a closing word", "in the body; the milestone's count read the same turn", "closing.md · craft-pm § milestones first"),
            ("net", 4, 0, "script", "⚙️ pocket-check's net", "an open item behind a ticket reds (a held line holds it 3 days); a closed ticket always reds", "pocket-check.ts · habit-shared-files"),
            ("archive", 1, 1, "script", "⚙️ the halt files it", "backlog task archive, every done item the post carried; one listed past its day reds", "clio:halt phase 4.5 · pocket-check.ts"),
            ("inbox", 4, 1, "script", "⚙️ the inbox reset", "halt-sweep.ts copies his template over; it refuses a line without ✅", "clio:halt phase 1.5"),
            ("linarch", 3, 1, "script", "⚙️ x linear archive", "closed tickets untouched for 14 days; the free plan caps at 250", "clio:halt phase 3.5 · clio:pm"),
            ("gazette", 2, 1, "clio", "📝 the gazette carries it", "the day's done items and the fleet ops numbers, posted at the halt", "clio:halt phase 4.5"),
        ],
        [
            ("sweep", "list", "R", "L", ""), ("list", "guard", "R", "L", ""), ("guard", "closed", "R", "L", ""),
            ("closed", "net", "R", "L", "backstop"), ("net", "inbox", "B", "T", ""),
            ("inbox", "linarch", "L", "R", ""), ("linarch", "gazette", "L", "R", ""), ("gazette", "archive", "L", "R", ""),
        ],
        [],
    ),
]

MAGNET = {"R": (1, 0.5), "L": (0, 0.5), "T": (0.5, 0), "B": (0.5, 1),
          "B2": (0.2, 1), "B6": (0.6, 1), "T6": (0.6, 0)}


def style(**kv):
    return ";".join(f"{k}={v}" for k, v in kv.items()) + ";"


# the fleet's words, bold wherever a tile's detail names them (dima's shot, 2026-10-23 20:15: bold keywords read easier)
KEYWORDS = sorted([
    "shape-idea", "shape-lane-dispatch", "shape-lane", "dispatch", "dispatched", "signed", "sealed", "greenlight",
    "spec", "exit lines", "lane plan", "done test", "pocket", "linear", "inbox", "wish", "freebie", "milestone",
    "codie", "sixth sense", "glide", "orbit", "helga", "crow", "wishkeeper", "re-sign", "main lane", "side lane",
], key=len, reverse=True)
BOLD = re.compile(r"(?<![\w./-])(" + "|".join(re.escape(k) for k in KEYWORDS) + r")(?![\w./-])")
# dima's notes: Edit Data fields `dima`, `dima-2`, … on any cell; kept through a redraw and listed in one tile
NOTE = re.compile(r"^dima(-\d+)?$")
OBJECT = re.compile(r'\n\s*<object\b[^>]*\bid="(tf-[^"]*)"[^>]*>.*?</object>', re.S)


def bolded(text):
    return BOLD.sub(r"<b>\1</b>", html.escape(text))


def label(title, detail, source):
    return (
        f'<b style="font-size:26px">{html.escape(title)}</b>'
        f'<br><span style="font-size:20px">{bolded(detail)}</span>'
        f'<br><i style="font-size:16px;color:#5C5C5C">{html.escape(source)}</i>'
    )


def text_height(title, detail, source, width):
    """A rough height of the label: chars per line by font size, 1.2 line height."""
    usable = width - 56
    def lines(text, char_w):
        wide = sum(2 if ord(c) > 0x2000 else 1 for c in text)
        return math.ceil(wide * char_w / usable)
    return 1.2 * (26 * lines(title, 15) + 20 * lines(detail, 10) + 16 * lines(source, 8.2)) + 16


def tile_style(kind):
    fill, stroke = KIND[kind]
    return "rounded=1;" + style(
        whiteSpace="wrap", html=1, absoluteArcSize=1, arcSize=80, fillColor=fill, strokeColor=stroke,
        strokeWidth=3, fontFamily=FONT, fontColor="#1E1E1E", spacingLeft=20, spacingRight=20, spacing=8,
    )


def text_style(size, bold):
    return style(
        strokeColor="none", fillColor="none", html=0, whiteSpace="nowrap", align="left", verticalAlign="top",
        spacing=0, fontFamily=FONT, fontSize=size, fontStyle=1 if bold else 0, fontColor="#1E1E1E",
    )


NOTES = {}  # cell id → {field: note}, read from the file before the section is rebuilt


def add(root, cid, parent, value, st, x, y, w, h, **extra):
    if cid in NOTES:
        holder = ET.SubElement(root, "object", label=value, placeholders="1", id=cid, **NOTES[cid])
        cell = ET.SubElement(holder, "mxCell", style=st, parent=parent, **extra)
    else:
        cell = ET.SubElement(root, "mxCell", id=cid, value=value, style=st, parent=parent, **extra)
    geo = ET.SubElement(cell, "mxGeometry", x=str(x), y=str(y), width=str(w), height=str(h))
    geo.set("as", "geometry")
    return cell


def read_notes(root):
    """Every note on the board, in reading order: (cell id, its title, field, note)."""
    found = []
    for obj in root.iter("object"):
        fields = {k: v for k, v in obj.attrib.items() if NOTE.match(k)}
        if not fields:
            continue
        title = re.sub(r"<[^>]+>", " ", obj.get("label", "")).split("  ")[0].strip() or obj.get("id")
        if obj.get("id", "").startswith(PREFIX):
            NOTES[obj.get("id")] = fields
        found += [(obj.get("id"), html.unescape(title), k, v) for k, v in sorted(fields.items())]
    return found


def notes_tile(root, notes):
    def where(cid, title):
        band = re.match(rf"{PREFIX}b(\d+)-", cid or "")
        return f"band {band.group(1)}, «{title}»" if band else f"«{title}»"
    lines = [f"📍 <b>{html.escape(where(cid, title))}</b>: {html.escape(note)}" for cid, title, _, note in notes] or ["none open"]
    body = "<br>".join(lines)
    height = 110 + 34 * len(lines)
    add(root, f"{PREFIX}notes", "1",
        f'<b style="font-size:26px">📝 dima\'s notes</b><br><span style="font-size:20px">{body}</span>',
        "rounded=1;" + style(whiteSpace="wrap", html=1, align="left", verticalAlign="top", absoluteArcSize=1, arcSize=40,
            fillColor="#FFF4C2", strokeColor="#E5B800", strokeWidth=3, fontFamily=FONT, fontColor="#1E1E1E", spacing=24),
        ORIGIN_X + BAND_W - 1100, ORIGIN_Y - height - 40, 1100, height, vertex="1")


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
        "the files as they read on 2026-10-25, the pocket ↔ linear contract landed · ⚠️ red tiles are my reading, every other tile names its file",
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
        for tid, col, row, kind, title, detail, source in band_tiles:
            x, ty = PAD + col * COL_STEP, ROW0 + row * ROW_STEP
            add(root, f"{bid}-{tid}", bid, label(title, detail, source), tile_style(kind), x, ty, TILE_W, TILE_H, vertex="1")
            tiles[f"{bid}-{tid}"] = (bid, ORIGIN_X + x, y + ty, TILE_W, TILE_H, text_height(title, detail, source, TILE_W))
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
    # a noted cell is an <object> holding an id-less mxCell
    cells = {c.get("id"): (c if c.tag == "mxCell" else c.find("mxCell")) for c in root if c.get("id")}
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
    notes = read_notes(ET.fromstring(text).find("diagram/mxGraphModel/root"))
    text = OBJECT.sub("", OURS.sub("", text))
    root = ET.fromstring(text).find("diagram/mxGraphModel/root")
    before = len(root)
    tiles = build(root)
    notes_tile(root, notes)
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
    board_version.bump("crew-pm-flow", TARGET)


if __name__ == "__main__":
    main()
