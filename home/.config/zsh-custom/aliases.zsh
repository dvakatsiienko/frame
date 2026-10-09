# Delete all built-in aliases
unalias -m '*'

# system
alias _=sudo
alias -- -='cd -'
alias -g ...=../..
alias -g ....=../../..
alias -g .....=../../../..
alias -g ......=../../../../..
alias 1='cd -1'
alias 2='cd -2'
alias 3='cd -3'
alias 4='cd -4'
alias 5='cd -5'
alias 6='cd -6'
alias 7='cd -7'
alias 8='cd -8'
alias 9='cd -9'
alias kk='kill -9'
alias rmx='trash'
alias fpson='/bin/launchctl setenv MTL_HUD_ENABLED 1'   # metal fps overlay in games, on
alias fpsoff='/bin/launchctl setenv MTL_HUD_ENABLED 0'  # …and off

# shell + editor
alias rezsh='exec zsh'
alias ezsh='nvim ~/.zshrc'
alias ealiases='nvim ~/.config/zsh-custom/aliases.zsh'
alias evim='nvim ~/.vimrc'

# git vibe — dima's hands; the words mirror ~/.claude/rules/fleet-vibe.md (a test keeps them in sync)
alias grab='git add .'
alias mana='git commit'                     # commit, editor opens
alias vibe='git commit -m'
alias vibetune='git commit --amend'
alias slay='git push'
alias slayer='git push --force'             # raw force, overwrites whatever is there
alias yolo='git push --force-with-lease'    # force, but refuses if the remote moved since your last fetch
alias sup='git sup'
alias warp='git switch'                     # jump to an existing branch
alias spawn='git switch -c'                 # create a branch and jump to it
alias loot='git pull'
alias scout='gprune -d'                      # fetch --prune, then drop every branch github already merged — worktree included
alias onward='git rebase --continue'
alias oops='git reset --soft HEAD~1'        # undo the last commit, keep the changes staged
alias lore='git --no-pager lg -20'          # the story so far: git lg, last 20, no pager
alias peek='git diff'                       # unstaged changes: what you edited but did not grab yet
alias peeked='git diff --staged'            # staged changes: what the next commit will contain
alias camp='git worktree add'
alias decamp='x lane decamp'
alias reforge='git rebase -i $(git merge-base HEAD main)'  # rewrite every commit of this branch since it left main

# git — only the shortcuts with no vibe word above and no better git alias below.
# the recipes (lg, ship, standup, br, vs, who) live in .gitconfig [alias] instead,
# where scripts, other shells and agents reach them too.
alias gca='git commit -a -m'   # stage every tracked change and commit, one move
alias gsw='git switch'
alias gswb='git switch -c'
alias gp='git push'
alias gpf='git push --force'
alias gpl='git pull'
alias gcl='git clone'
alias gba='git br'
alias gbD='git branch -D'
alias grh='git reset --hard' # destructive: throws away every uncommitted change
alias gwl='git worktree list'

# pnpm
alias pn='pnpm'
alias pna='pnpm add'
alias pnar='pnpm add -r'
alias pni='pnpm install'
alias pno='pnpm outdated'
alias pnor='pnpm outdated -r'
alias pnup='pnpm update --latest'
alias pnun='pnpm uninstall'
alias pnx='pnpm dlx'
alias pnt='pnpm typecheck'
alias pnd='pnpm dev'
alias pns='pnpm start'
alias pnb='pnpm build'
alias tb='turbo'

# llms
alias cc='claude'
alias cclio='cd ~/frame/cclio && claude --remote-control "🦉 cclio"'
alias cclio-list='~/frame/cclio/.claude/hooks/boot-prefetch.sh'
alias hk='pnpm --dir ~/frame --silent hotkeys:top'   # which chords + apps i actually use
alias pk='BACKLOG_CWD=~/frame/cclio backlog'   # cclio's pocket (Backlog.md): pk board, pk search <word>
