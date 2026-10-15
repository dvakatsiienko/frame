#!/usr/bin/env bash
# Fetch one YouTube video's captions onto the shelf: metadata, dedupe, one language, clean, record.
# usage: fetch.sh <url> [lang] [--mode fetch|transit]
# stdout ends with `dir: <path>` and `chars: <bytes>`; `reused: <dir>` when the video is already shelved.
set -euo pipefail

die() { echo "fetch.sh: $*" >&2; exit 1; }

url='' lang='' mode=fetch
pos=0
while (($#)); do
  case $1 in
    --mode)
      (($# >= 2)) || die "--mode needs fetch or transit"
      mode=$2
      shift 2
      ;;
    *)
      pos=$((pos + 1))
      if ((pos == 1)); then url=$1; elif ((pos == 2)); then lang=$1; else die "unexpected argument: $1"; fi
      shift
      ;;
  esac
done
[[ -n $url ]] || die "usage: fetch.sh <url> [lang] [--mode fetch|transit]"
[[ $mode == fetch || $mode == transit ]] || die "mode must be fetch or transit, got: $mode"

shelf="$HOME/.claude/shelf/yt-transcripts"
scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$shelf/.work-$$" # per run: parallel runs must not share a dir
dir=''

# A failed run must not leave a half-built dir behind: the next dedupe would call it a hit.
cleanup() {
  local rc=$?
  if ((rc != 0)) && [[ -n $dir && -d $dir ]]; then trash "$dir" || true; fi
  if [[ -d $work ]]; then trash "$work" || true; fi
  exit "$rc"
}
trap cleanup EXIT

mkdir -p "$shelf" "$work"

# 1. one metadata call, never --list-subs
yt-dlp -J --skip-download "$url" 2>/dev/null > "$work/meta.json" || die "yt-dlp metadata call failed for $url"
vid=$(jq -r '.id // empty' "$work/meta.json")
[[ -n $vid ]] || die "no video id in the metadata for $url"

# 2. dedupe, anchored on the id tail
# shellcheck disable=SC2010 # a glob would be a character-class trap on ids; the anchored grep is the contract
hit=$({ ls "$shelf" | grep -E -- "-${vid}\$" || true; } | head -n 1)
if [[ -n $hit ]]; then
  echo "reused: $shelf/$hit"
  exit 0
fi

# 3. exactly one language code: manual (en* first), else the -orig auto key, else en
if [[ -z $lang ]]; then
  lang=$(jq -r '(.subtitles // {} | keys | map(select(. != "live_chat"))) as $m
    | ((.automatic_captions // {} | keys) | map(select(endswith("-orig")))) as $o
    | ($m | map(select(startswith("en"))) + $m + $o + ["en"])[0]' "$work/meta.json")
fi

# 4. the name is built on its own so a failure can never turn dir into the shelf root
title=$(jq -r '.title // ""' "$work/meta.json")
channel=$(jq -r '.channel // .uploader // ""' "$work/meta.json")
name=$(python3 "$scripts/sanitize_title.py" "$channel" "$title" "$vid") || die "sanitize_title.py failed for $vid"
[[ -n $name ]] || die "empty directory name for $vid"
dir="$shelf/$name"
mkdir -p "$dir"

# yt-dlp exits non-zero on conditions that still wrote the file: judge by the file
yt-dlp --skip-download --write-subs --write-auto-subs \
  --sub-langs "$lang" --sub-format vtt -o "$dir/captions" "$url" >/dev/null 2>&1 || true
ls "$dir"/captions.*.vtt >/dev/null 2>&1 || die "no captions downloaded for language: $lang"
mv "$dir"/captions.*.vtt "$dir/captions.vtt"

# 5. clean (third arg repairs identifiers) and record
python3 "$scripts/clean_captions.py" "$dir/captions.vtt" "$dir/transcript.txt" "$work/meta.json"

jq -n --slurpfile m "$work/meta.json" --arg url "$url" --arg lang "$lang" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg mode "$mode" \
  '{url: $url, video_id: $m[0].id, title: $m[0].title,
    channel: ($m[0].channel // $m[0].uploader), duration_seconds: $m[0].duration,
    upload_date: $m[0].upload_date, source: "captions", caption_lang: $lang, fetched_at: $at, mode: $mode}' \
  > "$dir/metadata.json"

echo "dir: $dir"
echo "chars: $(wc -c < "$dir/transcript.txt" | tr -d ' ')"
dir='' # success: the exit trap must not delete it
