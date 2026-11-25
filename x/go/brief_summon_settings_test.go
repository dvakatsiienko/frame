package main

import (
	"cmp"
	"encoding/json"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
)

// dima's pick (o22): a lane member starts with cc's prompt suggestions off, in the one --settings json its argv carries
func TestBriefSummonSwitchesPromptSuggestionsOffForALaneMember(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, settings string
		want           map[string]any
	}{
		{"no --settings of its own", "", map[string]any{"promptSuggestionEnabled": false}},
		{"a quick lane's worktree setting gets the key merged in", ` --settings '{"worktree":{"bgIsolation":"none"}}'`, map[string]any{"worktree": map[string]any{"bgIsolation": "none"}, "promptSuggestionEnabled": false}},
		{"a value the command gave stays", ` --settings '{"promptSuggestionEnabled":true}'`, map[string]any{"promptSuggestionEnabled": true}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			command := strings.Replace(codieArgv(w.repo, w.brief(t, goodBrief, true)), "--model opus", "--model opus"+c.settings, 1)

			got := w.summon(t, command, "X_THREADS="+filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS="+t.TempDir())

			argv, _ := got.data["argv"].(string)
			flags := regexp.MustCompile(`--settings '([^']*)'`).FindAllStringSubmatch(argv, -1)
			var settings map[string]any
			if len(flags) == 1 {
				_ = json.Unmarshal([]byte(flags[0][1]), &settings)
			}
			if got.code != 0 || len(flags) != 1 || !reflect.DeepEqual(settings, c.want) {
				t.Errorf("exit %d, %d --settings flags, json %v, want one flag holding %v:\n%s", got.code, len(flags), settings, c.want, argv)
			}
		})
	}
}

// a --settings value that is a file is read and merged into the one inline flag that replaces it; one that does not read or parse refuses
func TestBriefSummonMergesASettingsFileIntoOneInlineFlag(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, file, content, quote string
		want                       map[string]any
		isRefused                  bool
	}{
		{"a file path", "lane-settings.json", `{"worktree":{"bgIsolation":"none"}}`, "", map[string]any{"worktree": map[string]any{"bgIsolation": "none"}, "promptSuggestionEnabled": false}, false},
		{"a quoted path with a space", "lane settings.json", `{"worktree":{"bgIsolation":"none"}}`, "'", map[string]any{"worktree": map[string]any{"bgIsolation": "none"}, "promptSuggestionEnabled": false}, false},
		{"a file the command gave the key in stays", "lane-settings.json", `{"promptSuggestionEnabled":true}`, "", map[string]any{"promptSuggestionEnabled": true}, false},
		{"a file that is no json", "lane-settings.json", `not json`, "", nil, true},
		{"a file that is not there", "", "", "", nil, true},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			file := filepath.Join(t.TempDir(), cmp.Or(c.file, "gone.json"))
			if c.file != "" {
				write(t, file, c.content)
			}
			command := strings.Replace(codieArgv(w.repo, w.brief(t, goodBrief, true)), "--model opus", "--model opus --settings "+c.quote+file+c.quote, 1)

			got := w.summon(t, command, "X_THREADS="+filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS="+t.TempDir())

			if c.isRefused {
				if got.code != 2 || !strings.Contains(jsonOf(got.data["error"])+got.stdout, file) {
					t.Errorf("exit %d, want a usage refusal naming %s:\n%s", got.code, file, got.stdout)
				}
				return
			}
			argv, _ := got.data["argv"].(string)
			flags := regexp.MustCompile(`--settings '([^']*)'`).FindAllStringSubmatch(argv, -1)
			var settings map[string]any
			if len(flags) == 1 {
				_ = json.Unmarshal([]byte(flags[0][1]), &settings)
			}
			if got.code != 0 || len(flags) != 1 || strings.Count(argv, "--settings") != 1 || !reflect.DeepEqual(settings, c.want) {
				t.Errorf("exit %d, %d inline flags, json %v, want one flag holding %v:\n%s", got.code, len(flags), settings, c.want, argv)
			}
		})
	}
}

// inline json that is broken still refuses, never read as a file
func TestBriefSummonRefusesBrokenInlineSettingsJson(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	command := strings.Replace(codieArgv(w.repo, w.brief(t, goodBrief, true)), "--model opus", `--model opus --settings '{"worktree":'`, 1)

	got := w.summon(t, command, "X_THREADS="+filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS="+t.TempDir())

	if got.code != 2 || !strings.Contains(got.stdout, "does not parse") {
		t.Errorf("exit %d, want a usage refusal saying the json does not parse:\n%s", got.code, got.stdout)
	}
}

func TestBriefSummonSwitchesPromptSuggestionsOffForCrowAndHelgaOnly(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		role, name string
		isOff      bool
	}{
		{"adviser", "🐦‍⬛ crow", true},
		{"copyist", "🎀 helga", true},
		{"coordinator", "🦉 clio", false},
		{"wing:2", "🦉🪽 clio: wing 2", false},
	} {
		t.Run(c.role, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)

			got := w.summonStanding(t, "coordinator", []string{"X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS=" + t.TempDir()}, "--role", c.role, paneArgv(w, c.name))

			argv, _ := got.data["argv"].(string)
			if got.code != 0 || strings.Contains(argv, `--settings '{"promptSuggestionEnabled":false}'`) != c.isOff || strings.Count(argv, "--settings") > 1 {
				t.Errorf("exit %d, argv %q, want the suggestions switched off: %v", got.code, argv, c.isOff)
			}
		})
	}
}
