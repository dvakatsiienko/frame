# one registry drives every surface, and sessions hold one line about x

every verb is one entry in `x/go/registry.json`; dispatch, `--help`, `x schema`, completion and the purpose lint all read it, and a verb missing from either the registry or `impls` fails a test. the obvious path, a per-verb index pasted into every session's memory, would cost ~1.5k tokens at 60 verbs; instead each session holds one resident line (~30 tokens) — «`x` lists families, `x schema <family>` the verbs» — and asks the registry at the moment it needs a verb (dima, 2026-10-07).

- consequence: a verb's purpose line is the only text an agent picks it by, so `lintPurpose` runs over every one
- consequence: a replaced script gets an `x-mod-guard` hint pointing at its verb, since no memory line names the verb
