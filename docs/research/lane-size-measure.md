---
dies-when: the 2026-12-12 re-run decides the sizing (keep XS/S/M as plan words, reshape, or drop the numbers)
---

# lane size — what a codie lane costs per ticket size

Ticket: none

wish: dima, 2026-11-12 19:11 — re-run the same measurement in 30 days, with more XS and M lanes, and decide then

## what we saw, 2026-11-12 (31 tickets, 38 codie sessions, the 14 days before)

- a step is one assistant line; a prompt is a user line that is not a tool result; sessions of one ticket are summed
- S (17): steps median 1357, p75 2037, p90 5881, max 8214; prompts median 112, p75 224, max 342
- M (9): steps median 1531, p75 2056, p90 2655, max 3458; prompts median 139, p75 192, max 234
- XS: 1 ticket only (FRM-513, 1695 steps), so XS is unmeasured
- all tickets: steps median 1476, p90 4711
- the verdict: S and M overlap and S holds the biggest outliers, so a size does not predict the work; the guessed «XS under ~80 turns, S under ~400» was replaced in `clio:pm` by these medians, and the 1.5× size alarm was dropped (his o40)

## how to run it again

1. one `helper` card, the brief: count per codie session (title with 🔧, not 🔎, first line in the last 14 days) its steps, tool calls, prompts and wall minutes; join each ticket id to its `x linear read` estimate; sum per ticket; print per size n, median, p75, p90, max
2. the queries below run in `~/.claude/projects` with duckdb
3. compare with the numbers above; if XS and M now have 5+ tickets each, decide: keep the sizes as plan words, reshape them, or measure what does predict work (files touched, exit lines)

## the queries, as run
Step 1, per session (`duckdb -json < sess.sql > sess.json`, run in ~/.claude/projects):
```sql
with l as (
  select *, row_number() over () as rn,
    case when type='assistant' then coalesce(len(list_filter(from_json(message->'content','["JSON"]'), lambda x: x->>'type'='tool_use')),0) end as tools,
    case when type='user' then (case when json_type(message->'content')='ARRAY'
      then len(list_filter(from_json(message->'content','["JSON"]'), lambda x: x->>'type'<>'tool_result'))>0
      else true end) end as is_prompt
  from read_json('*/*.jsonl', format='newline_delimited', ignore_errors=true,
    columns={type:'VARCHAR', timestamp:'VARCHAR', sessionId:'VARCHAR', customTitle:'VARCHAR', message:'JSON'})
)
select sessionId, arg_max(customTitle, rn) filter (where customTitle is not null) as title,
  min(timestamp::timestamptz) as t0, max(timestamp::timestamptz) as t1,
  count(*) filter (where type='assistant') as steps,
  coalesce(sum(tools),0) as tools,
  count(*) filter (where is_prompt) as prompts
from l group by sessionId
having title like '%🔧%' and title not like '%🔎%' and t0 >= now() - interval 14 day
```
Step 2: `x linear read <30 ids>` -> `.data.tickets[]` {id, estimate} into est.jsonl (estimate 1..5 -> XS..XL, null -> unsized).
Step 3, per ticket and per size (sess.json + est.jsonl):
```sql
create temp table s as select *, regexp_extract(title,'[A-Z]{2,5}-[0-9]+') as tid, tools::bigint as tc from read_json('sess.json');
create temp table e as select id, estimate from read_json('est.jsonl', format='newline_delimited');
create temp table t as
select s.tid as id,
  coalesce(case e.estimate when 1 then 'XS' when 2 then 'S' when 3 then 'M' when 4 then 'L' when 5 then 'XL' end,'unsized') as size,
  count(*) as sessions, sum(steps) as steps, sum(tc) as tool_calls, sum(prompts) as prompts,
  round(sum(date_diff('second', t0::timestamptz, t1::timestamptz))/60.0) as wall_min
from s left join e on e.id=s.tid where s.tid <> '' group by all;
.mode markdown
select size, count(*) n,
  median(steps) steps_med, round(quantile_cont(steps,0.75)) steps_p75, round(quantile_cont(steps,0.9)) steps_p90, max(steps) steps_max,
  median(tool_calls) tc_med, round(quantile_cont(tool_calls,0.75)) tc_p75, round(quantile_cont(tool_calls,0.9)) tc_p90, max(tool_calls) tc_max
from t group by size order by size='unsized', size desc;
select * from t order by case size when 'XS' then 0 when 'S' then 1 when 'M' then 2 else 3 end, id;
select count(*) filter (where tid='') no_id, count(*) sessions from s;
```

## 4. Unsettled
- 1 session with no ticket id (title «codie: probe | mods»): skipped.
- PK-363 (two sessions, «herdr lane», «mods lane»): `x linear read PK-363` says Entity not found, so counted as unsized; likely a mistyped id.
- BYT-132, FRM-514, FRM-572 have a null estimate: unsized.
- XS has one ticket (FRM-513), so its percentiles are that one value; no L or XL tickets.
- Last title taken by row order (`row_number() over ()`; title lines carry no timestamp); assumes duckdb keeps file order.
- «steps» counts every assistant line (one per content block), far above the handbook's «turns» (XS<80, S<400); prompts are the closer match to that scale, but S p75 is already 224 and max 342, M overlaps S: size barely separates the work.
