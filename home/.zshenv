# =============================================================================
# ZSH Environment Variables
# =============================================================================
# This file is sourced for all zsh invocations (interactive, non-interactive, scripts)
# Contains environment variables that should be available globally

# Generated tool init, cached and version-stamped by zsh_init_cached in .zshrc.
# Generated data, so it lives outside the frame repo.
export ZSH_INIT_CACHE_DIR=$HOME/.cache/zsh

# =============================================================================
# Security & Authentication
# =============================================================================

# 1Password SSH agent
export SSH_AUTH_SOCK=~/Library/Group\ Containers/2BUA8C4S2C.com.1password/t/agent.sock

# =============================================================================
# User Environment
# =============================================================================

# Default editor
export EDITOR=nvim

# =============================================================================
# Tool Configuration
# =============================================================================

# homebrew - the env-hint footer after every auto-update
export HOMEBREW_NO_ENV_HINTS=1

# bat - syntax highlighting cat replacement
export BAT_THEME=gruvbox-dark

# fzf - fuzzy finder (fd: fast, gitignore-aware, hidden files included)
export FZF_DEFAULT_COMMAND='fd --type f --hidden --exclude .git'

# zoxide - directory navigation
export _ZO_DATA_DIR=$HOME/.cache
export _ZO_ECHO=1
export _ZO_RESOLVE_SYMLINKS=1

# pnpm - keep new node_modules and the store out of Time Machine (≥12.6)
export PNPM_CONFIG_MACOS_BACKUP_EXCLUDE_MODULES_DIR=true
export PNPM_CONFIG_MACOS_BACKUP_EXCLUDE_STORE_DIR=true

# =============================================================================
# Terminal Configuration
# =============================================================================

export CLICOLOR=1

# =============================================================================
# PATH Configuration
# =============================================================================

# fnm - Node.js version manager
export FNM_PATH="$HOME/Library/Application Support/fnm"

if [ -d "$FNM_PATH" ]; then
  export PATH="$FNM_PATH:$PATH"
fi

# pnpm - Package manager
export PNPM_HOME="$HOME/Library/pnpm"

case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac

# Claude Code doesn't auto-detect Warp's OSC 8 hyperlink support (only
# iTerm2/Kitty/WezTerm) — force it so sline's branch link is clickable
export FORCE_HYPERLINK=1

# LM Studio CLI
export PATH="$PATH:$HOME/.lmstudio/bin"

# User local bins
export PATH="$HOME/.local/bin:$PATH"

# machine-local secrets (tokens for agent tooling), never in the repo
[ -f ~/.zshenv.local ] && source ~/.zshenv.local
