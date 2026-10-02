# stack — one library per job, in every app

A job on this list uses its pick. Another library for the same job needs Dima's word first. A new
job gets its pick added here the day it lands, so the next app copies it instead of choosing again.

- **charts** → `visx` (`@visx/*`) — as in bytes `apps/trophy-sys`
- **zoom and pan** → `react-zoom-pan-pinch` — as in bytes `apps/atelier`
- **number input** → `rifm` (`useRifm` + `rifm/number`) — as in bytes `apps/financial`,
  `AmountInput.tsx`
- **animation** → `motion` (motion.dev) for UI state: enter/exit, layout, gestures, springs on
  interaction · **GSAP** for choreography: long timelines, kinetic type (SplitText), scroll
  storytelling (ScrollTrigger), SVG draw/morph, anything seeked by time (video renders). free for
  commercial use; in React through `useGSAP`. a component reacting to state → motion; a scene that
  plays like a film → GSAP (dima, 2026-10-02)
- **REST** → `@tanstack/react-query`, always

✅ a new app needs a chart → `@visx/*`, copied from trophy-sys.
🚫 a new app pulls in a second chart library because it was the first search hit.

Learned 2026-10-01, Dima: «remember top lib picks that we use across projects to not breed lots of
different tactics via different libs that solve same problem». The fleet cli's `libs` verb reads
this list.
