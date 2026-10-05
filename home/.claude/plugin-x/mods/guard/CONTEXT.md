# guard

reads every Bash call before it runs and stops the one command that matches the floor or a known hazard shape, naming the safe way instead.

## Language

**Refusal**:
guard stopping one command: the tool call ends with the door and the reason, the session goes on.
_Avoid_: block, deny (alone), veto

**Door**:
The safe way to do what the refused command meant — `trash`, `git stash -u`, the Edit tool; «ask cclio» only where no safe way exists.
_Avoid_: fix, alternative, suggestion

**Floor command**:
A command the fleet floor (invariant 8 and the tooling rules) never runs unasked: `rm`, a kill by pattern, a git discard or rewrite, a gate bypass, a `mv` in the vault, a `HOME` override, `npm -g`, `pip install`.
_Avoid_: dangerous command, destructive op

**Hazard lint**:
A command shape that runs but goes wrong quietly, taken from `rules/fleet-hazards.md`: a `$` the shell eats, a gate piped into `head`, a trailing `&`.
_Avoid_: warning, smell

**Target**:
What a refused command acts on — its paths, its pattern, its branch; the rule's own word when it names none (`HEAD`, `&`, `-s`).
_Avoid_: argument, operand

**Escape**:
A `# dima-ok: <target>` comment that lets one refused command run, written only after dima's word; it must name the command's own target, and it is logged.
_Avoid_: override, bypass, allow

**Guard event**:
One refusal or escape kept in guard's store, shown as a 🛡️ line in stash's band until dismissed.
_Avoid_: log entry, alert
