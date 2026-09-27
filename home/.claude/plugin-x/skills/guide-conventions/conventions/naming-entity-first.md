# naming — the entity leads, the qualifier follows

Every name that can grow into a family starts with its entity: files, folders, scripts, package
scripts, skills, functions, components, types. Siblings then sort together in a file tree, an import
list, a completion menu and a grep — the name does the grouping, no folder has to.

## examples

- ✅ `FormSubmit`, `FormLogin`, `FormField` · 🚫 `SubmitForm`, `LoginForm`
- ✅ `usageSave`, `usageRead`, `usagePath` · 🚫 `saveUsage`, `readUsage`
- ✅ `crew-coder`, `crew-verifier`, `crew-designer` · 🚫 `coder-brief`, `verifier-brief`
- ✅ `guide-code`, `guide-react` · 🚫 `code-guide`, `react-guide`
- ✅ `handoff-create`, `handoff-delete` · 🚫 `create-handoff`, `delete-handoff`
- ✅ a package script family: `sline:build`, `sline:test` · 🚫 `build-sline`, `test-sline`

A lone name with no family yet still takes the shape — the family arrives later, and a rename then
touches every caller.

## where the rule stops

- a framework's fixed names stay as the framework spells them (`page.tsx`, `useEffect`, `getServerSideProps`)
- a React hook keeps its `use` prefix, the entity follows it: `useUsage`, `useFormSubmit`
- a dependency's api is never renamed through a wrapper just to match

## a rename is one change on every layer

The rule in root `CLAUDE.md` holds: the dir, the file, the export, the script, the log strings and the
docs move together, and done is `grep -rn '<old name>'` printing nothing outside dated records.

## why

Dima reads the tree by families; a verb-first name scatters one feature across the alphabet
(«the grouping of stuff like files, folders becomes scattered … entity-first makes things more
organized, auto-relates related stuff by its name», 2026-09-27). The crew skills were renamed the
same day: 80 references in 34 files, one commit. The frame + bytes sweep is FRM-219.
