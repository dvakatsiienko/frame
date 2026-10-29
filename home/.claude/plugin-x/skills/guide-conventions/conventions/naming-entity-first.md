# naming — the entity leads, the qualifier follows

the rule, the single-name test and the rename-on-every-layer done line live in root `CLAUDE.md` § naming;
this file holds the code-level examples and where the rule stops.

## examples

- ✅ `FormSubmit`, `FormLogin`, `FormField` · 🚫 `SubmitForm`, `LoginForm`
- ✅ `usageSave`, `usageRead`, `usagePath` · 🚫 `saveUsage`, `readUsage`
- ✅ `crew-codie`, `crew-sixth-sense`, `crew-designer` · 🚫 `coder-brief`, `verifier-brief`
- ✅ `guide-code`, `guide-react` · 🚫 `code-guide`, `react-guide`
- ✅ `handoff-create`, `handoff-delete` · 🚫 `create-handoff`, `delete-handoff`
- ✅ a package script family: `sline:build`, `sline:test` · 🚫 `build-sline`, `test-sline`

## where the rule stops

- a framework's fixed names stay as the framework spells them (`page.tsx`, `useEffect`, `getServerSideProps`)
- a React hook keeps its `use` prefix, the entity follows it: `useUsage`, `useFormSubmit`
- a dependency's api is never renamed through a wrapper just to match

## why

Dima reads the tree by families; a verb-first name scatters one feature across the alphabet
(«the grouping of stuff like files, folders becomes scattered … entity-first makes things more
organized, auto-relates related stuff by its name», 2026-09-27). The crew skills were renamed the
same day: 80 references in 34 files, one commit. The frame + bytes sweep is FRM-219.
