#!/bin/zsh
# launches FX Steam Launcher with the memory caps the app cannot save (fxgl/steamac #50)
set -euo pipefail
# a running vm is brought to the front; `open -n` would start a second one
if pgrep -qf "FX Steam Launcher.app/Contents/MacOS/steamac-vm"; then
  open -a "FX Steam Launcher"
  exit 0
fi
open -n -a "FX Steam Launcher" \
  --env MESA_KK_COMPILE_THREADS=4 \
  --args --cmdline "console=hvc0 loglevel=4 rootwait steamac.gpu_mib=10240" \
  --control-fifo "$HOME/.local/share/steamac/control.fifo"
