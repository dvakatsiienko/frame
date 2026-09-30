---
name: guide-typescript
description: Load EVERY time you write, edit, or review TypeScript in any repo — .tsx work loads it alongside guide-react.
---

# TypeScript Guide

`guide-code` carries the values that govern this one; these are the language-specific
refinements. Binding when printing TypeScript — follow exactly, no freestyle.

## Core

- Latest ECMAScript features, accepted-step members only — no proposals.

## Naming

- **camelCase every identifier** — variables, functions, parameters, properties, object keys.
  `SCREAMING_SNAKE` only for module-level constants; `PascalCase` for types, interfaces,
  components. Scripts and shell-adjacent code obey this too — zx or bash origins never license
  snake_case.
- **Plain names, no Hungarian prefixes** — `SelectProps`, `Payload`; the `I`/`T`/`U` prefix
  system is retired 🪦.
- Component props: an interface named **`<Component>Props`**.
- **Booleans carry an auxiliary verb** — `isLoading`, `hasError`, `canEdit`; a bare `loading` reads as
  a noun at the call site.
- **Event handlers are `handle`-prefixed** — `handleClick`, `handleSubmit`; the prop that receives one
  stays `onClick`.
- **Rename-on-touch:** legacy prefixed names get renamed when a real edit visits their file —
  never in dedicated rename sweeps.

## Imports & exports

- **`import type` for every type-only import**, namespace form included:
  `import type * as gql from '@/graphql'`.
- **Named exports over default.** A default import can take any name — hides usages, breaks
  rename-refactors. Exception: frameworks that demand a default (Next.js pages/layouts).

## Inference first

Derive types from the source of truth; hand-retyped copies drift, derivations can't:

- zod schema → `z.infer<typeof schema>`
- cva config → `VariantProps<typeof buttonCva>`
- Convex table → `Doc<'chats'>`, generated `api` types
- `as const` list → `(typeof themeList)[number]`
- `as const` object → its values: `(typeof routes)[keyof typeof routes]`

## `satisfies` — the habit to build

Checks a value against a type **without widening it** — literal inference AND shape safety. A
plain annotation erases literals; `satisfies` keeps both.

```ts
type ThemeOption = { label: string; value: 'light' | 'dark' | 'system' };

const themeList = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
] as const satisfies readonly ThemeOption[];

// themeList[0].value is still the literal 'light' (not string) —
// but a typo'd key or an illegal value fails HERE, not at some distant use site.
```

Reach for it on anything config-shaped: option lists, route maps, tool registries, theme tables.

## Literals

- **`as const`** for fixed lists and config literals; derive the union from the list instead
  of maintaining a parallel union type.
- **No `enum`.** The `as const` list plus its derived union does the same job with no runtime object.
- **An id family built from two unions is a template literal type** — every combination, typo-proof.

```ts
// tip by matt pocock
const routes = { home: '/', admin: '/admin' } as const;
type Route = (typeof routes)[keyof typeof routes]; // '/' | '/admin'

type Feature = 'auth' | 'payments';
type ErrorType = 'unknown' | 'too-many-requests';
type ErrorCode = `${Feature}:${ErrorType}`; // 'auth:unknown' | 'payments:too-many-requests' | …
```

## Unions

- **A value in one of a few shapes is a discriminated union** — each branch carries only its own
  data, so an `error` without `status: 'error'` cannot compile. The tell: a `status` field beside
  two or more `?:` fields.
- **A switch over the discriminant ends in `default: return value satisfies never`** — a new
  variant turns every unhandled switch red at typecheck, and the error names the missing branch.
  The one miss a grep never finds.

```ts
// tip by matt pocock
type FetchState =
  | { status: 'loading' }
  | { status: 'success'; data: { id: string } }
  | { status: 'error'; error: Error };

const describeState = (state: FetchState) => {
  switch (state.status) {
    case 'loading': return 'loading';
    case 'success': return state.data.id;
    case 'error': return state.error.message;
    default: return state satisfies never;
  }
};
```

## Placement

- Types at the **bottom of the file** under `/* Types */` (guide-react's file anatomy).
- A shared type earns its own module only when 2+ files import it.

## Stack idioms

_Bytes-flavoured; apply where the stack matches._

- **jotai** — atoms infer from their initial value; annotate only when inference can't see it:
  `atom<string | null>(null)`.
- **Convex** — consume `Doc<'table'>` and the generated `api`; never hand-retype documents.
- **GraphQL codegen** — `import type * as gql from '@/graphql'`; reference `gql.LoginMutation`.
- **zod + react-hook-form** — the schema is the type: `type FormShape = z.infer<typeof schema>`.
