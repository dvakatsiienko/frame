---
name: yt-transcript
description: Load whenever a YouTube link is pasted, or Dima asks to transcribe / summarise / ingest a video, or asks what a video already on the shelf said.
argument-hint: "<youtube url> [transit] | <title fragment or video id> | list"
---

# yt-transcript

**lane** — `cw`: `x-cw__yt_transcript_fetch`, `x-cw__yt_transcript_transit`, `x-cw__yt_transcript_recall`, `x-cw__yt_transcript_list` · `cc`: Bash.

Downloads YouTube captions, cleans them into readable text, shelves them so a video is never
fetched twice. **Captions only** — Whisper is deliberately not here
([DOT-211](https://linear.app/x-com/issue/DOT-211)); never download a model, point at the ticket.

Plain shell — run via `Bash` on cc, Desktop Commander on `cw`. Needs `yt-dlp`, `jq`, `python3`.

## The store

```
~/.claude/shelf/yt-transcripts/{channel}-{title}-{video_id}/
├── transcript.txt    # clean readable text — the thing you read
├── metadata.json     # url, video_id, title, channel, duration, source — the provenance
└── captions.vtt      # raw download, kept as audit trail
```

**Always write metadata.json** — `transcript.txt` alone cannot say which video it came from;
quote a transcript back with the title and url from that file.

Naming: lowercase kebab, nothing needing shell quotes. **Channel first** (the store sorts
alphabetically, one creator = one block — entity-first as everywhere) · **`-{video_id}` last**
(the dedupe and recall key; id keeps its case, YouTube ids are case-sensitive). Channel capped
at 24 chars, title at 50, cut at word boundaries. No channel → `{title}-{video_id}`, never pad
with `unknown`.

## Three modes

- **fetch** (default) — a url → written to the shelf and **kept**
- **transit** — a url + the word `transit` → written, read into the thread, then **deleted**
- **recall** — no url, a title fragment or video id → read only, **never deletes**

Keep is the default: Dima picks videos he already judged useful. `transit` is about the shelf
staying searchable, not disk — safe as a bare flag because captions re-download in seconds.

## Fetch

⚠️ **Shell variables do not survive between tool calls** — repeat this preamble atop every
batch. **`WORK` is a fixed dotfile path, not `mktemp -d`** — a random dir cannot be found from
the next call, and a dotfile never shows in `ls` or dedupe.

```bash
URL='<the youtube url>'
SHELF="$HOME/.claude/shelf/yt-transcripts"
SCRIPTS="$HOME/frame/home/.claude/plugin-x/skills/yt-transcript/scripts"
WORK="$SHELF/.work-$$"   # per run: two parallel transits shared one dir and one's delete killed the other's meta.json (2026-09-10)
mkdir -p "$SHELF" "$WORK"
# after step 1 exists, this belongs in the preamble too:
VID=$(jq -r .id "$WORK/meta.json")
```

📌 **Two round trips total**: steps 1–2 end on a language decision only you can make — one
call; steps 3–5 need no judgment — the second call.

### 1. One metadata call — never `--list-subs`

```bash
yt-dlp -J --skip-download "$URL" 2>/dev/null > "$WORK/meta.json"
jq '{video_id: .id, title, channel: (.channel // .uploader), duration,
     manual: (.subtitles | keys),
     auto: (.automatic_captions | keys | map(select(startswith("en"))))}' "$WORK/meta.json"
```

⚠️ `--list-subs` prints every machine-translatable language — hundreds of noise rows. `-J`
gives the same facts plus title and channel in one ~2s call.

### 2. Dedupe before downloading anything

```bash
ls "$SHELF" 2>/dev/null | grep -E -- "-${VID}$"
```

A hit = transcript exists: **read it and stop**, say you reused it. ⚠️ Anchor with `$` exactly
as written (the id is always the name's tail; unanchored matches slugs merely containing those
letters; `--` because the pattern starts with a hyphen). 📌 Never a glob or `find -name` — the
old `title [id]` naming made `*[PXzHKuBuyJU]` a **character class**; do not reintroduce that shape.

### 3. Pick exactly ONE language code

1. a manual caption language (`.subtitles`) — human-written, best
2. else the auto key ending `-orig` (`en-orig`) — spoken language, untranslated
3. else plain `en`

⚠️ One code, never a pattern — `'en.*'` or `'en,en-orig'` fetches many tracks and YouTube
answers **429**, blocking the whole run.

### 4. Download into the target directory

```bash
TITLE=$(jq -r .title "$WORK/meta.json")
CHANNEL=$(jq -r '.channel // .uploader // ""' "$WORK/meta.json")
NAME=$(python3 "$SCRIPTS/sanitize_title.py" "$CHANNEL" "$TITLE" "$VID") || exit 1
DIR="$SHELF/$NAME"
mkdir -p "$DIR" && cd "$DIR"

yt-dlp --skip-download --write-subs --write-auto-subs \
       --sub-langs '<the one code>' --sub-format vtt -o captions "$URL" >/dev/null 2>&1 || true

ls captions.*.vtt && mv captions.*.vtt captions.vtt
```

⚠️ Looks wrong, is not: **`|| true` + success judged by `ls`** — yt-dlp exits non-zero on
conditions that still produced the file. **Both subs flags** — manual and auto are separate;
a video can have one without the other (`Me at the zoo`: manual `en`, zero auto). yt-dlp
appends the language code to the filename, hence the rename.
⚠️ **Build `NAME` separately and bail on failure — never inline into `DIR`**: an inlined
failing `$(...)` leaves `DIR="$SHELF/"` and the download lands in the store root.

### 5. Clean and record

```bash
python3 "$SCRIPTS/clean_captions.py" captions.vtt transcript.txt "$WORK/meta.json"

jq -n --slurpfile m "$WORK/meta.json" --arg url "$URL" --arg lang '<the one code>' \
      --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg mode '<fetch|transit>' \
  '{url: $url, video_id: $m[0].id, title: $m[0].title,
    channel: ($m[0].channel // $m[0].uploader), duration_seconds: $m[0].duration,
    upload_date: $m[0].upload_date, source: "captions", caption_lang: $lang, fetched_at: $at, mode: $mode}' \
  > metadata.json

trash "$WORK"
```

📌 **Pass the third argument** — it repairs mangled identifiers (`Claude MD`, `cloud.md` →
`CLAUDE.md`) from the video's own title/description/tags. Measured on DOT-211's test videos:
**5/18 correct before, 18/18 after.** The script prints what it changed — repeat that line when
reporting, so a wrong repair is visible.

### 6. Read it, then report

📌 **Check size before reading whole** — a 50-min talk ≈ 60k chars ≈ 15k tokens; narrow ask →
grep or slice, and say which you did. Report one line: title, channel, duration, path in
backticks.

## Transit

Fetch through step 6, then:

```bash
trash "$DIR"
ls "$SHELF"
```

📌 `trash`, never `rm -rf` on a variable path: claude code's safety check refuses `rm -rf "$DIR"` outright (2026-09-27), and trash keeps the delete recoverable.
Delete only AFTER the transcript is in the conversation; the `ls` is the receipt — confirm the
dir is gone. A dir whose `metadata.json` says `mode: transit` is a transit that died
before this step — delete it on sight and say so; `mode: fetch` dirs are kept on purpose. 🚫 Never delete anything but this video's dir. 🚫 `transit` never applies in recall.

## Recall

No url, just words. Bare `list` = the first command only.

```bash
SHELF="$HOME/.claude/shelf/yt-transcripts"
ls "$SHELF"                                            # everything
ls "$SHELF" | grep -iF -- '<fragment or video id>'     # narrow by dir name
grep -li -- '<fragment>' "$SHELF"/*/metadata.json      # search real titles
```

📌 Dir names are kebab — `CLAUDE.md` appears as `claude-md`; punctuated or quoted-verbatim
fragments → search `metadata.json`. Then read `transcript.txt` + `metadata.json`.
**Recall never deletes** (opposite of `handoff-ingest`). No match: list the shelf, offer to
fetch — never invent a url.

## Not in this skill

- **Whisper** — [DOT-211](https://linear.app/x-com/issue/DOT-211); trigger is "the captions are
  wrong", detectable only by a human.
- **`parakeet-cli`** — possible future experiment; not wired, not installed, do not reach for it.
