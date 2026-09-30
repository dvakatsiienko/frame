#!/usr/bin/env python3
"""notion lane of the notes-stack bench (DOT-228).

same op shapes as run.sh's fs/cli lanes, so the numbers compare.
needs NOTION_API_TOKEN in env and one page shared with the integration.
  usage: python3 notion_lane.py <parent-page-title> [n_children]
"""
import os, sys, json, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

API = "https://api.notion.com/v1"
TOK = os.environ["NOTION_API_TOKEN"]
CONC = 4  # notion throttles real write traffic; see the report

RETRIES = {"n": 0}
BYTES = {"out": 0}
def call(path, method="GET", body=None, ver="2022-06-28", tries=6):
    for a in range(tries):
        req = urllib.request.Request(
            API + path, method=method,
            data=json.dumps(body).encode() if body else None,
            headers={"Authorization": "Bearer " + TOK, "Notion-Version": ver,
                     "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as r:
                raw = r.read(); BYTES["out"] += len(raw)
                return r.status, json.loads(raw)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                RETRIES["n"] += 1
                time.sleep(float(e.headers.get("Retry-After") or 2 ** a)); continue
            try: return e.code, json.load(e)
            except Exception: return e.code, {}
    return 429, {}

def title_of(o):
    for v in o.get("properties", {}).values():
        if v.get("type") == "title":
            return "".join(x.get("plain_text", "") for x in v["title"])
    return "".join(x.get("plain_text", "") for x in o.get("title", []))

def timed(label, n, fn):
    b0 = BYTES["out"]; t0 = time.time(); out = fn(); el = (time.time() - t0)
    print(f"{label:<24} {el*1000:7.0f} ms  n={n:<4} {n/max(el,1e-9)*60:8.0f} ops/min  out={BYTES['out']-b0} bytes")
    return out, el

def par(fn, items):
    with ThreadPoolExecutor(max_workers=CONC) as ex:
        return list(ex.map(fn, items))

def main():
    parent_title = sys.argv[1] if len(sys.argv) > 1 else "bench-notes-stack"
    N = int(sys.argv[2]) if len(sys.argv) > 2 else 60

    s, d = call("/search", "POST", {"query": parent_title, "page_size": 100})
    hits = [o for o in d.get("results", []) if title_of(o) == parent_title and o["object"] == "page"]
    if not hits:
        print(f"!! parent page {parent_title!r} not visible to the integration"); sys.exit(1)
    PARENT = hits[0]["id"]
    print(f"parent: {PARENT}  {parent_title!r}\nconcurrency: {CONC}  children: {N}\n")

    # ---------- seed ----------
    def mk_hub():
        return call("/pages", "POST", {
            "parent": {"page_id": PARENT},
            "properties": {"title": {"title": [{"text": {"content": "Hub Target"}}]}},
            "children": [
                {"paragraph": {"rich_text": [{"text": {"content": "Anchor paragraph one."}}]}},
                {"heading_2": {"rich_text": [{"text": {"content": "Section A"}}]}},
                {"paragraph": {"rich_text": [{"text": {"content": "Content under section A."}}]}},
            ]})[1]
    hub = mk_hub(); HUB = hub["id"]
    print(f"hub page: {HUB}")

    def mk_child(i):
        # every child carries a REAL page-id reference to the hub (a mention)
        return call("/pages", "POST", {
            "parent": {"page_id": PARENT},
            "properties": {"title": {"title": [{"text": {"content": f"note-{i:04d}"}}]}},
            "children": [
                {"paragraph": {"rich_text": [
                    {"text": {"content": "Link to "}},
                    {"mention": {"page": {"id": HUB}}},
                    {"text": {"content": " — a page-id reference."}}]}},
                {"paragraph": {"rich_text": [{"text": {"content": "Body line filler. " * 12}}]}},
            ]})[1]

    (kids, _) = timed("seed children", N, lambda: par(mk_child, range(1, N + 1)))
    ids = [k["id"] for k in kids if "id" in k]
    print(f"created {len(ids)}/{N}\n")

    B = min(50, len(ids)); batch = ids[:B]

    # ---------- op1 read (markdown api) ----------
    timed("op1 read (markdown)", B,
          lambda: par(lambda i: call(f"/pages/{i}/markdown", ver="2026-03-11"), batch))

    # ---------- op2 append (markdown insert) ----------
    def append(i):
        return call(f"/pages/{i}/markdown", "PATCH",
                    {"type": "insert_content",
                     "insert_content": {"content": "\nappended by bench\n",
                                        "position": {"type": "end"}}}, ver="2026-03-11")
    r2, _ = timed("op2 append (markdown)", B, lambda: par(append, batch))
    codes2 = {}
    for c, _b in r2: codes2[c] = codes2.get(c, 0) + 1
    print(f"   op2 status codes: {codes2}")
    if 200 not in codes2:
        sample = [b for c, b in r2 if c != 200][:1]
        print(f"   op2 error sample: {json.dumps(sample[0])[:200] if sample else ''}")

    # ---------- op3 title update (notion's nearest thing to frontmatter) ----------
    def settitle(i):
        return call(f"/pages/{i}", "PATCH",
                    {"properties": {"title": {"title": [{"text": {"content": "benched"}}]}}})
    timed("op3 title update", B, lambda: par(settitle, batch))

    # ---------- op4 THE RENAME ----------
    r4, _ = timed("op4 rename hub", 1, lambda: call(
        f"/pages/{HUB}", "PATCH",
        {"properties": {"title": {"title": [{"text": {"content": "Hub Renamed"}}]}}}))

    # correctness: are the references still pointing at the hub, and do they render the new title?
    def check(i):
        s, d = call(f"/blocks/{i}/children?page_size=10")
        for b in d.get("results", []):
            for rt in b.get("paragraph", {}).get("rich_text", []):
                m = rt.get("mention", {})
                if m.get("type") == "page":
                    return m["page"]["id"].replace("-", ""), rt.get("plain_text", "")
        return None, None
    checks = par(check, batch)
    hubn = HUB.replace("-", "")
    intact = sum(1 for pid, _ in checks if pid == hubn)
    renders_new = sum(1 for _, txt in checks if txt and "Hub Renamed" in txt)
    renders_old = sum(1 for _, txt in checks if txt and "Hub Target" in txt)

    # ---------- op5 search ----------
    timed("op5 search", 1, lambda: call("/search", "POST", {"query": "note-", "page_size": 100}))

    print("\n--- correctness after rename ---")
    print(f"references still resolving to the hub page-id : {intact}/{B}")
    print(f"references rendering the NEW title            : {renders_new}/{B}")
    print(f"references rendering the OLD title            : {renders_old}/{B}")
    print(f"pages rewritten to achieve this               : 0  (only the hub was PATCHed)")

    # ---------- the <unknown> data-loss test ----------
    print("\n--- markdown round-trip: does a bookmark block survive PATCH-replace? ---")
    s, dp = call("/pages", "POST", {
        "parent": {"page_id": PARENT},
        "properties": {"title": {"title": [{"text": {"content": "roundtrip-probe"}}]}},
        "children": [
            {"paragraph": {"rich_text": [{"text": {"content": "before"}}]}},
            {"bookmark": {"url": "https://obsidian.md"}},
            {"paragraph": {"rich_text": [{"text": {"content": "after"}}]}},
        ]})
    probe = dp.get("id")
    if probe:
        s, md = call(f"/pages/{probe}/markdown", ver="2026-03-11")
        body = md.get("markdown", "")
        print(f"  markdown contains '<unknown>': {'<unknown>' in body}")
        print(f"  unknown_block_ids returned  : {md.get('unknown_block_ids')}")
        print(f"  truncated                   : {md.get('truncated')}")
        print(f"  raw: {body[:200]!r}")
        s, rr = call(f"/pages/{probe}/markdown", "PATCH",
                     {"type": "replace_content",
                      "replace_content": {"new_str": body}}, ver="2026-03-11")
        print(f"  PATCH replace_content status: {s} {rr.get('code','')} {(rr.get('message') or '')[:120]}")
        s, bl = call(f"/blocks/{probe}/children?page_size=20")
        kinds = [b["type"] for b in bl.get("results", [])]
        print(f"  block types after replace: {kinds}")
        print(f"  bookmark survived: {'bookmark' in kinds}")
        call(f"/blocks/{probe}", "DELETE")

    # ---------- teardown ----------
    print("\n--- teardown ---")
    victims = ids + [HUB]
    t0 = time.time()
    res = par(lambda i: call(f"/blocks/{i}", "DELETE")[0], victims)
    print(f"deleted {sum(1 for c in res if c == 200)}/{len(victims)} pages in {time.time()-t0:.2f}s")
    s, d = call(f"/blocks/{PARENT}/children?page_size=100")
    live = [b for b in d.get("results", []) if not b.get("archived")]
    print(f"parent page kept; live children remaining: {len(live)}")
    print(f"429 retries absorbed during the run: {RETRIES['n']}")

if __name__ == "__main__":
    main()
