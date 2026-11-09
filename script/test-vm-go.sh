#!/bin/bash
# test-vm-go [--index] go test <args…> | --create — runs a go suite in vm-go-test, the persistent lima vm, and on the mac when it is down.
# test-cpu-budget.sh calls it where it ran go test, so every door keeps its flags and its row (FRM-551).
# the tree under test becomes a commit of its own, pushed to refs/runs/<id> in ~/runs.git in the vm and checked out for that run alone:
# --index, a commit door's, holds the index only; without it a by-hand run's adds the whole working tree, as the mac would see it.
# a down vm runs on the mac and says so; a cut or overdue vm leg re-runs on the mac once, never a red.
# with CI set it is plain go test. TEST_VM_GO_REPORT names a file that gets «<leg>\t<vm cpu ms>» for the budget row:
# the VZ process's and the hostagent's cpu across the vm leg, which no rusage on the mac sees.
set -u
vm='vm-go-test'
lima_home=${LIMA_HOME:-$HOME/.lima}
# 3× the sweep's warm p90 at the pick, 48 s (FRM-551 rounds); past it the vm leg counts as cut
deadline=${TEST_VM_GO_DEADLINE:-150}
# the sweep's pick for the vm, 4 vcpus × 7 workers; the mac keeps 5: 3 suites at once cost the same wall as 14 workers, at 5 % less cpu
# and a mac that stays responsive
vm_parallel=7
mac_parallel=5

# --create: make vm-go-test, or bring a made one to the toolchain the repo pins; a rerun changes nothing that already holds
if [ "${1-}" = --create ]; then
    set -e
    root=$(git rev-parse --show-toplevel)
    go_version=$(sed -n 's/^go //p' "$root/x/go/go.mod")
    node_major=$(cat "$root/.node-version")
    pnpm_version=$(sed -n 's/.*"packageManager": "pnpm@\([0-9.]*\)".*/\1/p' "$root/package.json")
    # a repo file reaches a root shell in the vm: only version shapes pass
    [[ $go_version =~ ^[0-9]+(\.[0-9]+)+$ && $node_major =~ ^[0-9]+$ && $pnpm_version =~ ^[0-9]+(\.[0-9]+)+$ ]] || {
        echo "test-vm-go: a pin is not a version: go '$go_version', node '$node_major', pnpm '$pnpm_version'" >&2
        exit 2
    }
    if limactl list -q | grep -qx "$vm"; then
        echo "$vm exists: $(limactl list --format '{{.Status}}, {{.CPUs}} cpus, {{.Memory}} bytes' "$vm")"
    else
        # the sweep's pick (FRM-551 rounds): 4 vcpus × -parallel 7, the cheapest cpu at a wall near the fastest;
        # 6 GiB runs as 8 does, 4 GiB doubles the wall (the image has no swap, so a starved page cache shows as time, never as swap)
        limactl create --tty=false --name="$vm" --vm-type=vz --image-variant=minimal --containerd=none --mount-none \
            --cpus=4 --memory=6 --disk=40 template:ubuntu-26.04
    fi
    [ "$(limactl list --format '{{.Status}}' "$vm")" = Running ] || limactl start --tty=false "$vm"
    limactl shell "$vm" -- bash -s "$go_version" "$node_major" "$pnpm_version" <<'SETUP'
set -euo pipefail
go_version=$1 node_major=$2 pnpm_version=$3
# the background a test vm has no use for: snaps, unattended upgrades and their apt timers, crash reports
sudo systemctl mask --now snapd.service snapd.socket snapd.seeded.service unattended-upgrades.service \
    apt-daily.timer apt-daily-upgrade.timer apport.service >/dev/null 2>&1 || true
# the ci x job's set: what ubuntu-latest ships (git, jq, python3) and what its steps install (git-crypt, zsh)
missing=$(for pkg in git rsync git-crypt zsh jq python3 curl xz-utils ca-certificates; do dpkg -s "$pkg" >/dev/null 2>&1 || echo "$pkg"; done)
if [ -n "$missing" ]; then
    sudo apt-get update -qq
    # shellcheck disable=SC2086
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends $missing >/dev/null
fi
# every download is checked against its publisher's sha256 before it unpacks as root: the guest's go decides every commit's gate
fetch() {
    curl -fsSL -o "$2" "$1"
    echo "$3  $2" | sha256sum -c --quiet -
}
if ! /usr/local/go/bin/go version 2>/dev/null | grep -q "go$go_version "; then
    file=go$go_version.linux-arm64.tar.gz
    sum=$(curl -fsSL 'https://go.dev/dl/?mode=json&include=all' | jq -r --arg f "$file" '.[].files[] | select(.filename == $f) | .sha256')
    fetch "https://go.dev/dl/$file" "/tmp/$file" "$sum"
    sudo rm -rf /usr/local/go
    sudo tar -C /usr/local -xzf "/tmp/$file"
fi
sums=$(curl -fsSL "https://nodejs.org/dist/latest-v$node_major.x/SHASUMS256.txt")
node_tar=$(echo "$sums" | grep -o "node-v$node_major\.[0-9.]*-linux-arm64\.tar\.xz" | sed -n 1p)
if [ "$(/usr/local/node/bin/node --version 2>/dev/null)" != "$(echo "$node_tar" | sed -E 's/^node-(v[0-9.]+)-.*/\1/')" ]; then
    fetch "https://nodejs.org/dist/latest-v$node_major.x/$node_tar" "/tmp/$node_tar" "$(echo "$sums" | awk -v f="$node_tar" '$2 == f { print $1 }')"
    sudo rm -rf /usr/local/node
    sudo mkdir -p /usr/local/node
    sudo tar -C /usr/local/node --strip-components=1 -xJf "/tmp/$node_tar"
fi
export PATH=/usr/local/node/bin:/usr/local/go/bin:$PATH
[ "$(pnpm --version 2>/dev/null)" = "$pnpm_version" ] || sudo env PATH="$PATH" npm install -g --silent "pnpm@$pnpm_version"
echo 'export PATH=/usr/local/node/bin:/usr/local/go/bin:$PATH' | sudo tee /etc/profile.d/vm-go-test.sh >/dev/null
[ -d ~/runs.git ] || git init -q --bare ~/runs.git
echo "in $HOSTNAME: $(go version | cut -d' ' -f3), node $(node --version), pnpm $(pnpm --version), $(git --version | cut -d' ' -f3) git"
SETUP
    exit 0
fi

index_only=
[ "${1-}" = --index ] && index_only=1 && shift
[ -z "${CI:-}" ] || exec "$@"

suite=("$@")
# on_mac <leg> [vm cpu ms]: the row's report, then for any leg but the vm's own, the suite as the mac always ran it
on_mac() {
    [ -z "${TEST_VM_GO_REPORT:-}" ] || printf '%s\t%s\n' "$1" "${2:-0}" >"$TEST_VM_GO_REPORT"
    [ "$1" != vm ] && [ "$1" != vm-overlap ] || return 0
    exec "${suite[@]}" -parallel "$mac_parallel"
}

command -v limactl >/dev/null || on_mac mac

ssh_vm=(ssh -F "$lima_home/$vm/ssh.config" -o BatchMode=yes -o ConnectTimeout=5 "lima-$vm")

# the probe also makes the bare repo a first run pushes into
if [ "$(limactl list --format '{{.Status}}' "$vm" 2>/dev/null)" != Running ] ||
    ! timeout 5 "${ssh_vm[@]}" '[ -d runs.git ] || git init -q --bare runs.git || [ -d runs.git ]' </dev/null >/dev/null 2>&1; then
    echo "$vm down: ran on the mac" >&2
    on_mac vm-down
fi

# the VZ process (the one holding the vm's disk) and the hostagent, in cpu ms; ps prints [[hh:]mm:]ss.cc
vm_cpu_ms() {
    local pids
    pids=$(
        lsof -t "$lima_home/$vm/disk" 2>/dev/null
        cat "$lima_home/$vm/ha.pid" 2>/dev/null
    )
    [ -n "$pids" ] || {
        echo 0
        return
    }
    ps -o time= -p "$(echo "$pids" | paste -sd, -)" 2>/dev/null |
        awk '{ n = split($1, part, ":"); s = 0; for (i = 1; i <= n; i++) s = s * 60 + part[i]; total += s } END { printf "%d\n", total * 1000 }'
}

id=$$-$RANDOM$RANDOM
state=${X_STATE:-$HOME/.local/state/x}
mkdir -p "$state"
windows=$state/test-vm-go.log

sync_tree() {
    local tree index parent
    if [ -n "$index_only" ]; then
        tree=$(git write-tree) || return
    else
        index=$(mktemp "${TMPDIR:-/tmp}/test-vm-go-index.XXXX")
        cp "$(git rev-parse --path-format=absolute --git-path index)" "$index" 2>/dev/null
        # the whole working tree, as the mac run reads it: x/go's tests read files outside the module too (x-go-reads.txt)
        tree=$(GIT_INDEX_FILE=$index git add -A -- :/ && GIT_INDEX_FILE=$index git write-tree)
        local code=$?
        rm -f "$index"
        [ "$code" -eq 0 ] || return "$code"
    fi
    parent=$(git rev-parse -q --verify HEAD)
    commit=$(GIT_AUTHOR_NAME=test-vm-go GIT_AUTHOR_EMAIL=test-vm-go@localhost GIT_COMMITTER_NAME=test-vm-go \
        GIT_COMMITTER_EMAIL=test-vm-go@localhost git commit-tree ${parent:+-p "$parent"} -m "test-vm-go $id" "$tree") || return
    # send-pack is the transport alone: a push into our own vm runs none of the repo's pre-push gates; its words print only on a failure.
    # refs/base/head holds a parent for the next push to negotiate against, or every run would send the whole history again;
    # its own push after, best effort, since two seats moving it at once refuse each other
    local pushed
    local ssh_command="ssh -F '$lima_home/$vm/ssh.config' -o BatchMode=yes -o ConnectTimeout=5"
    pushed=$(GIT_SSH_COMMAND=$ssh_command timeout "$deadline" git send-pack --force "lima-$vm:runs.git" "$commit:refs/runs/$id" 2>&1) || {
        echo "$pushed" >&2
        return 1
    }
    [ -z "$parent" ] || GIT_SSH_COMMAND=$ssh_command timeout 10 git send-pack --force "lima-$vm:runs.git" "$parent:refs/base/head" >/dev/null 2>&1 || true
}

# the guest side, fed to bash on stdin. a run takes a free slot, a worktree it alone holds (its lock) for the run, checked out at the
# run's commit and cleaned before and after: a fixed path keeps go's build cache warm, which keys a package on its dir.
# the shared node_modules for the lock hash sit under a shared lock, taken exclusive only to install. a cut leaves its ref behind;
# the next run deletes every run ref older than one deadline. 125 is a cut: no slot, no checkout, no install.
guest=$(
    cat <<'GUEST'
set -u
id=$1 commit=$2 prefix=$3 deadline=$4 goflags=$5 git_config_global=$6
shift 6
repo=$HOME/runs.git runs=$HOME/runs deps=$HOME/deps
mkdir -p "$runs"
for n in 0 1 2 3 4 5 6 7; do
    exec 8>"$runs/slot-$n.lock"
    flock -n 8 && break
    exec 8>&-
    [ "$n" -lt 7 ] || exit 125
done
tree=$runs/slot-$n
clean() { git -C "$tree" clean -ffdxq -e /node_modules 2>/dev/null; }
trap 'clean; git -C "$repo" update-ref -d "refs/runs/$id" 2>/dev/null' EXIT
trap 'exit 143' HUP INT TERM
now=$(date +%s)
git -C "$repo" for-each-ref --format='%(committerdate:unix) %(refname:strip=2)' refs/runs/ |
    while read -r at name; do
        [ "$name" = "$id" ] || [ $((now - at)) -le "$deadline" ] || git -C "$repo" update-ref -d "refs/runs/$name"
    done
if [ -d "$tree" ]; then
    git -C "$tree" checkout -q --detach --force "$commit" || exit 125
else
    git -C "$repo" worktree add -q --detach "$tree" "$commit" >/dev/null 2>&1 || exit 125
fi
clean
want=$(git -C "$repo" show "$commit:pnpm-lock.yaml" 2>/dev/null | sha1sum | cut -c1-12)
exec 9>"$HOME/deps.lock"
flock --shared 9
if [ "$(cat "$deps/.lock-hash" 2>/dev/null)" != "$want" ] && [ -n "$(git -C "$repo" ls-tree "$commit" pnpm-lock.yaml)" ]; then
    flock -u 9
    flock 9
    if [ "$(cat "$deps/.lock-hash" 2>/dev/null)" != "$want" ]; then
        echo "$id: pnpm-lock.yaml moved, installing node_modules in the vm" >&2
        [ -d "$deps" ] || git -C "$repo" worktree add -q --detach "$deps" "$commit" >/dev/null 2>&1
        { git -C "$deps" checkout -q --detach --force "$commit" &&
            (cd "$deps" && CI=1 pnpm install --frozen-lockfile --ignore-scripts </dev/null >&2) && echo "$want" >"$deps/.lock-hash"; } || exit 125
    fi
    # shared to the run's end, so no install swaps node_modules under a running suite; a peer's install in the gap is a cut
    flock -s 9
    [ "$(cat "$deps/.lock-hash" 2>/dev/null)" = "$want" ] || exit 125
fi
[ ! -d "$deps/node_modules" ] || [ -e "$tree/node_modules" ] || ln -s "$deps/node_modules" "$tree/node_modules"
cd "$tree/$prefix" || exit 125
[ -z "$goflags" ] || export GOFLAGS=$goflags
[ -z "$git_config_global" ] || export GIT_CONFIG_GLOBAL=$git_config_global
timeout -k 5 "$deadline" "$@" </dev/null
GUEST
)

cpu_before=$(vm_cpu_ms)
started=$(date +%s)
echo "start $started $id" >>"$windows"
if ! sync_tree; then
    echo "end $(date +%s) $id" >>"$windows"
    echo "$vm cut (the sync failed): re-ran on the mac" >&2
    on_mac vm-cut "$(($(vm_cpu_ms) - cpu_before))"
fi
remote=$(printf '%q ' "$id" "$commit" "$(git rev-parse --show-prefix)" "$deadline" "${GOFLAGS-}" "${GIT_CONFIG_GLOBAL-}" "$@" -parallel "$vm_parallel")
# --foreground: a ctrl-c on a by-hand run reaches ssh, and through it the guest
timeout --foreground -k 5 $((deadline + 15)) "${ssh_vm[@]}" "bash -l -s -- $remote" <<<"$guest"
code=$?
ended=$(date +%s)
echo "end $ended $id" >>"$windows"
used=$(($(vm_cpu_ms) - cpu_before))

# 124 and 137 the deadline, 143 a guest stopped under the run, 126 and 127 a guest with no go, 125 a tree that never checked out,
# 255 ssh's own death; go test itself exits 0, 1 or 2
case $code in
124 | 125 | 126 | 127 | 137 | 143 | 255)
    echo "$vm cut (exit $code): re-ran on the mac" >&2
    on_mac vm-cut "$used"
    ;;
esac

# another run's window overlapping this one shares the process-wide VZ counter, so this row's number is not its own;
# a start with no end past the leg's own bound is a killed run, never one still going
overlap=$(awk -v me="$id" -v from="$started" -v to="$ended" -v bound=$((2 * deadline + 30)) '
    $3 != me && $1 == "start" { start[$3] = $2 }
    $3 != me && $1 == "end" { end[$3] = $2 }
    END { for (run in start) if (start[run] <= to && ((run in end) ? end[run] >= from : start[run] + bound >= from)) { print "yes"; exit } }' "$windows")
on_mac "vm${overlap:+-overlap}" "$used"
# the log keeps its last day or so
[ "$(wc -l <"$windows")" -lt 2000 ] || { tail -n 400 "$windows" >"$windows.new" && mv "$windows.new" "$windows"; }
exit "$code"
