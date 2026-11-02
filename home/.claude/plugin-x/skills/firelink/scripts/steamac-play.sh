#!/bin/zsh
# launches FX Steam Launcher with the memory caps the app cannot save (fxgl/steamac #50)
set -euo pipefail
open -n -a "FX Steam Launcher" \
  --env MESA_KK_COMPILE_THREADS=4 \
  --args --cmdline "console=hvc0 loglevel=4 rootwait steamac.gpu_mib=10240" \
  --control-fifo "$HOME/.local/share/steamac/control.fifo"
