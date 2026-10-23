#!/usr/bin/env python3
"""«…» quotes (≥3 chars) and lines attributed to dima («dima, <date>») present at a git rev but gone from the working tree, per file.
usage: quote-diff.py [<rev>] <file>… — exit 0 none gone, 1 some gone, 2 a file could not be checked."""
import os, re, subprocess, sys

def git(*a, cwd=None):
    return subprocess.run(["git", *a], capture_output=True, text=True, cwd=cwd)

args = sys.argv[1:]
if not args:
    sys.exit("usage: quote-diff.py [<rev>] <file>…")
rev = "HEAD"
if len(args) > 1 and not os.path.exists(args[0]) and git("rev-parse", "--verify", "--quiet", args[0] + "^{commit}").returncode == 0:
    rev, args = args[0], args[1:]

q = re.compile(r"«[^»]{3,}»")
norm = lambda s: re.sub(r"\s+", " ", s)
gone = failed = 0
for f in args:
    real = os.path.realpath(os.path.expanduser(f))
    d = os.path.dirname(real)
    top = git("rev-parse", "--show-toplevel", cwd=d).stdout.strip()
    if not top:
        print(f"✗ {f}: not inside a git repo — not checked"); failed += 1; continue
    rel = os.path.relpath(real, top)
    shown = git("show", f"{rev}:{rel}", cwd=top)
    if shown.returncode != 0:
        print(f"✗ {f}: not in {rev} ({rel}) — not checked"); failed += 1; continue
    new = norm(open(real).read()) if os.path.exists(real) else ""
    for line in shown.stdout.splitlines():
        if re.search(r"\bdima,? \d{4}-\d{2}-\d{2}", line, re.I) and norm(line.strip()) and norm(line.strip())[:60] not in new:
            gone += 1
            print(f"{f}: [his line] {line.strip()[:160]}")
    for m in sorted(set(q.findall(shown.stdout))):
        if norm(m) not in new:
            gone += 1
            print(f"{f}: {m[:160]}")
print(f"{gone} quote(s) gone · {len(args) - failed} file(s) checked · {failed} not checked")
sys.exit(2 if failed else (1 if gone else 0))
