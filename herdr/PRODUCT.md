# herdr — the fleet's cockpit

wish: PK-363

## the want

dima's words:

> PK-363:W250 (2026-11-10 inbox, dima) let's define what herder product is for us: what it is best at, and why we want it.
>
> PK-363:W206 (2026-11-10 inbox, dima) goal 0: stabilize ourselves in herder. i am happy with ui and ux, and want a very sharp, pretty, beautiful ui. you are happy with performance and accessibility. automation is welcome where it helps.
>
> PK-363:W306 (2026-11-10 inbox, dima) goal 0 is done when i am happy with the herder ui and ux (very sharp, pretty, beautiful) and you are happy with its performance and accessibility; automation is welcome where it helps (restores W206's done-test sense, wishkeeper 14:28)
>
> PK-363:W209 (2026-11-10 inbox, dima) why it matters: herder is a new area, a clean new space to build in. it is also a good place to quickly spread messy patterns. splits must be clear from day 1. not a mess, only weighed decisions. we may not port one to one, but rethink what we have and drop what we do not want at all. (important)
>
> PK-363:W285 (2026-11-10 inbox, dima) herder seems cheap to modify. let's remember this quality and get maximum gains out of it, without turning it into "now it's expensive to modify".

- **what it is:** herdr is a native terminal app. for us it is the fleet's cockpit: the one window where dima sees every seat, reads and answers them, and reaches every knob (his tick on grill 4's Q4, 2026-11-10)
- **the name:** `x-herdr` is our setup inside herdr: its layout and our mods, each mod under its own name (his pick, 2026-11-10 17:17: «it is plain but clean»)
- **who:** dima first. the seats run inside it, but what we build in it is built for his eyes and hands
- **why we want it:** the desktop app's UI is not ours to shape; herdr's is, and cheaply: a mod is a folder and a `main.js`, a save reloads it
- **best at:** one live view over all seats at once (who works, who is blocked, whose pane is whose), native UI, and being cheap to change
- **the fallback:** the claude desktop app stays his fallback until herdr matches it card by card; each desktop card retires only when its herdr twin passes its own check

## what herdr is not — the boundary

`frame/AGENTS.md` § the boundary is the rule; for herdr it means:

- herdr holds what he reads or clicks across seats. a thing that must happen inside a running cc turn (a refusal, a hold, a count) is a cc mod's; a rule two areas need is an `x` verb
- herdr never reads a cc mod's private store: the mod writes each state herdr draws to its own file in `~/.claude/shelf/`
- a press that unlocks (a sign, a merge, a delete) is proven by a file only his press can write, fenced by the guard; herdr never stands in for that proof

## the values, standing for every chunk

> PK-363:W246 (2026-11-10 inbox, dima) main herder wishes. codie and verifier must know the values i want in my wishes and consider them during implementation. it is a standing rule for herder agents.md.
>
> PK-363:W247 (2026-11-10 inbox, dima) pretty ui. the almost ugly claude desktop ui is one of the reasons i picked herder. in herder: no clunky ui.
>
> PK-363:W248 (2026-11-10 inbox, dima) tell verifier to grade the ui look by taste. if verifier does not like the ui, it is not passed.
>
> PK-363:W249 (2026-11-10 inbox, dima) very good ux. i like hotkeys. the ux-first lean should be described in herder agents.md as a standing rule for the herder project too.
>
> PK-363:W256 (2026-11-10 inbox, dima) solid settings: clean, pretty, pristine shape. worth laying out from the start. each feature goes to settings, giving me essential knobs for my ux, without overloading.
>
> PK-363:W290 (2026-11-10 inbox, dima) slipstream-first approach to all places in herder.

- **pretty and sharp, no clunky UI.** a shot of every visible change goes to him; a sixth sense on a herdr chunk grades the look by taste, and a look it dislikes does not pass
- **ux first, hotkeys welcome.** every state, input and edge he meets counts; `x:guide-ui-ux` holds the defaults
- **every feature gets its settings row**, the essential knobs only, in one clean settings surface
- **slipstream first** wherever he talks to a seat: a send that joins the next turn before a send that starts one, each with visible feedback
- **cheap to modify stays cheap**: one mod per feature, plain JS, no clever layers

## theming

> PK-363:W305 (2026-11-10 inbox, dima) if herder supports theming, let's have support for it right away (restored: the prep kept only the question, crow 14:27)
>
> PK-363:W261 (2026-11-10 inbox, dima) the first SOLID theme can come later, functionality first. but i want a refined look once herder is stabilized overall.

- his setup stays flexible from day 1: changing a layout, a theme or an experiment is easy and fluent (his theming wish of 2026-11-10)
- herdr has themes: four built in, custom `themes/<name>.json`, a light and dark pair, and `theme()` for mods. every mod of ours takes its colours from `theme()`, so a theme change reaches it for free
- the first solid theme comes after the functions are stable

## facts every seat must know

> PK-363:W321 (2026-11-10 15:01, dima) herdr restarts are safe: restarts are one of the most visible and important perks of herdr to know. Only the theme switch is destructive right now (probably a herdr bug).

- **a herdr restart is safe**: seats survive it. a restart to load a mod is fine, and it is his hand
- **a layout change kills the thread in the focused tab** (a `layouts/*.json` save, `layout.switch`, a click on a layout in Settings › Look): probed 2026-11-11 on 0.1.15, signal 9 within a second, filed as herdr-app#861. before one: focus a throwaway tab, run it from rex, cancel any «Close…?» dialog. a theme change killed nothing in the probes (the 14:08 death was a layout switch), and the 0.1.14 bare `overlay.close` kill is gone in 0.1.15
- the mods a cc session draws (the band, the 🚦 board) show in a seat's Terminal view; the Chat view hides them, and he lives in the Chat view
- animations are native (transition, spring, loop); there is no DOM, so no react, no motion.dev, no dnd-kit; files dropped from outside reach a mod through `on_drop`
- herdr's own guide is `~/.config/herdr-app/AGENTS.md`; the proofs behind these lines: `_clio/.scratch/herdr/verified-answers.md` (wing 1, 2026-11-10, herdr-app 0.1.14)

## done, goal 0

the milestone «🪸 fleet runs in herdr» closes when main clio and wing 1 run a day in herdr with no desktop-only fallback, he is happy with its ui and ux, and clio with its performance and accessibility.
