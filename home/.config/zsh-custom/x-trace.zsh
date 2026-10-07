# x trace — every `pnpm <script>` typed at the prompt leaves one trace line through `x trace record`,
# in the background, so the prompt never waits. `x` itself is traced by its own dispatcher.
# X_TRACE=0 turns it off. the prune of dead pnpm scripts reads these lines (FRM-340).

zmodload zsh/datetime
autoload -Uz add-zsh-hook

typeset -ga _x_trace_cmd
typeset -g _x_trace_start

# $3 is the line with aliases expanded, so an alias for pnpm counts too
_x_trace_preexec() {
  local -a words=(${(z)3})
  _x_trace_cmd=()
  [[ ${words[1]} == pnpm ]] || return
  _x_trace_cmd=($words)
  _x_trace_start=$EPOCHREALTIME
}

# precmd sees the command's exit and the time it took; preexec alone knows neither
_x_trace_precmd() {
  local code=$?
  (( ${#_x_trace_cmd} )) || return
  local -i ms=$(( (EPOCHREALTIME - _x_trace_start) * 1000 ))
  [[ $X_TRACE == 0 ]] || x trace record --exit $code --duration $ms -- $_x_trace_cmd &>/dev/null &!
  _x_trace_cmd=()
}

add-zsh-hook preexec _x_trace_preexec
add-zsh-hook precmd _x_trace_precmd
