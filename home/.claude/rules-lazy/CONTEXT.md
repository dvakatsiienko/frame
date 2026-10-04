# rules-lazy

rules that stay out of resident memory until the work they govern starts.

## Language

**Lazy rule**:
A rule file that is not resident; it enters a session only when one of its triggers fires.
_Avoid_: on-demand rule, optional rule

**Trigger**:
A pattern in dima's prompt, in a command the session runs, or in the directory the session starts in, that says a lazy rule's work has started.
_Avoid_: matcher, hook (the hook is the mechanism, the trigger is the pattern)

**Load**:
The moment a lazy rule enters a session's context, once per session and again after a compaction.
_Avoid_: inject, attach

**Signal**:
A trace in a turn that shows a lazy rule's work happened — a ticket id, a `linear.app` link, a `- ticket:` line, a `linear` call.

**Miss**:
A signal in a session where its rule never loaded.
_Avoid_: failure, gap
