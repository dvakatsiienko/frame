#!/bin/sh
# the coordinator's final reply per turn since a date, paired with dima's next prompt → <out>/replies.parquet,
# the per-week numbers on stdout, and a sample of <n> pairs → <out>/reply-sample.jsonl for the reading lane.
# usage: replies-extract.sh <since yyyy-mm-dd> <out-dir> [sample=220]
set -eu
since=$1 out=$2 sample=${3:-220}
mkdir -p "$out"
turns="$out/turns.jsonl"
: > "$turns"
for dir in -Users-dima-frame-cclio -Users-dima-frame -Users-dima-projects-bytes; do
  for f in "$HOME/.claude/projects/$dir"/*.jsonl; do
    [ -e "$f" ] || continue
    jq -c 'select((.isSidechain|not) and (.entrypoint=="cli" or .entrypoint=="claude-desktop"))
      | if .type=="assistant" then ([.message.content[]? | select(.type=="text") | .text] | join("\n")) as $x | select(($x|length)>0) | {s:.sessionId,t:.timestamp,r:"a",x:$x}
        elif (.type=="user" and (.isMeta|not)) then
          (if (.message.content|type)=="string" then .message.content else ([.message.content[]? | select(.type=="text") | .text]|join("\n")) end) as $x
          | select(($x|length)>0 and ([.message.content[]? | select(.type=="tool_result")]|length)==0 and ($x|startswith("<")|not)
              and ($x|startswith("[Request interrupted")|not) and ($x|startswith("This session is being continued")|not))
          | {s:.sessionId,t:.timestamp,r:"h",x:$x}
        else empty end' "$f" 2>/dev/null >> "$turns" || true
  done
done
duckdb -c "
create table t as select s, t::timestamptz::timestamp t, r, x from read_json_auto('$turns') where t::timestamptz >= '$since'::timestamptz;
create table k as select *, sum((r='h')::int) over (partition by s order by t rows unbounded preceding) turn from t;
create table rep as select s, turn, max(t) t, last(x order by t) reply from k where r='a' and turn>0 group by s, turn;
create table nxt as select s, turn-1 turn, first(x order by t) nextp from k where r='h' group by s, turn;
create table p as select rep.*, nxt.nextp from rep left join nxt using (s, turn);
copy p to '$out/replies.parquet';
select strftime(t,'%Y-W%V') wk, count(*) n, median(length(reply))::int med, quantile_cont(length(reply),0.9)::int p90,
  round(avg(len(regexp_extract_all(reply,'\n\d+\. [^\n]*➡️'))),2) asks, round(avg(len(regexp_extract_all(reply,'\n\s*- '))),1) bullets
  from p where length(reply)>40 group by 1 order by 1;
copy (select row_number() over () id, strftime(t,'%m-%d %H:%M') t, left(reply,3500) reply, left(coalesce(nextp,''),700) dima_next
  from (select * from (select * from p where length(reply)>300 and nextp is not null) using sample $sample rows (reservoir, 42)) order by t) to '$out/reply-sample.jsonl';"
rm "$turns"
