#!/bin/bash
# builds a git with no gettext and no CoreServices into the lane's state dir, never on PATH
set -e
export LANG=en_US.UTF-8
root="$HOME/.local/state/x/lanes/frm-525/slim-git"
mkdir -p "$root"
cd "$root"
[ -d src ] || git clone --quiet --depth 1 --branch v2.56.0 https://github.com/git/git.git src
cd src
sed -i '' -e '/framework CoreServices/d' -e '/FSMONITOR_DAEMON_BACKEND = darwin/d' -e '/FSMONITOR_OS_SETTINGS = unix/d' config.mak.uname
grep -n 'framework\|FSMONITOR' config.mak.uname || true
make -j4 prefix="$root/out" NO_RUST=1 NO_GETTEXT=1 NO_TCLTK=1 NO_PERL=1 NO_PYTHON=1 NO_EXPAT=1 INSTALL_SYMLINKS=1 install >"$root/build.log" 2>&1
tail -n 2 "$root/build.log" | cut -c1-160
"$root/out/bin/git" --version
otool -L "$root/out/bin/git" | cut -c1-90
