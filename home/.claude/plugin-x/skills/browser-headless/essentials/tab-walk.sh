#!/usr/bin/env bash
# walks the current page with real Tab presses and prints only the flagged stops.
# usage: tab-walk.sh [--max N] [--deny <css selector>] [--list]
#   --deny  stops matching this selector are flagged (an app's own opt-outs, e.g. '[role=separator]')
#   --list  also prints every stop in order
# needs AGENT_BROWSER_SESSION set to a session that already has the page open.
set -euo pipefail

max=200
deny=''
list=0
while [ $# -gt 0 ]; do
  case "$1" in
    --max) max="$2"; shift 2 ;;
    --deny) deny="$2"; shift 2 ;;
    --list) list=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

read -r -d '' probe <<'JS' || true
(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return JSON.stringify({ body: true });
  if (!el.dataset.tabWalk) el.dataset.tabWalk = String(document.querySelectorAll('[data-tab-walk]').length + 1);
  const r = el.getBoundingClientRect();
  // position in content coordinates: a stop further down an inner scroll box never reads as a jump back up
  let sx = scrollX, sy = scrollY;
  for (let p = el.parentElement; p; p = p.parentElement) { sx += p.scrollLeft; sy += p.scrollTop; }
  const cs = getComputedStyle(el);
  const text = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30);
  const slot = el.getAttribute('data-slot');
  const composite = el.parentElement && el.parentElement.closest('[role=radiogroup], [role=toolbar], [role=tablist], [role=listbox], [role=menu], [role=grid], [data-slot=toggle-group]');
  if (composite && !composite.dataset.tabWalkGroup) composite.dataset.tabWalkGroup = String(document.querySelectorAll('[data-tab-walk-group]').length + 1);
  return JSON.stringify({
    id: el.dataset.tabWalk,
    name: `${el.tagName.toLowerCase()}${slot ? `[${slot}]` : ''}${el.getAttribute('role') ? ` role=${el.getAttribute('role')}` : ''}${text ? ` «${text}»` : ''}`,
    x: Math.round(r.left + sx), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height),
    hidden: cs.visibility === 'hidden' || Number(cs.opacity) === 0 || !!el.closest('[aria-hidden=true], [inert]'),
    ring: el.matches(':focus-visible') && (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none'),
    group: composite ? composite.dataset.tabWalkGroup : null,
    denied: DENY ? el.matches(DENY) : false,
    cut: (() => {
      // the ring at this stop: clipped by a box that hides overflow, or painted over by a neighbour
      const outlineW = cs.outlineStyle === 'none' ? 0 : (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0);
      const spreadW = [...cs.boxShadow.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?!\s*inset)/g)].reduce((m, x) => Math.max(m, parseFloat(x[4])), 0);
      const ringW = Math.max(outlineW, spreadW);
      if (!ringW) return [];
      const out = [];
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const b = p.getBoundingClientRect();
        const gap = { top: r.top - ringW - b.top, bottom: b.bottom - r.bottom - ringW, left: r.left - ringW - b.left, right: b.right - r.right - ringW };
        for (const [side, v] of Object.entries(gap)) if (v < 0 && v >= -ringW) out.push(`${side} clipped ${v.toFixed(1)}`);
      }
      const d = ringW / 2;
      const pts = { top: [r.left + r.width / 2, r.top - d], bottom: [r.left + r.width / 2, r.bottom + d], left: [r.left - d, r.top + r.height / 2], right: [r.right + d, r.top + r.height / 2] };
      for (const [side, [x, y]] of Object.entries(pts)) {
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        // a ring paints above static neighbours; only a positioned layer (a scrollbar, sticky chrome, an overlay) can cover it
        const layered = (n) => { for (let q = n; q && q !== document.body; q = q.parentElement) { if (q.contains(el)) return false; if (getComputedStyle(q).position !== 'static') return true; } return false; };
        if (hit && hit !== el && !hit.contains(el) && !el.contains(hit) && layered(hit)) out.push(`${side} painted over by ${hit.tagName.toLowerCase()}${hit.getAttribute('data-slot') ? `[${hit.getAttribute('data-slot')}]` : ''}`);
      }
      return out;
    })(),
  });
})()
JS
probe="${probe//DENY/$(printf '%s' "$deny" | jq -Rs .)}"

agent-browser eval "(() => { document.activeElement?.blur(); document.querySelectorAll('[data-tab-walk], [data-tab-walk-group]').forEach((e) => { delete e.dataset.tabWalk; delete e.dataset.tabWalkGroup; }); return 1; })()" >/dev/null

stops=()
first=''
for ((i = 1; i <= max; i++)); do
  agent-browser press Tab >/dev/null
  stop=$(agent-browser eval "$probe" | jq -r .)
  if [ "$(jq -r '.body // false' <<<"$stop")" = true ]; then break; fi
  id=$(jq -r .id <<<"$stop")
  [ -z "$first" ] && first="$id"
  if [ "$id" = "$first" ] && [ ${#stops[@]} -gt 0 ]; then break; fi
  stops+=("$stop")
done

printf '%s\n' "${stops[@]}" | jq -s --argjson list "$list" --argjson max "$max" '
  . as $s
  | [ range(0; length) as $i | $s[$i] + { n: ($i + 1), prev: (if $i > 0 then $s[$i - 1] else null end) } ] as $t
  | {
      stops: length,
      capped: (length >= $max),
      flags: [
        ($t[] | select(.w == 0 or .h == 0) | "\(.n) \(.name): zero size"),
        ($t[] | select(.hidden) | "\(.n) \(.name): invisible or inside aria-hidden/inert"),
        ($t[] | select(.ring | not) | "\(.n) \(.name): no visible focus ring"),
        ($t[] | select(.denied) | "\(.n) \(.name): matches the app'"'"'s deny list"),
        ($t[] | select((.cut // []) | length > 0) | "\(.n) \(.name): ring \(.cut | join(", "))"),
        ($t | group_by(.id)[] | select(length > 1) | "\(.[0].name): repeats at stops \(map(.n) | join(", "))"),
        ($t[] | select(.prev != null and .y < .prev.y - 40 and .x < .prev.x - 40) | "\(.n) \(.name): jumps back up and left from \(.prev.name)"),
        ($t | map(select(.group != null)) | group_by(.group)[] | select(length > 1) | "\(.[0].name) and \(length - 1) more: \(length) stops inside one group, wants 1")
      ]
    }
  + (if $list == 1 then { order: [ $t[] | "\(.n) \(.name)" ] } else {} end)'
