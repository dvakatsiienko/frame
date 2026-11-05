#!/usr/bin/python3
# 20 Hz: per-thread cpu ticks + wait channel for the game; prints when the frame thread stops advancing, and when this loop itself overslept
import os,sys,time,glob
dur=float(sys.argv[1]); out=open(sys.argv[2],'w',buffering=1)
pid=None
for p in glob.glob('/proc/[0-9]*/comm'):
    try:
        if open(p).read().strip()=='GTAIV.exe': pid=p.split('/')[2]; break
    except OSError: pass
if not pid: print('no game'); sys.exit(1)
print('pid',pid,file=out)
def snap():
    r={}
    for t in os.listdir(f'/proc/{pid}/task'):
        b=f'/proc/{pid}/task/{t}/'
        try:
            s=open(b+'stat').read(); c=s[s.index('(')+1:s.rindex(')')]; f=s[s.rindex(')')+2:].split()
            w=open(b+'wchan').read().strip(); sc=open(b+'syscall').read().split()[0]
            r[t]=(c,f[0],int(f[11])+int(f[12]),w,sc)
        except (OSError,ValueError,IndexError): pass
    return r
last=time.monotonic(); end=last+dur; ft=None; lastadv=last; prev=snap(); inside=False; hist=[]
while time.monotonic()<end:
    time.sleep(0.05)
    now=time.monotonic(); over=now-last-0.05; last=now
    cur=snap()
    fr=[v for v in cur.values() if v[0]=='dxvk-frame']
    if fr and fr[0][2]!=ft: ft=fr[0][2]; adv=True; lastadv=now
    else: adv=False
    stamp=time.strftime('%H:%M:%S')+f'.{int(time.time()*1000)%1000:03d}'
    if over>0.08: print(f'{stamp} OVERSLEPT {over*1000:.0f}ms',file=out)
    if now-lastadv>0.2 and not inside:
        inside=True
    if inside:
        rows=[f"{v[0]}:{v[1]}:{v[2]-prev.get(t,v)[2]}:{v[3]}:{v[4]}" for t,v in cur.items() if v[0] in('GTAIV.exe','dxvk-cs','dxvk-frame','dxvk-submit','dxvk-queue','vn_wsi[0,0]') or v[2]-prev.get(t,v)[2]>0]
        print(stamp,'STALL',round(now-lastadv,2),' '.join(rows)[:900],file=out)
        if now-lastadv<=0.05: inside=False; print(stamp,'END',file=out)
    prev=cur
print('done',file=out)
