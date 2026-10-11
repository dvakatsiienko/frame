---
paths:
  - "**/.gitignore"
  - "**/.github/**"
  - "**/*.jq"
  - "**/package.json"
  - "**/pnpm-workspace.yaml"
---

# fleet-hazards-files — the pitfalls that bite while a file is edited

## .gitignore

- a gitignore pattern with a `/` in the middle is anchored to the ignore file's directory — `.impeccable/x.json` at a repo root never matches `apps/web/.impeccable/x.json`; `**/` in front makes it match at any depth (measured with `git check-ignore -v`, 2026-09-19). guard: none · FRM-304

## ci jq (workflows, `.github/*.jq`, `.github/scripts`)

- a jq program is proven when ci compiles it — ubuntu runners ship jq 1.7, the mac 1.8; `a + b`
  as a bare object value parses locally and fails on the runner (bytes #79, 2026-09-12). a job
  that runs jq prints `jq --version` first. guard: none · BYT-94 (the gate redraw drops the jq gate)

## pnpm manifests

- pnpm 12 reads `overrides` from `pnpm-workspace.yaml` only, the `package.json#pnpm` field is ignored with a warning (2026-09-21). guard: none · FRM-304

<!--
why here: the file-touch half of fleet-hazards.md, moved out in the 2026-10-11 sweep; a paths: rule loads on a Read, `cat` or Edit of a matching file, measured on .gitignore and a workflow (cc 2.1.296, sonnet + opus, 8/8). a line that bites on a Bash command or its output stays in fleet-hazards.md.
-->
