---
name: yt-transcript
description: Load whenever a YouTube link is pasted, or Dima asks to transcribe / summarise / ingest a video, or asks what a video already on the shelf said.
argument-hint: "<youtube url> [transit] | <title fragment or video id> | list"
---

# yt-transcript

**lane** — `cloud-chat`: `x-cloud-chat__yt_transcript_fetch`, `x-cloud-chat__yt_transcript_transit`, `x-cloud-chat__yt_transcript_recall`, `x-cloud-chat__yt_transcript_list` · `cc`: Bash.

Downloads YouTube captions, cleans them into readable text, shelves them so a video is never
fetched twice. **Captions only** — Whisper is deliberately not here
([DOT-211](https://linear.app/x-com/issue/DOT-211)); never download a model, point at the ticket.

Needs `yt-dlp`, `jq`, `python3`.

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

One call does metadata, dedupe, language pick, download, clean and record:

```bash
bash ~/frame/home/.claude/plugin-x/skills/yt-transcript/scripts/fetch.sh '<url>'
```

Optional language override as a second argument (`... '<url>' de`) — one code, only when the
default pick came back with no captions. `--mode transit` stamps `mode: transit` in
`metadata.json` (see Transit); the default is `fetch`.

Output: `reused: <dir>` = already on the shelf, nothing downloaded — read it and say you reused
it. Otherwise the last lines are `dir: <path>` (read `transcript.txt` there) and `chars: <n>`,
preceded by any `Repaired … identifier spelling(s)` line — repeat it when reporting, so a wrong
repair is visible. A non-zero exit prints one line on stderr (the language tried, or the failing
step); report it, never improvise a fallback.

The script guards, so never bypass it with hand-run yt-dlp: one metadata call, never
`--list-subs` · dedupe anchored on the id tail, never a glob or `find -name` · exactly one
language code, never a pattern or list (YouTube answers 429) · the dir name built on its own
(a failure must never make the shelf root the target) · both subs flags, `|| true`, success
judged by the file · identifiers repaired from the video's own metadata · work dir trashed.

### Read it, then report

📌 **Check size before reading whole** — a 50-min talk ≈ 60k chars ≈ 15k tokens; narrow ask →
grep or slice, and say which you did. Report one line: title, channel, duration, path in
backticks.

## Transit

Fetch with `--mode transit` through step 6, then trash the `dir:` from the output (the script
never deletes it) and `ls ~/.claude/shelf/yt-transcripts` as the receipt:

```bash
trash '<the dir: path>'
```

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
