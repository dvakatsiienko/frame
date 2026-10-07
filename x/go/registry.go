package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"maps"
	"regexp"
	"slices"
	"strings"
)

// registry.json holds what only a human can write — names, purposes, args, a verb's own flags, its
// steps; the global flags, the exit codes and the usage line are derived here, so they never drift
//
//go:embed registry.json
var registryJSON []byte

type ArgSpec struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsOptional  bool   `json:"isOptional,omitempty"`
	IsVariadic  bool   `json:"isVariadic,omitempty"`
}

type FlagSpec struct {
	Type        string `json:"type"`
	Value       string `json:"value,omitempty"`
	Description string `json:"description"`
}

type Verb struct {
	Name       string              `json:"name"`
	Purpose    string              `json:"purpose"`
	Args       []ArgSpec           `json:"args"`
	Flags      map[string]FlagSpec `json:"flags"`
	NeedsApply bool                `json:"needsApply"`
	Hidden     bool                `json:"hidden,omitempty"`
	Steps      []string            `json:"steps"`
	Usage      string              `json:"usage"`
	// what the verb reads or writes outside the repo, so a fixer finds what the door hides
	Touches []string `json:"touches,omitempty"`
	// the files and script names this verb took over; a contract test is red while one exists or is called
	Replaces []string `json:"replaces,omitempty"`
}

// a family owns a colour (its place in this list), a one-line gist and the example its help shows
type Family struct {
	Name    string `json:"name"`
	Gist    string `json:"gist"`
	Example string `json:"example"`
	// a proxying family's passthrough when no verb fits, and whose token its verbs act with
	RawDoor  string `json:"rawDoor,omitempty"`
	Identity string `json:"identity,omitempty"`
}

var globalFlags = map[string]FlagSpec{
	"apply": {Type: "boolean", Description: "run a verb that publishes or destroys; without it the verb prints its plan and exits 4"},
	"help":  {Type: "boolean", Description: "print the verb help"},
	"json":  {Type: "boolean", Description: "json on stdout even on a tty"},
}

var globalFlagNames = []string{"apply", "help", "json"}

var familyList, verbs = loadRegistry(registryJSON)

func loadRegistry(raw []byte) ([]Family, []Verb) {
	var source struct {
		Families []Family `json:"families"`
		Verbs    []Verb   `json:"verbs"`
	}
	if err := json.Unmarshal(raw, &source); err != nil {
		panic(fmt.Sprintf("registry.json: %v", err))
	}
	for i := range source.Verbs {
		verb := &source.Verbs[i]
		if verb.Args == nil {
			verb.Args = []ArgSpec{}
		}
		if verb.Steps == nil {
			verb.Steps = []string{}
		}
		own := verb.Flags
		verb.Flags = maps.Clone(globalFlags)
		maps.Copy(verb.Flags, own)
		// --apply means «publish or destroy»; a verb that does neither never offers it
		if !verb.NeedsApply {
			delete(verb.Flags, "apply")
		}
		verb.Usage = usageOf(*verb)
	}
	return source.Families, source.Verbs
}

func usageOf(verb Verb) string {
	parts := []string{"x", verb.Name}
	if verb.NeedsApply {
		parts = append(parts, "[--apply]")
	}
	for _, own := range verb.OwnFlags() {
		if spec := verb.Flags[own]; spec.Type == "string" {
			parts = append(parts, fmt.Sprintf("[--%s <%s>]", own, spec.Value))
		} else {
			parts = append(parts, "[--"+own+"]")
		}
	}
	for _, arg := range verb.Args {
		name := "<" + arg.Name + ">"
		if arg.IsVariadic {
			name = "<" + arg.Name + "…>"
		}
		if arg.IsOptional {
			name = "[" + name + "]"
		}
		parts = append(parts, name)
	}
	return strings.Join(parts, " ")
}

// the whole schema of a verb, the shape `x schema` prints
func (v Verb) Schema() ordered {
	schema := ordered{{"args", v.Args}, {"exits", ordered{{"confirm", 4}, {"failed", 1}, {"ok", 0}, {"usage", 2}}},
		{"flags", v.Flags}, {"name", v.Name}, {"needsApply", v.NeedsApply}, {"purpose", v.Purpose}}
	if v.Replaces != nil {
		schema = append(schema, kv{"replaces", v.Replaces})
	}
	schema = append(schema, kv{"source", sourceDir()}, kv{"steps", v.Steps})
	if v.Touches != nil {
		schema = append(schema, kv{"touches", v.Touches})
	}
	return append(schema, kv{"usage", v.Usage})
}

func familyOf(name string) Family {
	for _, family := range familyList {
		if family.Name == name {
			return family
		}
	}
	return Family{Name: name}
}

func (v Verb) Family() string { return strings.Fields(v.Name)[0] }

// the word after the family, or "" for a one-word verb like `schema`
func (v Verb) Short() string {
	_, rest, _ := strings.Cut(v.Name, " ")
	return rest
}

// flags the verb adds beside the global three
func (v Verb) OwnFlags() []string {
	var own []string
	for name := range v.Flags {
		if !slices.Contains(globalFlagNames, name) {
			own = append(own, name)
		}
	}
	slices.Sort(own)
	return own
}

func findVerb(words []string) (Verb, int, bool) {
	var found Verb
	depth := 0
	for _, verb := range verbs {
		parts := strings.Fields(verb.Name)
		if len(parts) > len(words) || len(parts) <= depth {
			continue
		}
		if slices.Equal(parts, words[:len(parts)]) {
			found, depth = verb, len(parts)
		}
	}
	return found, depth, depth > 0
}

// a hidden verb is listed only when named in full
func verbsUnder(prefix string) []Verb {
	var matched []Verb
	for _, verb := range verbs {
		if verb.Name == prefix || !verb.Hidden && (prefix == "" || strings.HasPrefix(verb.Name, prefix+" ")) {
			matched = append(matched, verb)
		}
	}
	return matched
}

// the families with a verb anyone may list
func families() []string {
	var names []string
	for _, family := range familyList {
		if len(verbsUnder(family.Name)) > 0 {
			names = append(names, family.Name)
		}
	}
	return names
}

// a purpose is what an agent picks a verb by; a vague one is the top tool-description smell (arxiv 2602.14878)
var vagueWord = regexp.MustCompile(`(?i)\b(todo|tbd|stuff|things|various|handles?|manages?)\b`)

func lintPurpose(verb Verb) []string {
	var problems []string
	words := strings.Fields(verb.Purpose)
	nameWords := strings.FieldsFunc(verb.Name, func(r rune) bool { return r == ' ' || r == '-' })
	if len(words) < 5 {
		problems = append(problems, "purpose under 5 words — say what it does and to what")
	}
	if len(verb.Purpose) > 120 {
		problems = append(problems, "purpose over 120 chars — one line")
	}
	if !slices.ContainsFunc(words, func(word string) bool { return !slices.Contains(nameWords, word) }) {
		problems = append(problems, "purpose only restates the name")
	}
	if vagueWord.MatchString(verb.Purpose) {
		problems = append(problems, "purpose uses a vague word — name the effect")
	}
	return problems
}
