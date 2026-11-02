#!/bin/zsh
# read-only: prints swap used, memory pressure level and free % every 5 s; ctrl-c to stop
while true; do
  swap=$(sysctl -n vm.swapusage | awk '{print $6}')
  level=$(sysctl -n kern.memorystatus_vm_pressure_level)
  free=$(memory_pressure -Q 2>/dev/null | awk -F': ' '/free percentage/{print $2}')
  print "$(date +%H:%M:%S)  swap used ${swap}  pressure ${level} (1 ok, 2 warn, 4 critical)  free ${free}"
  sleep 5
done
