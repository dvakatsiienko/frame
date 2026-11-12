# x-mod-guard

reads every Bash call before it runs, and stops the one call that matches the floor, naming the safe way instead; everything else runs, a rewrite or a hint beside it.

## Language

**Refusal**:
x-mod-guard stopping one command: the tool call ends with the door and the reason, the session goes on.
_Avoid_: block, deny (alone), veto

**Rewrite**:
x-mod-guard fixing a command that has one right spelling (`pnpm -s` → `--silent`, an unquoted `=`-word or `--include=*.ts` quoted) before it runs, with one context line telling the model what ran.
_Avoid_: autofix, correction

**Hint**:
One context line x-mod-guard adds to a command that runs as typed, naming the x verb that already covers it (`x gh pr`, `x lane commit`).
_Avoid_: nudge, tip, warning

**Door**:
The safe way to do what the refused command meant — `trash`, `git stash push -u -- <your paths>`, the Edit tool; «ask clio» only where no safe way exists.
_Avoid_: fix, alternative, suggestion

**Floor command**:
A command the fleet floor (invariant 8) never runs unasked, and the only kind x-mod-guard refuses: `rm`, a kill by pattern, a git discard or rewrite, a gate or hooks bypass, a herdr close of a live seat, a raw merge, a whole-tree stash over a held file, a machine change, a remote delete.
_Avoid_: dangerous command, destructive op

**Target**:
What a refused command acts on — its paths, its pattern, its branch; the rule's own word when it names none (`HEAD`, `&`, `-s`).
_Avoid_: argument, operand

**Guard event**:
One refusal, tick pass or override pass kept in x-mod-guard's store, the newest 50.
_Avoid_: log entry, alert

**Job scratch**:
The session's own `$CLAUDE_JOB_DIR/tmp`: a throwaway clone's local git runs unrefused, a push or a gate bypass from it does not.
_Avoid_: sandbox, temp repo

**Day count**:
One `day:<yyyy-mm-dd>:<session>` key in x-mod-guard's store holding that session's refusals and escapes for the local day; a halt sums a day's keys.
_Avoid_: tally, stats

**Remote delete**:
A delete on a service past any trash: `gh repo|release delete`, `vercel rm`, `op item delete`, `security delete-*`, a linear issue delete.
_Avoid_: cloud delete

**Clio thread**:
A herdr terminal labelled `seat=clio` (main) or `seat=clio-wing-<n>` (a wing), read through `hc get`; the label its spawner set, never a cc name the session gives itself. a clio thread ends any thread that is not one, and no thread ends a clio thread without his tick.
_Avoid_: coordinator terminal, clio pane

**Lead label**:
A terminal's `lead=<terminal id>` label, set at its spawn: the thread in that herdr terminal (its `HC_TERMINAL_ID`) may end it.

**Operator-override**: x's word, defined in `x/GLOSSARY.md`; here its `all` scope, or his band press, is the off switch: the floor warns and runs, plain rm and the brake aside, until its end.

**Tick**:
Dima's 🛎️ on an orbit ask quoting a whole floor command: it runs that command once within 2 h, plain rm never.
_Avoid_: approval, yes

**Hold**, **Holder**, **Release**: x-mod-holds' words, defined in its `GLOSSARY.md`; guard refuses a whole-tree stash over a held file.
