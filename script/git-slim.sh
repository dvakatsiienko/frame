#!/bin/bash
# git-slim [--check] — every agent shell's git, brew's version with no gettext, Rust, perl, python, CoreServices or fsmonitor, about 85 libraries against brew's 706.
# bare: builds when the live one fails the check. each build gets its own tree, `current` swaps with a rename, so a lane mid-run never sees half a tree; old trees stay for that lane.
# --check: exit 0 healthy, exit 1 naming this script. the door is the SessionStart hook shelf/hooks/git-slim-path.sh for the Bash tool, whose snapshot resets PATH, and the `git-slim` block in home/.zshenv and home/.zprofile for a zsh started under it; a missing build falls back to brew's.
set -u
state=${X_STATE:-$HOME/.local/state/x}
home=$state/git-slim
live=$home/current
most_libraries=100

brew_git_version() {
    local line
    line=$(brew list --versions git)
    line=${line##* }
    echo "${line%_*}"
}

# prints what is wrong with a tree, nothing when it holds
tree_problem() {
    local tree=$1 version=$2 git=$1/bin/git real exec_path libraries read
    if [ ! -x "$git" ]; then
        echo "no executable git at $git"
        return
    fi
    if [ ! -s "$git" ]; then
        echo "$git is 0 bytes"
        return
    fi
    if ! read=$("$git" --version 2>/dev/null); then
        echo "$git does not run"
        return
    fi
    if [ "$read" != "git version $version" ]; then
        echo "$git reads '$read', brew's is $version"
        return
    fi
    libraries=$(DYLD_PRINT_LIBRARIES=1 "$git" --version 2>&1 >/dev/null | wc -l)
    if [ "$libraries" -gt "$most_libraries" ]; then
        echo "$git loads $((libraries)) libraries, the line is $most_libraries"
        return
    fi
    real=$(cd -P "$tree" && pwd -P)
    # a git run through `current` prints its exec path through it too, so both sides read resolved
    exec_path=$(cd -P "$("$git" --exec-path)" 2>/dev/null && pwd -P)
    case $exec_path in
    "$real"/*) ;;
    *)
        echo "its exec path '$exec_path' lies outside $real"
        return
        ;;
    esac
    for helper in git-remote-https git-credential-osxkeychain; do
        [ -x "$exec_path/$helper" ] || echo "no $helper in $exec_path"
    done
}

case ${1-} in
--check | '') ;;
*)
    echo "usage: git-slim [--check]" >&2
    exit 2
    ;;
esac

version=$(brew_git_version)
if [ -z "$version" ]; then
    echo "git-slim: brew has no git" >&2
    exit 1
fi
problem=$(tree_problem "$live" "$version")
if [ -z "$problem" ]; then
    echo "git-slim: healthy at $version"
    exit 0
fi
if [ -n "${1-}" ]; then
    echo "git-slim: $problem. rebuild: ~/frame/script/git-slim.sh" >&2
    exit 1
fi

# a broken live git must not clone its own replacement
PATH=${PATH//"$live/bin:"/}
export LANG=en_US.UTF-8

mkdir -p "$home/versions"
tree=$(mktemp -d "$home/versions/$version-XXXX")
src=$(mktemp -d "$home/src.XXXX")
trap 'rm -rf "$src"; [ -n "${tree:-}" ] && rm -rf "$tree"' EXIT

echo "git-slim: $problem. building $version into $tree"
git -c advice.detachedHead=false clone --quiet --depth 1 --branch "v$version" https://github.com/git/git.git "$src/git" || exit 1
sed -i '' -e '/framework CoreServices/d' -e '/FSMONITOR_DAEMON_BACKEND = darwin/d' -e '/FSMONITOR_OS_SETTINGS = unix/d' "$src/git/config.mak.uname" || exit 1
# sysconfdir and the keychain helper keep brew's credential setup working in an agent shell
# GIT_VERSION: the edit above would read as `2.56.0.dirty`
if ! make -C "$src/git" -j4 prefix="$tree" sysconfdir="$(brew --prefix)/etc" GIT_VERSION="$version" RUNTIME_PREFIX=YesPlease \
    NO_RUST=1 NO_GETTEXT=1 NO_TCLTK=1 NO_PERL=1 NO_PYTHON=1 NO_EXPAT=1 INSTALL_SYMLINKS=1 \
    install install-git-credential-osxkeychain >"$src/build.log" 2>&1; then
    tail -n 20 "$src/build.log" >&2
    echo "git-slim: the build failed, the live home is untouched" >&2
    exit 1
fi
problem=$(tree_problem "$tree" "$version")
if [ -n "$problem" ]; then
    echo "git-slim: the new build fails its check, the live home is untouched: $problem" >&2
    exit 1
fi

# mv -h renames over the link itself; a plain mv onto a link to a dir would nest inside it
ln -s "versions/${tree##*/}" "$live.$$" && mv -fh "$live.$$" "$live" || exit 1
tree=
echo "git-slim: live at $version"
