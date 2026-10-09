# Triage labels

the skills speak in five canonical triage roles. in frame they are labels on the `.backlog/` tasks (`backlog task edit <id> --add-label ready-for-agent`), set by matt's skills; `wontfix` is `backlog task archive` — they never reach linear.

- `needs-triage` — someone has to evaluate it
- `needs-info` — waiting on more information
- `ready-for-agent` — fully specified, an agent can take it
- `ready-for-human` — needs dima's hands or taste
- `wontfix` — will not be done

when a skill names a role (e.g. «apply the AFK-ready label»), add that string as a label; a task carries one role at a time.

the same meanings in linear — one meaning, two vocabularies, no sync:

- `ready-for-agent` ≈ the `agent` label
- `ready-for-human` ≈ `human`
- `needs-info` ≈ `needs human`
- `needs-triage` ≈ the Triage state
- `wontfix` ≈ Canceled
