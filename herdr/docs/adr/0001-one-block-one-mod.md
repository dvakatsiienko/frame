# HRD-0001: one block, one mod

dima will A/B the window's parts often, and today moving one is a code change: x-herdr-deck draws thread rows, orbit and glide in one render, so a part can only move by cutting it out of one mod and into another (2026-11-13, layout A). We decided each part he sees (antenna, glide, orbit, phases, the chat) is its own mod, drawn whole in whatever block holds it, reading its facts from one shared store (x's thread record, the stash's files, herdr's `shared()`), never from a sibling part, with a narrow form below its min width. Herdr already places one mod in many blocks and passes each block its `props`, so a move becomes one node moved in the layout json, never a build.

## Consequences

- a mod cannot import a sibling mod's file, so a reader two parts share is copied into each or served as an `x` verb's json
- a layout save still kills the focused thread (herdr-app#861): a json A/B runs from a throwaway tab until herdr switches layouts safely
