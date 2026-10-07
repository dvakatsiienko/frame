package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/spf13/cobra"
)

// completion is derived from the registry: each arg and flag completes by its name, so a new verb
// whose args reuse a name completes with no edit here. a name missing from both maps offers files
type completer func(verb Verb, done []string) ([]string, cobra.ShellCompDirective)

const none = cobra.ShellCompDirectiveNoFileComp

func fixed(values ...string) completer {
	return func(Verb, []string) ([]string, cobra.ShellCompDirective) { return values, none }
}

func files(exts ...string) completer {
	return func(Verb, []string) ([]string, cobra.ShellCompDirective) {
		if len(exts) == 0 {
			return nil, cobra.ShellCompDirectiveDefault
		}
		return exts, cobra.ShellCompDirectiveFilterFileExt
	}
}

var argCompleters = map[string]completer{
	"slug":     func(Verb, []string) ([]string, cobra.ShellCompDirective) { return pendingSlugs(), none },
	"shell":    fixed("zsh", "bash", "fish"),
	"brief":    files("md"),
	"settings": files("json"),
	"prompt":   fixed(),
	"title":    fixed(),
	"verb":     schemaWords,
	"name": func(verb Verb, _ []string) ([]string, cobra.ShellCompDirective) {
		if verb.Family() == "knowledge" {
			return shelfNames(), none
		}
		return probeNames(), none
	},
}

var flagCompleters = map[string]completer{
	"for":      fixed(audiences...),
	"audience": fixed(audiences...),
	"lane":     fixed("pm", "code", "research", "design"),
	"replaces": func(Verb, []string) ([]string, cobra.ShellCompDirective) { return pendingSlugs(), none },
	"level":    fixed("short", "full"),
	"model":    fixed("haiku", "sonnet", "opus", "fable"),
	"repo": func(Verb, []string) ([]string, cobra.ShellCompDirective) {
		return nil, cobra.ShellCompDirectiveFilterDirs
	},
}

func complete(c *cobra.Command, verb Verb) {
	c.ValidArgsFunction = func(_ *cobra.Command, done []string, _ string) ([]string, cobra.ShellCompDirective) {
		at := len(done)
		if len(verb.Args) == 0 {
			return nil, none
		}
		arg := verb.Args[min(at, len(verb.Args)-1)]
		if at >= len(verb.Args) && !arg.IsVariadic {
			return nil, none
		}
		if fill, ok := argCompleters[arg.Name]; ok {
			return fill(verb, done)
		}
		return nil, cobra.ShellCompDirectiveDefault
	}
	for _, name := range verb.OwnFlags() {
		if fill, ok := flagCompleters[name]; ok {
			_ = c.RegisterFlagCompletionFunc(name, func(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
				return fill(verb, nil)
			})
		}
	}
}

// `x schema <tab>` offers the families, `x schema lane <tab>` that family's verbs
func schemaWords(_ Verb, done []string) ([]string, cobra.ShellCompDirective) {
	if len(done) == 0 {
		return families(), none
	}
	var words []string
	for _, verb := range verbsUnder(strings.Join(done, " ")) {
		if parts := strings.Fields(verb.Name); len(parts) > len(done) {
			words = append(words, parts[len(done)])
		}
	}
	return slices.Compact(words), none
}

func probeNames() []string {
	dirs, _ := os.ReadDir(filepath.Join(stateDir(), "probes"))
	var names []string
	for _, dir := range dirs {
		if dir.IsDir() {
			names = append(names, dir.Name())
		}
	}
	return names
}
