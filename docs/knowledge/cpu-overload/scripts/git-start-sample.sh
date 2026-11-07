#!/bin/bash
# once a minute, 50 git --version: start time, seconds. one git start's speed under whatever runs now
out=${1:?out file}
export LANG=en_US.UTF-8
for ((tick = 0; tick < ${2:?minutes}; tick++)); do
    from=$(perl -MTime::HiRes=time -e 'print time')
    for ((i = 0; i < 50; i++)); do git --version >/dev/null; done
    printf '%s\t%s\n' "$(date +%FT%T%z)" "$(perl -MTime::HiRes=time -e "printf '%.3f', time-$from")" >>"$out"
    sleep 60
done
