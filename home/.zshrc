# .zshrc should contain: aliases, functions, prompt themes, interactive features

# Completions — brew's `_files` arrive via `brew shellenv`; tools without one print theirs,
# cached by binary mtime into a dir on fpath (same rule as zsh_init_cached below). The dump
# is generated data too, so ~/.cache; a full scan once a day, `-C` the rest of the time.
zsh_completion_cached() {     # $1 = binary, rest = the command that prints a #compdef file
    local name=$1; shift
    local dir="$ZSH_INIT_CACHE_DIR/completions" file="$ZSH_INIT_CACHE_DIR/completions/_$name"
    local stamp="$ZSH_INIT_CACHE_DIR/$name.completion.version" bin version
    bin=$(whence -p $name) || return
    zmodload -F zsh/stat b:zstat
    version=$(zstat +mtime $bin)
    if [[ ! -s $file || $version != "$(<$stamp 2>/dev/null)" ]]; then
        mkdir -p $dir
        "$@" > $file || return
        print -r -- "$version" > $stamp
        rm -f ~/.cache/zsh/zcompdump      # a new _file needs one full compinit
    fi
}
zsh_completion_cached mo     mo completion zsh
zsh_completion_cached linear linear completions zsh
zsh_completion_cached ntn    ntn completions zsh
# x prints json to an agent, and an agent's shell may source this file; the script itself asks
# `x __complete` live, so a new verb needs no refresh
zsh_completion_cached x      env -u CLAUDECODE -u AI_AGENT x completion zsh

fpath=($ZSH_INIT_CACHE_DIR/completions $fpath)
autoload -Uz compinit
if [[ -n ~/.cache/zsh/zcompdump(#qN.mh+24) ]]; then    # full scan once a day
    compinit -d ~/.cache/zsh/zcompdump
else
    compinit -C -d ~/.cache/zsh/zcompdump
fi
source /opt/homebrew/opt/fzf/shell/completion.zsh

# A bare directory path is a cd — `..`, `...` (global alias) and `~/projects` all work; omz used to set this
setopt auto_cd

# Custom aliases and functions
for f in ~/.config/zsh-custom/*.zsh; do source $f; done

# Custom zsh plugins installed with homebrew because antigen (zsh plugin manager) is deprecated.
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# Tools that print their own init code get it cached and stamped with the
# version that produced it, so an upgrade regenerates and nothing can go stale
# unnoticed. The cache is generated data — it lives in ~/.cache, never in the
# frame repo.
zsh_init_cached() {           # $1 = binary, rest = the command that prints init
    local name=$1; shift
    local cache="$ZSH_INIT_CACHE_DIR/$name.zsh"
    local stamp="$ZSH_INIT_CACHE_DIR/$name.version"
    local bin version

    # the binary's mtime is the version: a `--version` subprocess per tool per tab cost ~30 ms
    bin=$(whence -p $name) || { eval "$("$@")"; return }
    zmodload -F zsh/stat b:zstat
    version=$(zstat +mtime $bin)

    if [[ ! -s $cache || $version != "$(<$stamp 2>/dev/null)" ]]; then
        mkdir -p $ZSH_INIT_CACHE_DIR
        "$@" > $cache || return
        print -r -- "$version" > $stamp
    fi

    source $cache
}

zsh_init_cached fnm fnm env --use-on-cd --version-file-strategy=recursive
zsh_init_cached starship starship init zsh
zsh_init_cached zoxide zoxide init zsh
