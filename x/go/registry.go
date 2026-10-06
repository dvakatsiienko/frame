package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

// the TS arm generates registry.json from its own registry (x schema --level full); go embeds the
// same bytes, so `x schema` is identical across arms and only the run funcs live here
//
//go:embed registry.json
var registryJSON []byte

type ArgSpec struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsOptional  bool   `json:"isOptional"`
	IsVariadic  bool   `json:"isVariadic"`
}

type FlagSpec struct {
	Type        string `json:"type"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

type Verb struct {
	Name       string              `json:"name"`
	Purpose    string              `json:"purpose"`
	Args       []ArgSpec           `json:"args"`
	Flags      map[string]FlagSpec `json:"flags"`
	NeedsApply bool                `json:"needsApply"`
	Usage      string              `json:"usage"`
	Steps      []string            `json:"steps"`
	Raw        json.RawMessage     `json:"-"`
}

var globalFlagNames = []string{"apply", "help", "json"}

var verbs = loadRegistry(registryJSON)

func loadRegistry(raw []byte) []Verb {
	var entries []json.RawMessage
	if err := json.Unmarshal(raw, &entries); err != nil {
		panic(fmt.Sprintf("registry.json: %v", err))
	}
	loaded := make([]Verb, 0, len(entries))
	for _, entry := range entries {
		var verb Verb
		if err := json.Unmarshal(entry, &verb); err != nil {
			panic(fmt.Sprintf("registry.json: %v", err))
		}
		verb.Raw = entry
		loaded = append(loaded, verb)
	}
	return loaded
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

func verbsUnder(prefix string) []Verb {
	var matched []Verb
	for _, verb := range verbs {
		if prefix == "" || verb.Name == prefix || strings.HasPrefix(verb.Name, prefix+" ") {
			matched = append(matched, verb)
		}
	}
	return matched
}

func families() []string {
	var names []string
	for _, verb := range verbs {
		if !slices.Contains(names, verb.Family()) {
			names = append(names, verb.Family())
		}
	}
	return names
}

// the same pattern as registry.ts, so both arms refuse the same purposes
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
