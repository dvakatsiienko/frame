#!/bin/sh
# dima's typed prompts since a date → <out>/prompts.jsonl, deduped by text and minute, plus <out>/chunk-NN.jsonl for the labelling lanes.
# usage: prompts-extract.sh <since yyyy-mm-dd> <out-dir> [chunks=4]
# a prompt counts in the cclio, frame, bytes or home project dirs, through the cli or the desktop app; coder briefs, hook echoes and peer lines are dropped.
set -eu
since=$1 out=$2 chunks=${3:-4}
mkdir -p "$out"
raw="$out/prompts-raw.jsonl"
: > "$raw"
for dir in -Users-dima-frame-cclio -Users-dima-frame -Users-dima-projects-bytes -Users-dima; do
  for f in "$HOME/.claude/projects/$dir"/*.jsonl; do
    [ -e "$f" ] || continue
    jq -c --arg p "$dir" 'select(.type=="user" and (.isMeta|not) and (.isSidechain|not) and (.entrypoint=="cli" or .entrypoint=="claude-desktop"))
      | {p:$p, s:.sessionId, t:.timestamp,
         txt:(if (.message.content|type)=="string" then .message.content else ([.message.content[]? | select(.type=="text") | .text] | join("\n")) end),
         img:([.message.content[]? | select(.type=="image")]|length),
         tr:([.message.content[]? | select(.type=="tool_result")]|length)}
      | select(.tr==0 and (.txt|length)>0)' "$f" 2>/dev/null >> "$raw" || true
  done
done
duckdb -c "
create table d as select * replace (t::timestamptz::timestamp as t), regexp_replace(txt,'\s+',' ','g') flat from read_json_auto('$raw')
  where t::timestamptz >= '$since'::timestamptz;
create table u as select min(t) t, any_value(p) p, any_value(s) s, flat, max(img) img, length(flat) len from d
  where flat not like '<%' and flat not like 'reply with only%' and flat not like 'PROBLEM:%' and flat not like 'you are ccrow%'
    and flat not like 'This session is being continued%' and flat not like '[Request interrupted%' and flat not like 'The x-mod-stash%'
    and flat <> 'ping' and flat not like 'HANDOFF%' and flat not like 'Caveat:%' and flat not like 'ccrow wake%'
  group by flat, date_trunc('minute', t);
copy (select row_number() over (order by t) id, strftime(t,'%Y-%m-%d %H:%M') t, p, img, len, left(flat,600) txt from u order by t) to '$out/prompts.jsonl';"
n=$(wc -l < "$out/prompts.jsonl" | tr -d ' ')
split -l $(( (n + chunks - 1) / chunks )) -d "$out/prompts.jsonl" "$out/chunk-"
for c in "$out"/chunk-[0-9]*; do case $c in *.jsonl) ;; *) mv "$c" "$c.jsonl" ;; esac; done
rm "$raw"
echo "prompts: $n since $since → $out ($chunks chunks)"
