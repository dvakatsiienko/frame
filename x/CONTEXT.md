# x — words

- **verb** — one operation `x` runs, named `<family> <name>` (`lane commit`); the unit an agent calls
- **family** — a group of verbs about one subject (`lane`, `handoffs`); owns a colour in the human view
- **registry** — the one typed list of verbs in `x/registry.ts`; dispatch, schema, help and the resident index all read it
- **envelope** — the json every verb prints for a machine: `{verb, ok, status, data}`
- **resident index** — the verb names and one-line purposes a SessionStart hook prints into every session, generated from the registry
- **admission rule** — the three tests a verb passes before it joins x (`PRODUCT.md`): a fleet procedure, more than one surface calls it, it hides a hazard or a sequence
- **the human view** — what dima sees on a tty: the T2 dense-family design; a pipe or `--json` gets the envelope instead
