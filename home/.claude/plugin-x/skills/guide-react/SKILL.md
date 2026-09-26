---
name: guide-react
description: Load EVERY time you write, edit, or review React/JSX components — always paired with guide-typescript for the type side.
---

# React Guide

`guide-code` carries the values that govern this one; these are the language-specific
refinements. Binding when printing React — follow exactly, no freestyle. Types side:
`guide-typescript`.

## Components

- **Named exports, arrow functions.** `export const Button = (props: ButtonProps) => …`.
  Default exports only where a framework demands them (Next.js pages/layouts).
- **`props.x` accessor — no destructuring.** The prefix keeps data origin visible at every use
  site. Destructure only when applying defaults.
- **No `import React from 'react'`** — noise under the modern JSX transform.
- **Derived JSX lives in named consts** before the return, suffixed `JSX` (`ListJSX` for
  collections): `const optionListJSX = props.options.map(…)`.
- **Explicit `return` in map/render callbacks** — block body over implicit-return arrow: a
  `console.log`/`debugger` drops in without restructuring mid-debug.
- **An effect returns its release.** Every effect that subscribes, listens, times, observes or
  fetches returns the cleanup that undoes it (`abort()`, `clearInterval`, `unsubscribe`), so an
  unmount leaks nothing.
- **Body = logic, return = markup.** The body prepares data; the return stays pure JSX. Simple
  expressions inline are fine — complexity graduates to a named const.

## Server components (Next.js)

- **Server Components by default** — a component is RSC until it needs state, an effect, or a browser API.
- **`'use client'` sits as deep as it goes** — the smallest leaf that needs it, never a route's top.
- **Every async boundary carries an error boundary** — the section rules are in «Error boundaries» below.
- **`Suspense` wraps every async child**, with a fallback holding the final layout so nothing shifts
  when data lands.

## Error boundaries — `react-error-boundary`

A render error with no boundary removes the whole app. **Every meaningful section of a screen —
a panel, a list, a viewport, a header — sits in its own `<ErrorBoundary>`**, plus one at the root,
so a crash takes one section and the rest keeps working.

- **the fallback is designed**, never a raw message: it stays inside the section's own box so the
  layout holds, names what failed in plain words («the preview stopped drawing»), offers a retry
  (`resetErrorBoundary`), and keeps the error detail behind a disclosure in dev
- **the boundary wraps the section from its parent**, never from inside it: a boundary catches
  only what it wraps, so one placed inside `<Viewport>` misses a throw in `Viewport`'s own hooks
- **`resetKeys`** carry the section's input identity (the route, the selected item), so moving on
  clears the error by itself
- **errors a boundary cannot see** — event handlers, promises, timers — are routed with
  `showBoundary(error)` from `useErrorBoundary()`; `error` is `unknown` in v6, narrow it
- the root wires `createRoot`'s `onCaughtError` / `onUncaughtError` for reporting; they never
  replace a section's fallback
- the proof is a dev-only `?crash=<section>` that throws in the section's own top-level hook (a throw in a child passes even when the boundary sits wrong): the others still
  render and answer a click (the essentials in `x:browser-headless` name the check)

## Imports

Three groups, fixed order — every dependency has one obvious home:

1. **Core** — node_modules
2. **Components** — local React components
3. **Instruments** — everything else: api, helpers, styles, assets, type imports

`/* Core */` · `/* Components */` · `/* Instruments */` comments are optional flourish — add
them in import-heavy files, skip when the list is short.

## File anatomy

One template — imports → component → styles → helpers → types:

```tsx
import { useState } from 'react';
import { cva } from 'cva';

import { SpinnerSvg } from '@/components/svg/SpinnerIcon';

export const Select = (props: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const optionListJSX = props.options.map((option) => {
    return (
      <SelectItem key={option.value} value={option.value}>
        {option.label}
      </SelectItem>
    );
  });

  return (
    <SelectRoot onOpenChange={setIsOpen} open={isOpen} value={props.value}>
      <SelectTrigger className={triggerCva({ loading: props.isLoading })}>
        <SelectValue placeholder={props.isLoading ? <SpinnerSvg /> : 'Select…'} />
      </SelectTrigger>
      <SelectContent>{optionListJSX}</SelectContent>
    </SelectRoot>
  );
};

/* Styles */
const triggerCva = cva({
  base: 'grid min-w-25 grid-flow-col gap-1 px-2 text-sm',
  variants: {
    loading: { true: 'justify-center' },
  },
});

/* Types */
interface SelectProps {
  isLoading?: boolean;
  onValueChange: (value: string) => void;
  options: Option[];
  value: string;
}
interface Option {
  label: string;
  value: string;
}
```

Section meta-comments, in order, only the sections the file has:

- **`/* Styles */`** — cva variant configs, named `xxxCva`
- **`/* Helpers */`** — pure functions, configs, small non-component code
- **`/* Types */`** — every TypeScript shape, dead last; `<Component>Props` first
- Prefer inline `export const X = …`; a trailing `export { … }` block only when regrouping is
  needed

A large edit visiting an unpatterned file → propose aligning the whole file to this template.

## File layout

- **Flat file by default:** `components/Select.tsx`.
- **Folder + `index.ts` barrel** only when a component owns satellites (co-located assets, a
  `resolver.ts`, private SVGs): `LoginForm/{LoginForm.tsx, resolver.ts, img/, index.ts}`.
- **Route-local compositions** live in the route's `parts/` dir — they serve one page.

## UI/UX floor

Every rendered element also passes `guide-ui-ux` — the floor for anything a human looks at,
react or not. Load it alongside this guide.

## Vendored code (shadcn `ui/`)

Owned, not sacred — **convert-on-touch**: bring a file to house style only while editing it
for real work. No style-only chore commits.

## Stack idioms

_Bytes-flavoured; apply where the stack matches._

- **cva** — variants under `/* Styles */`; types via `VariantProps<typeof xxxCva>`.
- **Forms** — react-hook-form + zod, resolver in its own `resolver.ts` beside the form.
