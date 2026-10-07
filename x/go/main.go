package main

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime/debug"
	"slices"
	"sort"
	"strings"
	"time"

	"charm.land/fang/v2"
	"charm.land/log/v2"
	"github.com/charmbracelet/x/term"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

var exits = map[string]int{"ok": 0, "failed": 1, "usage": 2, "confirm": 4}

type Flags map[string]any

// Impl is the go half of a registry entry: the entry says what a verb takes, this says what it does.
// a verb that publishes or destroys splits into Plan (read-only, the dry run) and Apply
type Impl struct {
	Run    func(r *Run, args []string, flags Flags) (any, error)
	Plan   func(r *Run, args []string, flags Flags) (any, error)
	Apply  func(r *Run, args []string, flags Flags, plan any) (any, error)
	Undone string
	Ask    func(plan any) string
}

var impls = map[string]Impl{
	"lane commit":     {Run: commit, Undone: "nothing was committed"},
	"lane push":       {Plan: pushPlan, Apply: push, Undone: "nothing was pushed", Ask: askPush},
	"lane pr-open":    {Plan: prPlan, Apply: prOpen, Undone: "no pr was opened", Ask: askPR},
	"lane merge-main": {Run: mergeMain, Undone: "nothing was merged"},
	"lane unlock":     {Run: unlock, Undone: "nothing was decrypted"},
	"handoff list":    {Run: handoffList},
	"handoff peek":    {Run: handoffPeek},
	"handoff ingest":  {Run: handoffIngest},
	"handoff write":   {Run: handoffWrite, Undone: "nothing was written"},
	"handoff delete":  {Run: handoffDelete, Undone: "nothing was deleted"},
	"brief check":     {Run: briefCheck, Undone: "nothing was stamped"},
	"as":              {Run: as, Undone: "the command did not run"},
	"linear read":     {Run: linearRead},
	"linear list":     {Run: linearList},
	"linear body":     {Run: linearBody, Undone: "nothing was written"},
	"linear set":      {Run: linearSet, Undone: "nothing was changed"},
	"linear link":     {Run: linearLink, Undone: "no relation was made"},
	"linear comment":  {Run: linearComment, Undone: "nothing was posted"},
	"linear update":   {Run: linearUpdate, Undone: "nothing was posted"},
	"linear api":      {Run: linearAPI},
	"linear push":     {Run: linearPush},
	"linear archive":  {Plan: archivePlanOf, Apply: archiveApply, Undone: "nothing was archived", Ask: askArchive},
	"probe bare":      {Run: probeBare, Undone: "no answer came back"},
	"probe session":   {Run: probeSession, Undone: "the session was not saved"},
	"knowledge list":  {Run: knowledgeList},
	"knowledge read":  {Run: knowledgeRead},
	"schema":          {Run: schema},
	"completion":      {Run: completion},
	"stats":           {Run: stats},
	"trace record":    {Run: traceRecord},
}

// set by -ldflags at build; a dev run falls back to the executable's own tree
var srcDir string

var (
	logger   = log.NewWithOptions(os.Stderr, log.Options{Prefix: "x", Level: logLevel()})
	rootCmd  *cobra.Command
	exitCode int
)

func logLevel() log.Level {
	if os.Getenv("X_DEBUG") != "" {
		return log.DebugLevel
	}
	return log.WarnLevel
}

func main() { os.Exit(execute(os.Args[1:])) }

type mode struct{ json, interactive bool }

func detect(argv []string) mode {
	options := optionsOf(argv)
	asked := slices.Contains(options, "--json") || os.Getenv("CLAUDECODE") != "" || os.Getenv("AI_AGENT") != ""
	// a verb whose human view is raw text stays raw on a pipe: `source <(x completion zsh)` is a pipe
	if words := wordsOf(argv); len(words) > 0 && words[0] == "completion" && !asked {
		return mode{}
	}
	isJSON := asked || !term.IsTerminal(os.Stdout.Fd())
	return mode{json: isJSON, interactive: !isJSON && term.IsTerminal(os.Stdin.Fd())}
}

// the dispatcher writes the trace, so a verb is traced without a line of telemetry in it
func execute(argv []string) (code int) {
	traced = newSpan(argv)
	// cobra's tab completion runs on every Tab press; tracing it would bury the real calls
	if len(argv) > 0 && strings.HasPrefix(argv[0], "__complete") {
		traced.skip = true
	}
	defer func() {
		// a panic is our bug: its stack goes to stderr, the caller still gets an ending and a non-zero exit
		if p := recover(); p != nil {
			fmt.Fprintf(os.Stderr, "panic: %v\n%s", p, debug.Stack())
			code = finishFail(detect(argv), traced.Name, nil, fmt.Errorf("panic: %v", p))
		}
		traced.Exit = code
		traced.write()
	}()
	return dispatchArgv(argv)
}

func dispatchArgv(argv []string) int {
	m := detect(argv)
	if !m.json {
		ui = newTheme()
	}
	options := optionsOf(argv)
	if slices.Contains(options, "--help") || slices.Contains(options, "-h") {
		return help(m, wordsOf(argv))
	}

	rootCmd = buildRoot(m)
	rootCmd.SetArgs(argv)
	err := fang.Execute(context.Background(), rootCmd,
		fang.WithoutCompletions(),
		fang.WithVersion("v1-go"),
		fang.WithNotifySignal(os.Interrupt),
		fang.WithErrorHandler(func(io.Writer, fang.Styles, error) {}),
	)
	if err != nil {
		var fail *Fail
		if !errors.As(err, &fail) {
			fail = &Fail{Msg: err.Error(), Next: "report it to cclio with the command you ran"}
		}
		return finishFail(m, nameOf(wordsOf(argv)), nil, fail)
	}
	return exitCode
}

func buildRoot(m mode) *cobra.Command {
	root := &cobra.Command{
		Use: "x", Short: "the fleet cli", Args: cobra.ArbitraryArgs,
		RunE:              func(_ *cobra.Command, args []string) error { return overview(m, args) },
		CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
	}
	root.SetHelpCommand(&cobra.Command{Hidden: true})
	root.PersistentFlags().Bool("json", false, "json on stdout even on a tty")
	root.SetFlagErrorFunc(func(c *cobra.Command, err error) error {
		return usageFail(flagMessage(c, err), strings.TrimSpace(c.CommandPath()+" --help"))
	})

	groups := map[string]*cobra.Command{}
	for _, verb := range verbs {
		parent := root
		if verb.Short() != "" {
			family := verb.Family()
			if groups[family] == nil {
				groups[family] = &cobra.Command{
					Use: family, Short: familyOf(family).Gist, Args: cobra.ArbitraryArgs, Hidden: !slices.Contains(families(), family),
					RunE: func(_ *cobra.Command, args []string) error {
						return overview(m, append([]string{family}, args...))
					},
				}
				root.AddCommand(groups[family])
			}
			parent = groups[family]
		}
		parent.AddCommand(leaf(m, verb))
	}
	return root
}

func leaf(m mode, verb Verb) *cobra.Command {
	name := verb.Short()
	if name == "" {
		name = verb.Name
	}
	c := &cobra.Command{
		Use: name, Short: gist(verb.Purpose), Args: cobra.ArbitraryArgs, Hidden: verb.Hidden,
		RunE: func(c *cobra.Command, args []string) error {
			flags := Flags{}
			c.Flags().VisitAll(func(f *pflag.Flag) { flags[f.Name] = flagValue(f) })
			exitCode = dispatch(m, verb, args, flags)
			return nil
		},
	}
	if verb.NeedsApply {
		c.Flags().Bool("apply", false, verb.Flags["apply"].Description)
	}
	for _, own := range verb.OwnFlags() {
		spec := verb.Flags[own]
		if spec.Type == "boolean" {
			c.Flags().Bool(own, false, spec.Description)
		} else {
			c.Flags().String(own, "", spec.Description)
		}
	}
	complete(c, verb)
	return c
}

func dispatch(m mode, verb Verb, args []string, flags Flags) int {
	r := &Run{verb: verb, human: !m.json, interactive: m.interactive}
	impl := impls[verb.Name]

	if m.interactive {
		filled, err := askArgs(verb, args)
		if err != nil {
			return finishFail(m, verb.Name, r, err)
		}
		args = filled
	}
	traced.Ids = idsOf(verb, args, flags)
	if err := checkArity(verb, args); err != nil {
		return finishFail(m, verb.Name, r, err)
	}

	if !verb.NeedsApply {
		data, err := impl.Run(r, args, flags)
		if err != nil {
			return finishFail(m, verb.Name, r, err)
		}
		return finishOK(m, verb.Name, r, data)
	}

	plan, err := impl.Plan(r, args, flags)
	if err != nil {
		return finishFail(m, verb.Name, r, err)
	}
	if flags["apply"] != true {
		approved := false
		if m.interactive {
			if approved, err = confirm(r, impl.Ask(plan)); err != nil {
				return finishFail(m, verb.Name, r, err)
			}
		}
		if !approved {
			return finishConfirm(m, verb, r, impl, plan, args, flags)
		}
	}
	data, err := impl.Apply(r, args, flags, plan)
	if err != nil {
		return finishFail(m, verb.Name, r, err)
	}
	return finishOK(m, verb.Name, r, data)
}

func checkArity(verb Verb, args []string) error {
	required := 0
	variadic := false
	for _, arg := range verb.Args {
		if !arg.IsOptional {
			required++
		}
		variadic = variadic || arg.IsVariadic
	}
	if len(args) < required || (!variadic && len(args) > len(verb.Args)) {
		return usageFail("expected "+verb.Usage, "x "+verb.Name+" --help")
	}
	return nil
}

/* Endings */
func finishOK(m mode, name string, r *Run, data any) int {
	if r.passthrough {
		return r.code
	}
	if m.json {
		emit(name, kv{"data", data}, kv{"ok", true}, kv{"status", "ok"})
		return exits["ok"]
	}
	switch {
	case r.opened:
		footer := ""
		if r.next != "" {
			footer = ui.dim.Render("next") + " " + cmd(r.next)
		}
		r.close("done", ui.ok, r.result, elapsed(time.Since(r.started)), footer)
	case r.long != nil:
		// the pager leaves the alt screen; the rules stay behind as a still of what was read
		if err := page(*r.long); err != nil {
			fmt.Println(r.output)
		} else {
			fmt.Println(r.long.top() + "\n" + r.long.bottom())
		}
	case r.output != "":
		fmt.Println(r.output)
	}
	return exits["ok"]
}

func finishConfirm(m mode, verb Verb, r *Run, impl Impl, plan any, args []string, flags Flags) int {
	next := confirmCommand(verb, args, flags)
	if m.json {
		emit(verb.Name, kv{"next", next}, kv{"ok", false}, kv{"plan", plan}, kv{"status", "confirm"})
		return exits["confirm"]
	}
	r.close("stopped", ui.fg, "a dry run; "+impl.Undone, "exit 4", ui.dim.Render("confirm with:")+" "+cmd(next))
	return exits["confirm"]
}

func finishFail(m mode, name string, r *Run, err error) int {
	var fail *Fail
	if !errors.As(err, &fail) {
		fail = &Fail{Msg: err.Error(), Next: "report it to cclio with the command you ran"}
		logger.Error("unexpected", "err", err)
		traced.Kind = "bug"
	} else {
		traced.Kind = fail.kind()
	}
	status := "failed"
	if fail.IsUsage {
		status = "usage"
	}
	if m.json {
		// "the hook output is above" must be true for an agent too: the tool's own words go to stderr
		for _, line := range fail.Log {
			fmt.Fprintln(os.Stderr, line)
		}
		emit(name, kv{"error", fail.Msg}, kv{"next", fail.Next}, kv{"ok", false}, kv{"status", status})
		return exits[status]
	}
	code := fmt.Sprintf("exit %d", exits[status])
	if r != nil && r.opened {
		// a step that failed names itself; a verb that fails after its steps passed names why
		head, _, _ := strings.Cut(fail.Msg, "\n")
		r.close("failed", ui.er, cmp.Or(r.failed, head)+"; "+impls[name].Undone, code, ui.dim.Render("fix, then")+" "+cmd(fail.Next))
		return exits[status]
	}
	title := ui.bold.Render("x")
	if name != "" {
		title = titleOf(name)
	}
	b := frame{width: frameWidth(), titleLeft: title, footLeft: ui.dim.Render("next") + " " + cmd(fail.Next), padRows: true}
	head, rest, _ := strings.Cut(fail.Msg, "\n")
	b.rows = append(b.rows, resultRow(b.inner(), ui.er.Bold(true).Render(status), clip(head, b.inner()-26), code))
	for line := range strings.SplitSeq(rest, "\n") {
		if line != "" {
			b.rows = append(b.rows, strings.Repeat(" ", 16)+ui.fg.Render(clip(line, b.inner()-16)))
		}
	}
	for _, line := range lastLines(fail.Log, 8) {
		b.rows = append(b.rows, strings.Repeat(" ", 16)+ui.dim.Render(line))
	}
	fmt.Fprintln(os.Stderr, b.String())
	return exits[status]
}

/* Envelope */
type kv struct {
	key   string
	value any
}

// key order is the contract's: verb, x, then the rest alphabetically, the way the TS arm prints it
func emit(name string, fields ...kv) {
	var buf bytes.Buffer
	buf.WriteString("{")
	for i, field := range append([]kv{{"verb", name}, {"x", sourceDir()}}, fields...) {
		if i > 0 {
			buf.WriteString(",")
		}
		buf.WriteString(marshal(field.key) + ":" + marshal(field.value))
	}
	buf.WriteString("}\n")
	_, _ = os.Stdout.Write(buf.Bytes())
}

// encoding/json escapes <, > and & by default — `<msg-file>` would print as <msg-file>
func marshal(value any) string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(value); err != nil {
		panic(err)
	}
	return strings.TrimSuffix(buf.String(), "\n")
}

// ordered keeps a json object's keys in the order they were added
type ordered []kv

func (o ordered) MarshalJSON() ([]byte, error) {
	parts := make([]string, len(o))
	for i, field := range o {
		parts[i] = marshal(field.key) + ":" + marshal(field.value)
	}
	return []byte("{" + strings.Join(parts, ",") + "}"), nil
}

func sourceDir() string {
	if srcDir != "" {
		return srcDir
	}
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	exe, _ = filepath.EvalSymlinks(exe)
	return filepath.Dir(filepath.Dir(exe))
}

/* Argv */
func optionsOf(argv []string) []string {
	if end := slices.Index(argv, "--"); end != -1 {
		return argv[:end]
	}
	return argv
}

func wordsOf(argv []string) []string {
	var words []string
	for _, arg := range optionsOf(argv) {
		if !strings.HasPrefix(arg, "-") {
			words = append(words, arg)
		}
	}
	return words
}

func nameOf(words []string) string {
	if verb, _, ok := findVerb(words); ok {
		return verb.Name
	}
	return strings.Join(words, " ")
}

var plainArg = regexp.MustCompile(`^[\w@%+=:,./-]+$`)

func quote(arg string) string {
	if plainArg.MatchString(arg) {
		return arg
	}
	return "'" + strings.ReplaceAll(arg, "'", `'\''`) + "'"
}

func confirmCommand(verb Verb, args []string, flags Flags) string {
	parts := []string{"x", verb.Name, "--apply"}
	for _, own := range verb.OwnFlags() {
		if value, ok := flags[own].(string); ok && value != "" {
			parts = append(parts, "--"+own, quote(value))
		}
	}
	for _, arg := range args {
		parts = append(parts, quote(arg))
	}
	return strings.Join(parts, " ")
}

func flagMessage(c *cobra.Command, err error) string {
	var valid []string
	c.Flags().VisitAll(func(f *pflag.Flag) {
		if f.Name != "version" {
			valid = append(valid, "--"+f.Name)
		}
	})
	sort.Strings(valid)
	return fmt.Sprintf("%s — %s takes %s", err.Error(), strings.TrimPrefix(c.CommandPath(), "x "), strings.Join(valid, ", "))
}

func overview(m mode, words []string) error {
	prefix := strings.Join(words, " ")
	matched := verbsUnder(prefix)
	// a hidden family stays out of the overview and completion, yet its bare name still prints its help
	if len(words) == 1 && len(matched) == 0 {
		for _, verb := range verbs {
			if verb.Family() == words[0] {
				matched = append(matched, verb)
			}
		}
	}
	if len(words) > 0 && len(matched) == 0 {
		family := verbsUnder(words[0])
		if len(family) == 0 {
			exitCode = finishFail(m, prefix, nil, usageFail(
				fmt.Sprintf("no verb or group named %s — the families are %s", prefix, strings.Join(families(), ", ")), "x --help"))
			return nil
		}
		var names []string
		for _, verb := range family {
			names = append(names, verb.Short())
		}
		exitCode = finishFail(m, prefix, nil, usageFail(
			fmt.Sprintf("no verb %s — %s has %s", prefix, words[0], strings.Join(names, ", ")), "x "+words[0]+" --help"))
		return nil
	}

	if m.json {
		groups := ordered{}
		for _, family := range familyList {
			var members []ordered
			for _, verb := range matched {
				if verb.Family() == family.Name {
					members = append(members, ordered{{"name", verb.Name}, {"purpose", verb.Purpose}})
				}
			}
			if members != nil {
				groups = append(groups, kv{family.Name, members})
			}
		}
		emit(prefix, kv{"data", ordered{{"groups", groups}}}, kv{"ok", true}, kv{"status", "ok"})
	} else if len(words) == 0 {
		fmt.Println(overviewBoard())
	} else {
		fmt.Println(familyBoard(words[0], matched))
	}
	exitCode = exits["ok"]
	return nil
}

func help(m mode, words []string) int {
	verb, _, ok := findVerb(words)
	if !ok {
		_ = overview(m, words)
		return exitCode
	}
	if m.json {
		emit(verb.Name, kv{"data", ordered{{"purpose", verb.Purpose}, {"usage", verb.Usage}}}, kv{"ok", true}, kv{"status", "ok"})
		return exits["ok"]
	}
	fmt.Println(verbBoard(verb))
	return exits["ok"]
}

func flagValue(f *pflag.Flag) any {
	if f.Value.Type() == "bool" {
		return f.Value.String() == "true"
	}
	return f.Value.String()
}
