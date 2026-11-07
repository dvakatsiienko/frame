#!/bin/bash
export LANG=en_US.UTF-8
clt_git=/Library/Developer/CommandLineTools/usr/bin/git

images() {
    DYLD_PRINT_LIBRARIES=1 "$@" --version 2>&1 | grep -c 'dyld\['
}

echo "images brew git: $(images /opt/homebrew/bin/git)"
echo "images clt git: $(images "$clt_git")"
echo "images rg: $(images /opt/homebrew/bin/rg)"
/opt/homebrew/bin/git --version
"$clt_git" --version

curl -fsS -m 25 https://raw.githubusercontent.com/git/git/master/config.mak.uname | grep -n 'framework CoreServices\|FSMONITOR_DAEMON_BACKEND = darwin' | cut -c1-120
echo "gnulib:"
curl -fsSL -m 25 'https://lists.endsoftwarepatents.org/archive/html/bug-gnulib/2026-11/msg00035.html' | sed 's/<[^>]*>//g' | grep -n -i 'CFLocaleCopyPreferredLanguages\|5,\?004\|Subject' | head -n 6 | cut -c1-240
echo "fastexec:"
curl -fsSL -m 25 'https://pkg.go.dev/github.com/zchee/fastexec' | sed 's/<[^>]*>//g' | grep -n -i 'posix_spawn\|1\.397\|2\.469\|cgo' | head -n 8 | cut -c1-200
echo "codex urls:"
jq -r '.. | .url? // empty' "$(dirname "$0")/lanes/parallel.json" | grep -i 'codex\|openai' | sort -u | head -n 5

echo "sandbox control:"
python3 -I - <<'PY'
import ctypes, subprocess
c = ctypes.CDLL(None)
out = subprocess.run(['ps', '-axo', 'pid=,comm='], capture_output=True, text=True).stdout
wanted = ('WebContent', 'QuickLook', 'Claude Helper', 'Google Chrome Helper', 'Rex', 'cfprefsd', 'syspolicyd', 'Finder', 'mdworker')
seen = set()
for line in out.splitlines():
    pid, _, comm = line.strip().partition(' ')
    name = comm.rsplit('/', 1)[-1]
    for w in wanted:
        if w in name and name not in seen:
            seen.add(name)
            print(c.sandbox_check(int(pid), None, 0), name)
PY
