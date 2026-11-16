# the empty-wakes count: machine wakes of one clio transcript, classed by what the turn after did
# usage: python3 -I script/empty-wakes-count.py <transcript.jsonl> <since, ISO UTC like 2026-11-09T00:00>
# run per clio transcript of the week at the Monday boot; append one row to docs/test-drive/gate-speed/empty-wakes.md
# the rules and their first round: docs/test-drive/gate-speed/empty-wakes.md § 2026-11-16 round
import json,re,collections,sys
F=sys.argv[1]
SINCE=sys.argv[2]
seen=set();recs=[]
for l in open(F):
    r=json.loads(l)
    if r.get('type') not in('user','assistant'):continue
    if r.get('timestamp','')<SINCE:continue
    u=r.get('uuid')
    if u in seen:continue
    seen.add(u);recs.append(r)
def txt(r):
    c=r['message']['content']
    if isinstance(c,str):return c,False
    t=[b.get('text','') for b in c if b.get('type')=='text']
    tr=any(b.get('type')=='tool_result' for b in c)
    return '\n'.join(t),tr
def cls(t):
    if 'Cross-session idle notice' in t:return 'c'
    if 'Another Claude session sent a message' in t or '<cross-session-message' in t:return 'b'
    if t.lstrip().startswith('<task-notification'):return 'd'
    s=re.sub(r'<system-reminder>.*?</system-reminder>','',t,flags=re.S).strip()
    if t.startswith('The x-mod-stash plugin sent a message'):return 'p'
    if '<command-name>' in t and '/compact' not in t:return 'k'
    if ('Stop hook feedback' in t or not s or t.startswith(('Base directory for this skill','This session is being continued','<local-command','[Request interrupted','[Image: ')) or '<command-name>/compact' in t):return 'e'
    return 'a'
W=['Edit','Write','NotebookEdit','Agent','Workflow','SendMessage','TaskCreate','TaskUpdate','TaskStop']
RO=re.compile(r'^\s*(?:(?:(?:cd|export)\s+[^;&|]*|\w+=\S+|\w+=\$\([^)]*\))\s*(?:&&|;)\s*)*(ls|cat|head|tail|wc|grep|rg|jq|find|stat|file|pwd|echo|date|sleep|git\s+(status|log|diff|show|branch|rev-parse|ls-files|blame)|x\s+(linear\s+read|read|list|peek|status)|hc\s+(list|read|screen|get|status|ps|peek)|which|test|duckdb|sed\s+-n|awk|tree|du|df|ps|pgrep|readlink|realpath|diff|sort|uniq|cut|tr|basename|dirname|printf)\b')
WR=re.compile(r'(>>?\s*[^&\s|]|\btee\b|\brm\b|\bmv\b|\bcp\b|\bmkdir\b|\bgit\s+(commit|push|add|checkout|reset|merge|rebase|stash)|sed\s+-i|\bkill\b|\btouch\b|-i\b.*sed)')
def writes(b):
    n=b.get('name','');i=b.get('input',{})
    if n in W:return True
    if n.startswith('mcp__'):
        return not re.search(r'(read|get|list|search|peek|status|view|fetch|query)',n,re.I)
    if n=='Bash':
        c=i.get('command','')
        if not RO.match(c):return True
        c2=re.sub(r'2>&1|2>/dev/null|>\s*/dev/null|&>\s*/dev/null','',c)
        return bool(WR.search(c2))
    return False
starts=[]
for k,r in enumerate(recs):
    if r['type']!='user':continue
    t,tr=txt(r)
    if not t.strip():continue   # pure tool_result
    starts.append((k,cls(t),t))
cnt=collections.Counter(c for _,c,_ in starts);print('starts',cnt)
inj=sum(txt(r)[0].count('dima wrote this in herdr while you worked')+ (json.dumps(r['message']['content']).count('dima wrote this in herdr while you worked') if not txt(r)[0] else 0) for r in recs if r['type']=='user')
inj2=sum(1 for r in recs if 'dima wrote this in herdr while you worked' in json.dumps(r))
print('inj user-records',sum(1 for r in recs if r['type']=='user' and 'dima wrote this in herdr while you worked' in json.dumps(r)),'all',inj2)
def tag(t):
    m=re.search(r'<cross-session-message[^>]*>\s*(.*)',t,re.S)
    b=m.group(1).strip() if m else t
    m2=re.match(r'\[(\w+)\]',b)
    if m2:return m2.group(1).lower()
    bl=b[:80].lower()
    for w in('final','clean','round'):
        if bl.startswith(w):return w
    return 'untagged'
def sender(t):
    m=re.search(r'from-name="([^"]*)"',t);return re.sub(r'^⚡ ','',m.group(1)) if m else '?'
tags=collections.Counter();snd=collections.Counter()
res={}
dn=collections.Counter()
for i,(k,c,t) in enumerate(starts):
    if c=='b':tags[tag(t)]+=1;snd[sender(t)]+=1
    if c not in'bcd':continue
    end=starts[i+1][0] if i+1<len(starts) else len(recs)
    asst=[r for r in recs[k+1:end] if r['type']=='assistant']
    w=False;ft=''
    for r in asst:
        for b in r['message']['content']:
            if b.get('type')=='tool_use' and writes(b):w=True
            if b.get('type')=='text' and b['text'].strip():ft=b['text'].strip()
    # final text = last text block of last assistant record having text
    o='acted' if w else ('replied only' if len(ft)>=200 else 'did nothing')
    res[(c,o)]=res.get((c,o),0)+1
    if o=='did nothing':dn[sender(t) if c=='b' else ('idle' if c=='c' else 'task-notif')]+=1
print('tags',tags);print('senders',snd);print(sorted(res.items()));print('dn',dn)
if '--detail' not in sys.argv:sys.exit(0)
# b by tag x outcome
import itertools
bt=collections.Counter()
for i,(k,c,t) in enumerate(starts):
    pass

print('multi',[t.count('Another Claude session sent a message') for k,c,t in starts if c=='b' and t.count('Another Claude session sent a message')>1])
att=set()
for l in open(F):
    r=json.loads(l)
    if r.get('type')=='attachment' and r.get('timestamp','')>='2026-11-16T06:00' and 'dima wrote this in herdr while you worked' in json.dumps(r.get('attachment')):att.add(r['uuid'])
print('inj attach',len(att))
bo=collections.Counter()
for i,(k,c,t) in enumerate(starts):
    if c!='b':continue
    end=starts[i+1][0] if i+1<len(starts) else len(recs)
    tools=collections.Counter();w=False;ft=''
    for r in recs[k+1:end]:
        if r['type']!='assistant':continue
        for b in r['message']['content']:
            if b.get('type')=='tool_use':
                tools[b['name']]+=1;w|=writes(b)
            if b.get('type')=='text' and b['text'].strip():ft=b['text'].strip()
    print(sender(t),tag(t),'W' if w else '-',len(ft),dict(tools))
print('=====')
for i,(k,c,t) in enumerate(starts):
    if c not in 'bd':continue
    end=starts[i+1][0] if i+1<len(starts) else len(recs)
    ws=[b for r in recs[k+1:end] if r['type']=='assistant' for b in r['message']['content'] if b.get('type')=='tool_use' and writes(b)]
    if ws and all(b['name']=='Bash' for b in ws):
        print(c,[b['input']['command'][:70].replace('\n',' ') for b in ws][:3])
print('#####')
n=0
for i,(k,c,t) in enumerate(starts):
    if c!='d':continue
    end=starts[i+1][0] if i+1<len(starts) else len(recs)
    ws=[b for r in recs[k+1:end] if r['type']=='assistant' for b in r['message']['content'] if b.get('type')=='tool_use' and writes(b)]
    if ws and all(b['name']=='Bash' for b in ws) and n<2:
        n+=1
        for b in ws[:3]:print(b['input']['command'][:400].replace('\n',' | '));print()
