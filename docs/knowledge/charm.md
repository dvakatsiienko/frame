# charm — the stack x is built on

read when picking a charm library or widget for `x` or another go cli, and before writing any v2 code: it names the widget per view and the v2 traps a v1-trained agent hits; dima browses the stack here in one click. maintained by the `refresh-go-knowledge` recipe (`recipes/refresh-guide-go/recipe.md`).

verified-on: 2026-10-07 (a source-read base from the repos' `main`/`v2` branches, release notes and `go.mod` files via `gh api`; two web lanes, exa and parallel, merged in and tagged «(web lane)» — a tagged line was not source-read)

every base line carries its source; «?» marks what was not verified. ground truth for what x uses: `x/go/go.mod` + `x/go/*.go`.

## docs — three doors, in this order

- `go doc` from `x/go`: `go doc charm.land/bubbletea/v2.Program`, `go doc -all charm.land/bubbles/v2/viewport` — the exact pinned version, offline, one call; the source is under `~/go/pkg/mod/charm.land/<module>@<version>/`
- pkg.go.dev — the same docs as a page, but the latest version, not ours: [bubbletea](https://pkg.go.dev/charm.land/bubbletea/v2) · [bubbles](https://pkg.go.dev/charm.land/bubbles/v2) · [lipgloss](https://pkg.go.dev/charm.land/lipgloss/v2) · [huh](https://pkg.go.dev/charm.land/huh/v2) · [glamour](https://pkg.go.dev/charm.land/glamour/v2) · [log](https://pkg.go.dev/charm.land/log/v2) · [fang](https://pkg.go.dev/charm.land/fang/v2)
- each repo's `UPGRADE_GUIDE_V2.md` and `examples/` — the v2 traps (§3) and the widget per view (§2)

## 1. the stack

- `bubbletea` [github](https://github.com/charmbracelet/bubbletea) — the elm-style runtime under every interactive view (run steps, pager) — in go.mod `charm.land/bubbletea/v2 v2.0.10` (= latest, 2026-09-24)
- `bubbles` [github](https://github.com/charmbracelet/bubbles) — ready widgets: x uses `spinner`, `viewport` — in go.mod `charm.land/bubbles/v2 v2.2.1` (= latest, 2026-08-24)
- `lipgloss` [github](https://github.com/charmbracelet/lipgloss) — styles, borders, widths, layout, static `table`/`tree`/`list`, layer compositing — in go.mod `charm.land/lipgloss/v2 v2.0.6` (= latest)
- `huh` [github](https://github.com/charmbracelet/huh) — forms: confirm, select picker, arg inputs (`forms.go`) — in go.mod `charm.land/huh/v2 v2.0.3` (= latest, 2026-03-10)
- `glamour` [github](https://github.com/charmbracelet/glamour) — markdown → ansi for the knowledge shelf view (`boards.go`) — in go.mod `charm.land/glamour/v2 v2.0.1` (= latest)
- `log` [github](https://github.com/charmbracelet/log) — the stderr logger (`main.go`, level from env) — in go.mod `charm.land/log/v2 v2.0.1` (= latest)
- `fang` [github](https://github.com/charmbracelet/fang) — cobra wrapper: styled help + errors, `--version`, hidden `man` — in go.mod `charm.land/fang/v2 v2.0.1` (= latest)
- `x/term` [github](https://github.com/charmbracelet/x/tree/main/term) — `term.IsTerminal` for the agent/human split (`main.go:85`) — in go.mod `v0.2.2`
- `colorprofile` [github](https://github.com/charmbracelet/colorprofile) — profile detection + downsampling writer — indirect `v0.4.3`; worth a direct import (see §5)
- `ultraviolet` [github](https://github.com/charmbracelet/ultraviolet) — the cell renderer under bubbletea v2 — indirect only, never imported directly
- `harmonica` [github](https://github.com/charmbracelet/harmonica) — spring physics for motion — later; module `github.com/charmbracelet/harmonica v0.2.0` (2022), no tea dependency so v2-safe; bubbles already pulls it in (`bubbles/go.mod`) for animated `progress`
- `teatest` [github](https://github.com/charmbracelet/x/tree/main/exp/teatest/v2) — program-level tui tests with golden output — planned; path `github.com/charmbracelet/x/exp/teatest/v2` (see §6)
- `golden` [github](https://github.com/charmbracelet/x/tree/main/exp/golden) — golden-file asserts with `-update` — planned with teatest; tagged `v0.1.0` (bubbles pins it)
- `ntcharts` [github](https://github.com/NimbleMarkets/ntcharts/tree/v2) — terminal charts — later; ✅ v2-ready, `github.com/NimbleMarkets/ntcharts/v2` (see §2, §7)
- `vhs` [github](https://github.com/charmbracelet/vhs) — scripted terminal recordings: gif/mp4/png shots and `.txt`/`.ascii` goldens — tool, `brew`; v0.12.1
- `freeze` [github](https://github.com/charmbracelet/freeze) — one-shot png/svg/webp of code or `--execute` output — tool; v0.2.2 (2025-04, quiet)
- `sequin` [github](https://github.com/charmbracelet/sequin) — decodes ansi sequences into words; for reading golden files and renderer bugs — tool; v0.3.1
- `wish` [github](https://github.com/charmbracelet/wish) — ssh server for bubbletea apps — later/never; `charm.land/wish/v2 v2.0.5` already on bubbletea v2.0.10
- v2 of bubbletea, lipgloss and bubbles was announced out of beta on 2026-02-23; charm says those branches ran in its own agent product in production — [charm v2 announcement](https://charm.land/blog/v2/) (web lane)
- bubbletea v2 turns on synchronized updates (mode 2026) and better wide-unicode handling (mode 2027) where the terminal supports them, so no app-side escape hacks — [bubbletea v2.0.0 release](https://github.com/charmbracelet/bubbletea/releases/tag/v2.0.0) (web lane)

## 2. which widget for which view

example dirs are under [bubbletea/examples](https://github.com/charmbracelet/bubbletea/tree/main/examples) unless named otherwise (63 dirs, all on v2 imports).

- list picker, short (≤ ~10 items, one shot) → `huh.NewSelect[T]` standalone, as `forms.go` does — huh `examples/burger`, `examples/theme`
- list picker, long or filterable, inside a running tui → `bubbles/list` (fuzzy filter via `sahilm/fuzzy`, pagination, status bar) — `list-simple`, `list-default`, `list-fancy`
- multi-select → `huh.NewMultiSelect[T]` — huh `examples/burger`
- confirm y/n → `huh.NewConfirm` — `forms.go:106`
- text input, one line → `huh.NewInput` (standalone) or `bubbles/textinput` (embedded) — `textinput`, `textinputs`, `autocomplete` (suggestions)
- text input, multi-line → `bubbles/textarea`; v2.1 added `DynamicHeight`/`MinHeight`/`MaxHeight`, v2.2 added selection + copy/cut — `textarea`, `dynamic-textarea`, `chat`, `split-editors`
- whole form, several groups, dynamic fields → `huh.NewForm` + `TitleFunc`/`OptionsFunc` — huh `examples/dynamic`, `examples/conditional`, `examples/multiple-groups`
- table board, printed once (the board rows x prints today) → `lipgloss/table` (static render, `StyleFunc` per cell) — `table-resize`; lipgloss `examples/table`
- table board, navigable rows → `bubbles/table` (cursor, focus, `SetWidth`/`SetHeight`) — `table`
- tree (handoff chains, file trees) → static `lipgloss/tree`; interactive `bubbles/tree` (new in v2.2.0 from diffnav, readme section dropped in v2.2.1 «for now» — treat as fresh) — lipgloss `examples/tree`
- spinner during a step → `bubbles/spinner` inline (x `run.go`) — `spinner`, `spinners` (all built-in styles), `realtime`
- spinner with no tui around it → `huh/v2/spinner` `.Action(fn)` or `.Context(ctx)` — huh `examples/spinner`
- many steps ticking in order with a printed log above → `tea.Printf`/`tea.Println` + `tea.Sequence` — `package-manager`
- progress bar → `bubbles/progress` (`WithColors`, `WithDefaultBlend`, `WithScaled`, `WithColorFunc`) — `progress-static` (pure view), `progress-animated` (harmonica spring), `progress-download` (real bytes)
- terminal-native progress (the tab/dock indicator, OSC 9;4) → `view.ProgressBar = tea.NewProgressBar(state, value)` — `progress-bar`
- pager / long text → `bubbles/viewport` (v2: `SoftWrap`, `LeftGutterFunc` line numbers, `SetHighlights` + `HighlightNext` search, horizontal scroll) — `pager`; x `pager.go`
- markdown view → `glamour` render string → `viewport` — `glamour`
- tabs → hand-rolled lipgloss borders — `tabs`
- multiple screens / focus switching → one parent model routing msgs — `composable-views`, `views`
- help footer from keybindings → `bubbles/help` + `bubbles/key` — `help`
- paging dots → `bubbles/paginator` — `paginator`
- timer / stopwatch → `bubbles/timer`, `bubbles/stopwatch` — `timer`, `stopwatch`
- file picker → `bubbles/filepicker` or `huh.NewFilePicker` — `file-picker`; huh `examples/filepicker`
- overlays, dialogs, click targets → lipgloss `NewCompositor` + `NewLayer(...).ID("x")` + `comp.Hit(x, y)` from `view.OnMouse` — `clickable`, `canvas`
- chart → ntcharts/v2: `barchart`, `linechart` (+ `timeserieslinechart`, `streamlinechart`, `wavelinechart`), scatter, OHLC candles, `sparkline`, `heatmap`, raw `canvas`; `picture` for kitty images — ntcharts `examples/` (`barchart`, `sparkline`, `heatmap`, `linechart`, `quickstart`, `usage`)
- a chart is cells and runes, so resolution is coarse: downsample data to the visible width, bound the update rate, stop updating off-screen, and keep a plain-data fallback; `picture`/kitty modes depend on the terminal — [ntcharts examples](https://github.com/NimbleMarkets/ntcharts/blob/main/examples/README.md) (web lane)
- spring animation → `harmonica.NewSpring(harmonica.FPS(60), freq, damping)`, step per tick msg — `cellbuffer`, `progress-animated`; harmonica `examples/`
- spring tuning: damping under 1 overshoots, 1 settles fastest with no oscillation, over 1 settles slower; call `Update` once per frame and make the configured FPS match the real tick cadence — [harmonica README](https://github.com/charmbracelet/harmonica) (web lane)
- run an editor / child process and come back → `tea.ExecProcess(cmd, cb)` — `exec`
- background worker feeding the ui → `p.Send(msg)` from a goroutine, or a channel-wait cmd — `send-msg`, `realtime`

## 3. v2 traps — what a v1-trained agent writes wrong

- import paths are vanity + `/v2`: `charm.land/bubbletea/v2`, `charm.land/bubbles/v2/<pkg>`, `charm.land/lipgloss/v2`, `charm.land/huh/v2`, `charm.land/glamour/v2`, `charm.land/log/v2`, `charm.land/fang/v2`; `github.com/charmbracelet/<lib>` is v1 and will not mix — every `UPGRADE_GUIDE_V2.md`
- 📌 the exceptions keep github paths: `github.com/charmbracelet/x/...`, `colorprofile`, `harmonica`, `ultraviolet`, `github.com/NimbleMarkets/ntcharts/v2`, `github.com/charmbracelet/x/exp/teatest/v2` — their `go.mod` files
- 📌 fang's own README still shows `github.com/charmbracelet/fang` and huh's/glamour's guides show `lipgloss.HasDarkBackground()` with no args — both wrong for v2; the real signature is `HasDarkBackground(in, out term.File)` — fang `README.md`, `lipgloss/query.go:86`
- `View() string` → `View() tea.View`; build with `tea.NewView(s)` — bubbletea `UPGRADE_GUIDE_V2.md`
- program options and toggle commands became View fields: `WithAltScreen`/`EnterAltScreen` → `v.AltScreen = true`; mouse → `v.MouseMode`; `SetWindowTitle` → `v.WindowTitle`; `HideCursor` → `v.Cursor = nil`; `WithInputTTY` gone (input always opens the tty) — same guide
- `case tea.KeyMsg:` still compiles but is now an interface covering press AND release; match `tea.KeyPressMsg` — same guide
- key fields: `msg.Type` → `msg.Code` (rune), `msg.Runes` → `msg.Text` (string), `msg.Alt` → `msg.Mod.Contains(tea.ModAlt)`; `tea.KeyCtrlC` gone → `msg.String() == "ctrl+c"` — same guide
- space: `msg.String()` returns `"space"`, never `" "` — same guide
- paste arrives as `tea.PasteMsg{Content}`, never a key msg with `Paste` — same guide
- mouse: `tea.MouseMsg` is an interface, read `msg.Mouse().X`; split into `MouseClickMsg`/`ReleaseMsg`/`WheelMsg`/`MotionMsg`; `MouseButtonLeft` → `MouseLeft` — same guide
- `tea.Sequentially` → `tea.Sequence`; `tea.WindowSize()` → `tea.RequestWindowSize`; `p.Start()` → `p.Run()` — same guide
- bubbles widths are methods: `vp.Width = 80` → `vp.SetWidth(80)` / `vp.Width()` (filepicker, help, progress, table, textinput, viewport) — bubbles `UPGRADE_GUIDE_V2.md` §2b
- `viewport.New(80, 24)` → `viewport.New(viewport.WithWidth(80), viewport.WithHeight(24))`; `HighPerformanceRendering` gone — bubbles guide
- `DefaultKeyMap` vars → funcs `DefaultKeyMap()` (paginator, textarea, textinput); `NewModel` aliases gone → `New`; `spinner.Tick()` → `m.Tick()` method — bubbles guide
- progress: colors are `color.Color` not strings; `WithGradient` → `WithColors`, `WithDefaultGradient` → `WithDefaultBlend`; `Update` returns `progress.Model`, not `tea.Model` — bubbles guide
- no auto light/dark anywhere: `lipgloss.AdaptiveColor` is gone (→ `lipgloss.LightDark(isDark)(light, dark)` or `compat.AdaptiveColor`); bubbles styles take `isDark` (`list.DefaultStyles(isDark)`, `help.DefaultStyles(isDark)`); huh themes are `func(isDark bool) *huh.Styles` wrapped in `huh.ThemeFunc`; glamour `WithAutoStyle` removed, default is `"dark"` — lipgloss/bubbles/huh/glamour guides
- `lipgloss.Color` is a func returning `image/color.Color`, not a string type; `TerminalColor` gone — lipgloss guide
- the renderer is gone and `Style.Render` always emits full truecolor; downsampling happens at print time (`lipgloss.Println`/`Fprintln`/`Sprint`, or bubbletea's own output). a plain `fmt.Println(style.Render(...))` skips it — lipgloss guide «Printing and Color Downsampling»
- glamour `WithColorProfile` removed: glamour is pure, print its output through `lipgloss.Print` to downsample — glamour guide
- glamour renders without terminal detection, so set the word-wrap width for your layout yourself — [glamour v2 docs](https://pkg.go.dev/charm.land/glamour/v2) (web lane)
- huh field-level `WithAccessible` removed; set it on the form only — huh guide
- log `SetColorProfile` takes `colorprofile.Profile`, termenv is gone — log guide
- fang: `WithTheme` is deprecated, use `WithColorSchemeFunc` and test the scheme on light and dark terminals — [fang v2 upgrade guide](https://github.com/charmbracelet/fang/blob/main/UPGRADE_GUIDE_V2.md) (web lane)
- wish v2: drop `MakeRenderer` and the old middleware colour detection; read the client's environment from `tea.EnvMsg` or the ssh session, never the server's `os.Getenv` — [wish v2 upgrade guide](https://github.com/charmbracelet/wish/blob/main/UPGRADE_GUIDE_V2.md) (web lane)
- `WithInput(nil)` (x `run.go:104`) also skips every terminal query: `RequestBackgroundColor`, cursor position, clipboard read, the startup capability probe; a model waiting on those replies waits forever (v2.0.10 made this explicit) — `options.go` doc on `WithInput`, release v2.0.10
- ntcharts v2.4–v2.7 shipped behavior changes inside one week (`Build` returns a different model type, heatmap row order flipped, chartpicture moved module) — pin an exact version — ntcharts `CHANGELOG.md`

## 4. power patterns

- printed lines above a live view: `tea.Printf`/`tea.Println` return cmds that write permanent lines above the inline program; pair with `tea.Sequence` so the last line lands before `tea.Quit` — `examples/package-manager`
- vanish on exit: return `tea.NewView("")` once done and the inline renderer leaves nothing; x's own trap note is the flip side (print the still `✓` line after quit) — `examples/vanish`, `x/go/AGENTS.md`
- headless mode from one model: `tea.WithoutRenderer()` when stdout is not a tty runs the same Update loop with no drawing (daemon/log mode) — `examples/tui-daemon-combo`
- intercept quit: `tea.WithFilter(func(m, msg) tea.Msg)` returns nil to swallow a `QuitMsg` while there is unsaved work — `examples/prevent-quit`, `options.go`
- read state after run: `final, err := p.Run()` then type-assert the model — `examples/result`
- background colour the tea way: `Init` returns `tea.RequestBackgroundColor`, `Update` handles `tea.BackgroundColorMsg` → `msg.IsDark()` → rebuild styles; no blocking i/o, works over ssh — lipgloss guide «With Bubble Tea», bubbles guide §4
- profile-aware model: handle `tea.ColorProfileMsg` to learn the detected profile; force one with `tea.WithColorProfile(colorprofile.ANSI)` in tests — release v2.0.0 «Detecting the Color Profile»
- layers + hit testing for dialogs and click targets: `lipgloss.NewCompositor(lipgloss.NewLayer(bg).ID("bg"), ...)`, then in `v.OnMouse` call `comp.Hit(x, y).ID()` — `examples/clickable`
- huh inside a tea model: `huh.Form` is a `tea.Model`; delegate `Update`, check `form.State == huh.StateCompleted` — huh README «What about Bubble Tea?», huh `examples/bubbletea`; `form.WithViewHook(func(v tea.View) tea.View)` flips alt screen per form, as x `forms.go:63` does
- viewport search: `vp.SetHighlights(re.FindAllStringIndex(vp.GetContent(), -1))` + `HighlightNext` gives `/`-search in a pager for free — bubbles guide «Viewport»
- debounce: tag a `tea.Tick` msg with a counter and drop stale ones — `examples/debounce`
- native progress in the terminal tab: `v.ProgressBar` (OSC 9;4), with `tea.ProgressBarIndeterminate` for unknown length — `examples/progress-bar`, release v2.0.0 «Progress Bar Support»
- async work: a cmd returns a typed msg carrying result and error plus a request or generation id, so a stale reply cannot overwrite newer state; `tea.Batch` for independent work, `tea.Sequence` when order matters, never block `Update` on i/o — [bubbletea README](https://github.com/charmbracelet/bubbletea/blob/main/README.md) (web lane)
- sizing: handle `tea.WindowSizeMsg` once in the parent, pass width/height down, and reserve space for borders, help and status; malformed dimensions or an extra trailing newline still produce ghost rows under the v2 renderer — [charm v2 announcement](https://charm.land/blog/v2/) (web lane)
- theme: keep one set of semantic styles (primary, muted, error, selected, border) and render only from it; pick light/dark from bubbletea's background message or a configured policy — [lipgloss v2 upgrade guide](https://github.com/charmbracelet/lipgloss/blob/HEAD/UPGRADE_GUIDE_V2.md) (web lane)
- performance: render from model state only, spawn no goroutines from `View`, and cache stable sub-renderings (a glamour render, a table layout) until width, theme or data change — [charm v2 announcement](https://charm.land/blog/v2/) (web lane)
- screen mode: inline for output that should stay in shell history or compose with an agent, `v.AltScreen = true` only when the app owns the screen; diagnostics go to stderr, never over a full-screen renderer — [bubbletea v2.0.0 release](https://github.com/charmbracelet/bubbletea/releases/tag/v2.0.0) (web lane)

## 5. agent + human in one cli

- the split x has: json envelope when `--json` or stdout is not a tty; interactive only when stdin is a tty too (`main.go:85-86`, `x/term.IsTerminal`) — matches the tui-daemon-combo pattern
- `colorprofile.Detect(w, env)` returns `NoTTY` (all ansi stripped) when `w` is not a terminal or `TERM=dumb`; `NO_COLOR` on a tty caps at `ASCII` (bold/italic kept, colour dropped); `CLICOLOR_FORCE` forces at least `ANSI` on a pipe — `colorprofile/env.go:74-112`
- 📌 x prints its boards with `fmt.Println` (`main.go:255-483`, `run.go:54-174`) and the palette is hex (`view.go:21-28`), so on the human path `NO_COLOR` and 256-colour terminals (macOS Terminal.app ?) still get truecolor sequences; the fix is `lipgloss.Println` or one `colorprofile.NewWriter(os.Stdout, os.Environ())` — inference from the lipgloss guide, not run
- bubbletea programs downsample by themselves; huh forms run inside bubbletea, so they do too — release v2.0.0 «Built-in Color Downsampling»
- fang: wraps help and errors in `colorprofile.NewWriter`, so they downsample and strip on a pipe; sets `SilenceUsage`/`SilenceErrors`; adds `--version` (from build info or `WithVersion`), a hidden `man` command (mango, one roff page), a `completion` command unless `WithoutCompletions`; `WithNotifySignal` turns signals into ctx cancel; `WithErrorHandler` replaces the styled error (x passes a no-op, `main.go:105`) — `fang/fang.go:110-178`
- fang only queries the background when stdout is a tty (`term.IsTerminal(os.Stdout.Fd())` in `mustColorscheme`), so an agent pipe pays no query — `fang/theme.go:116-122`
- startup cost of a background query: `lipgloss.HasDarkBackground` puts stdin in raw mode, sends OSC 11 + DA1 and waits for DA1 as the sentinel, timeout 2 s; a terminal that answers DA1 returns fast, one that answers nothing costs the full 2 s; on error it returns dark — `lipgloss/terminal.go:25-49`, `query.go:86`. x guards it with the tty checks and `X_THEME` (`view.go:64`)
- inside a bubbletea program prefer `tea.RequestBackgroundColor` over the blocking lipgloss call — the two otherwise fight over stdin (release v2.0.0 «No more fighting»)
- piped stdin with a live tui: v2 always opens the tty for input unless `WithInput` is given; `tea.OpenTTY()` gives tty in/out when stdout is redirected — release v2.0.0 «Use the Terminal's TTY», `examples/pipe`
- huh accessible mode drops the tui for plain prompts; the README suggests `ACCESSIBLE` env → `form.WithAccessible(true)` — a natural third mode beside agent and human — huh README «Accessibility»
- runewidth init cost (~13 ms below v0.0.30) is already pinned in x's AGENTS.md; nothing else measured here
- a pipe never gets ansi, spinners, cursor moves or alt-screen codes; honour `NO_COLOR`, keep a force-colour override, and offer explicit `--no-color` and `--interactive` beside the tty checks — [no-color.org](https://no-color.org/), [cli guidelines](https://clig.dev/) (web lane)
- huh is for a tty: in agent mode require the values as flags or stdin and answer a missing one with a clear error, not a prompt — [huh README](https://github.com/charmbracelet/huh/blob/main/README.md) (web lane)
- log: text for a tty, json or logfmt for machine readers; the text formatter drops its styling when its output is not a tty — [log v2 upgrade guide](https://github.com/charmbracelet/log/blob/main/UPGRADE_GUIDE_V2.md) (web lane)
- glamour for a pipe: pick the `ascii` style (no colour) instead of embedding ansi markdown in output — [glamour v2 upgrade guide](https://github.com/charmbracelet/glamour/blob/main/UPGRADE_GUIDE_V2.md) (web lane)
- keep the agent path a fast path that parses flags and exits; lazy-load glamour, charts and animation, and make no startup network calls — [charm v2 announcement](https://charm.land/blog/v2/) (web lane)

## 6. testing

- 🧪 cheapest layer, no program at all: call `m.Update(msg)` with a `tea.KeyPressMsg{Code: ...}` and assert on `m.View().Content` (strip ansi with `x/ansi.Strip`, `ansi/width.go`) — catches logic and layout, fast, deterministic. inference: the upgrade guide shows `View` returns a struct with `Content`; no charm doc names this pattern
- teatest: real path `github.com/charmbracelet/x/exp/teatest/v2`, own module, no tags (pseudo-version only); its `go.mod` requires `charm.land/bubbletea/v2 v2.0.0-rc.1`, so MVS lifts it to our v2.0.10; last change 2026-03-11 «update teatest v2 to use charm.land» — ✅ v2-compatible, `exp/` = no api promise — `x/exp/teatest/v2/go.mod`, commit log
- teatest api: `NewTestModel(t, m, WithInitialTermSize(w, h), WithProgramOptions(...))` (default 80×24, adds `WithInput/WithOutput` buffers, `WithoutSignals`, `WithWindowSize`), `tm.Send`, `tm.Type`, `WaitFor(t, tm.Output(), cond, WithDuration, WithCheckInterval)`, `tm.Quit`, `FinalModel`, `FinalOutput`, `RequireEqualOutput(t, bytes)` (golden, `-update` rewrites, uses the system `diff`) — `teatest.go`
- 📌 teatest goldens are the raw renderer byte stream (cursor moves, escapes), not a screen grid; a renderer bump (ultraviolet changed in v2.0.8/v2.0.9) can churn every golden — inference from `teatest.go` + bubbletea release notes. read a diff with `sequin` (its README names teatest goldens as a use case). force the profile with `WithProgramOptions(tea.WithColorProfile(colorprofile.Ascii))` for stable bytes
- x's current harness: every call in `fixtures/calls.json` runs through the binary, tty calls on a real pty (`creack/pty`) — the end-to-end layer teatest does not replace (`x/go/AGENTS.md`)
- vhs: a `.tape` drives a real terminal; `Output golden.txt`/`.ascii` gives a text golden of the final screens (README «Testing»), `Screenshot x.png` a png, `Wait+Screen /regex/` waits on content; catches redraw ghosts and real-terminal rendering — the shots are the test for redraws (fleet memory: bubbletea ghost rows were caught only by shots)
- freeze: one png/svg/webp of static command output (`--execute`); right for a printed board, wrong for a live tui (cannot replay an interactive program) — freeze README
- what each catches: unit Update/View → logic; teatest → message flow, quit paths, timing; pty fixtures → the agent/human contract and exit codes; vhs → what a human sees across frames; freeze → readme art of a still
- in ci normalise colour profile and line endings before comparing goldens, and run `-update` only when a visual change is meant — [teatest guide](https://charm.land/blog/teatest/) (web lane)
- vhs needs `ttyd` and `ffmpeg` on the machine unless run through its docker image — [vhs README](https://github.com/charmbracelet/vhs) (web lane)
- freeze can also shoot one pane of a running tui through `tmux capture-pane`, with theme, size, font and margins pinned — a still of the pane, never an interaction test — [freeze README](https://github.com/charmbracelet/freeze) (web lane)
- sequin is a cli for reading ansi, not a go decoder dependency; its README says APC sequences are not supported yet — [sequin README](https://github.com/charmbracelet/sequin) (web lane)
- keep json-envelope tests apart from ansi visual tests; the suggested matrix is model assertions plus teatest goldens at a few fixed sizes, a small vhs suite for the human happy paths and the pipe/tty boundary, freeze for docs only — [teatest guide](https://charm.land/blog/teatest/) (web lane)

## 7. open questions

- ntcharts v2 fit: verified v2-ready (`go.mod` pins bubbletea v2.0.10, bubbles v2.2.1, lipgloss v2.0.6 — our exact versions; needs go ≥ 1.26.8, we run 1.27.1), but it drags `bubblezone/v2`, `pixterm`, `golang.org/x/image` and its own `ultraviolet` pseudo-version (2026-09-28, newer than ours) — the build cost and binary size are unmeasured ?
- ntcharts' own words: «the `v2` designation is for BubbleTea API compatibility … the API is still subject to change» — README. a sparkline or bar in x may be cheaper hand-rolled in lipgloss ?
- does `go get github.com/charmbracelet/x/exp/teatest/v2` resolve cleanly beside our go.mod (pseudo-version of `exp/golden` vs bubbles' tagged `v0.1.0`) ? not run
- `bubbles/tree` stability after the readme section was dropped in v2.2.1 ?
- whether macOS Terminal.app reports 256 colours to colorprofile, i.e. whether the `fmt.Println` gap in §5 is visible on dima's terminals ? (likely not on ghostty/iterm, which advertise truecolor ?)
- `huh/v2/spinner` vs `bubbles/spinner` cost: huh's spins its own bubbletea program — fine for one step, unmeasured for many ?
- wish: v2 exists and is current; no x use case named, so unread beyond `go.mod`
- lane vs base on freeze: base says freeze is wrong for a live tui (it cannot replay an interactive program); the exa lane says it can shoot a tui pane via `tmux capture-pane` — compatible only if read as a still of one frame; base wins, not run
