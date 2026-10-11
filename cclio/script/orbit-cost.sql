-- orbit + phases cost in one cc transcript: tokens written, and tokens re-read on every later request until the next compaction
create temp table raw as
select rn, j from (
  select row_number() over () as rn, j::json as j
  from read_csv(getenv('T'), columns={'j':'VARCHAR'}, delim=chr(1), quote='', escape='', header=false, max_line_size=200000000))
qualify json_extract_string(j,'$.uuid') is null
     or row_number() over (partition by json_extract_string(j,'$.uuid') order by rn) = 1;

create temp table req as
select json_extract_string(j,'$.message.id') as mid, min(rn) as rn,
       max((json_extract_string(j,'$.message.usage.output_tokens'))::bigint) as out_tok,
       max((json_extract_string(j,'$.message.usage.cache_read_input_tokens'))::bigint
         + (json_extract_string(j,'$.message.usage.cache_creation_input_tokens'))::bigint
         + (json_extract_string(j,'$.message.usage.input_tokens'))::bigint) as ctx
from raw where json_extract_string(j,'$.type')='assistant' and json_extract_string(j,'$.message.id') is not null and not coalesce((json_extract_string(j,'$.isSidechain'))::bool,false)
group by 1;

create temp table cmp as
select rn from raw where json_extract_string(j,'$.type')='system' and json_extract_string(j,'$.subtype')='compact_boundary';

-- assistant tool_use blocks
create temp table tu as
select r.rn, json_extract_string(b,'$.id') as id, json_extract_string(b,'$.input.op') as op, length((json_extract(b,'$.input'))::varchar) as chars
from raw r, unnest(from_json(json_extract(r.j,'$.message.content'),'["json"]')) as t(b)
where json_extract_string(r.j,'$.type')='assistant' and json_type(json_extract(r.j,'$.message.content'))='ARRAY'
  and json_extract_string(b,'$.type')='tool_use' and json_extract_string(b,'$.name') like '%x-mod-stash__orbit';

-- their results
create temp table tr as
select min(r.rn) as rn, any_value(tu.op) as op, any_value(length((json_extract(b,'$.content'))::varchar)) as chars
from raw r, unnest(from_json(json_extract(r.j,'$.message.content'),'["json"]')) as t(b)
join tu on tu.id = json_extract_string(b,'$.tool_use_id')
where json_extract_string(r.j,'$.type')='user' and json_type(json_extract(r.j,'$.message.content'))='ARRAY' and json_extract_string(b,'$.type')='tool_result'
group by json_extract_string(b,'$.tool_use_id');

-- hook injections, per element
create temp table hk as
select r.rn, e as txt, length(e) as chars
from raw r, unnest(from_json(json_extract(r.j,'$.attachment.content'),'["varchar"]')) as t(e)
where json_extract_string(r.j,'$.attachment.type')='hook_additional_context' and json_type(json_extract(r.j,'$.attachment.content'))='ARRAY';

create temp table blocks as
select rn, 'call · '||coalesce(op,'?') as kind, chars from tu
union all select rn, 'result · '||coalesce(op,'?'), chars from tr
union all select rn,
  case when txt like 'phases not set%' or txt like '%no phases yet%' then 'hook · phases nudge'
       when txt like 'orbit holds no open ask%' then 'hook · orbit status line'
       when txt like 'orbit: dima marked%' then 'hook · his ticks delivered'
       else null end, chars
from hk;

create temp table priced as
select b.kind, b.chars,
  (select count(*) from req q where q.rn > b.rn
     and q.rn < coalesce((select min(c.rn) from cmp c where c.rn > b.rn), 9e18)) as rereads
from blocks b where b.kind is not null;

.mode markdown
select (select count(*) from req) as requests, (select count(*) from cmp) as compactions,
       (select sum(out_tok) from req) as out_tok, (select sum(ctx) from req) as ctx_tok_read;
select kind, count(*) n, sum(chars) chars, sum(chars*rereads) as char_rereads
from priced group by 1 order by char_rereads desc;
select sum(chars) chars, sum(chars*rereads) char_rereads from priced where kind not like 'hook · his ticks%';
select sum(chars) chars, sum(chars*rereads) char_rereads from priced where kind like '%plan%' or kind like '%phases%';
