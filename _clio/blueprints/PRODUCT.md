# viz tool — PRODUCT (shaping, 2026-10-18)

## the want

> i have wanted a tool like this for a long time. outline: i say «let's review and shake your pm module»; you draw how it is set up; i see it visually — it is often much easier to explore that way. artifacts and diagrams are too basic and scoped, and allow no editing or collab.
>
> what i want from it: fast and cheap for you to edit and read, ideally no heavy clunky mcp; easy for you to visualize any topic i ask about; i can edit the picture by dragging connectors and flow parts; pretty; solid, alive, not dead; next-gen and agent-friendly; free or a generous free tier — no subscription.
>
> i'd start with prototyping and reviewing our areas, later maybe a doc companion to our features, or even a workflow spec: i draw a flow → show you → we grill → you implement; or an existing drawn flow → i edit → we grill → you implement the changed flow.
>
> it should help you too: you could map an area — the memory system, global + yours + skills — so the picture shows its health; visually intertwined is bad, the more linear the connections the better. flows visualized n8n-style and editable could become a core comms point between us, since human↔agent comms are flawed. automation n8n-style is 50/50 for me: exploration and visibility first; what we invent there could become mods, which may run faster. a middle ground between excalidraw (pretty, easy, maybe too simple) and n8n (covers everything, maybe overkill).
>
> — dima, 2026-10-18 (inbox, folded)

## decided (grill round 1, 2026-10-18)

- **the job**: a comms canvas first; adopt the automations that are possible and best, never everything just for the sake of adoption
- **where**: local, on the mac; a local web app is the start, a pretty desktop app is a nice-to-have; performance and accessibility first
- **the truth**: a text file in git, local only, no deploy, no remote; the most efficient channel; complexity only when needed or when dima wants it
- **round-trip**: his drag edits save back into the same file, in v1 — «by editing, I want to show you my ideas and propositions. this is the whole idea»
- **layout**: under the hood, cclio's call; editing a flow costs cclio the least effort, the mechanism reliable, robust and bulletproof; start simple, add only as needed
- **the tests**: draw the pm map from the real files; cclio edits 3 nodes (tokens, seconds, renders right); dima drags one part and cclio reads it back
- **the flows** he wants to see, one file each, in cclio's folder, self-descriptive names he reads: the pm module flow · cclio's memory structure · optionally the whole fleet memory, globals included
- **polish**: performant as a priority; pretty is a strong nice-to-have — «i don't like clunky and ugly tools»

## the cut

(after the tests)

## out

(after the grill)
