package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"slices"
	"strings"
)

// a probe asks claude from a dir no repo owns, so no CLAUDE.md, project settings or hooks of ours
// answer for it: «is it us or cc?» gets cc alone

type answer struct {
	Result    string  `json:"result"`
	IsError   bool    `json:"is_error"`
	SessionID string  `json:"session_id"`
	CostUSD   float64 `json:"total_cost_usd"`
	MS        int     `json:"duration_ms"`
	Usage     struct {
		Input      int `json:"input_tokens"`
		Output     int `json:"output_tokens"`
		CacheRead  int `json:"cache_read_input_tokens"`
		CacheWrite int `json:"cache_creation_input_tokens"`
	} `json:"usage"`
	ModelUsage map[string]json.RawMessage `json:"modelUsage"`
}

func (a answer) model() string {
	models := make([]string, 0, len(a.ModelUsage))
	for model := range a.ModelUsage {
		models = append(models, model)
	}
	slices.Sort(models)
	return strings.Join(models, ", ")
}

func (a answer) data() ordered {
	tokens := ordered{{"cacheRead", a.Usage.CacheRead}, {"cacheWrite", a.Usage.CacheWrite}, {"input", a.Usage.Input}, {"output", a.Usage.Output}}
	return ordered{{"answer", a.Result}, {"costUsd", a.CostUSD}, {"model", a.model()}, {"ms", a.MS}, {"sessionId", a.SessionID}, {"tokens", tokens}}
}

func (a answer) summary() string {
	tokens := a.Usage.Input + a.Usage.Output + a.Usage.CacheRead + a.Usage.CacheWrite
	return fmt.Sprintf("%s, $%.3f, %.1fs, %.1fk tokens", a.model(), a.CostUSD, float64(a.MS)/1000, float64(tokens)/1000)
}

// the parent session's markers would tell the child it runs inside an agent
func probeEnv() []string {
	return slices.DeleteFunc(os.Environ(), func(pair string) bool {
		return strings.HasPrefix(pair, "CLAUDECODE=") || strings.HasPrefix(pair, "AI_AGENT=")
	})
}

func ask(r *Run, dir, model string, argv []string) (answer, error) {
	var got answer
	err := r.Step("ask", "asking "+model, func() (string, error) {
		c := exec.Command("claude", append([]string{"-p", "--model", model, "--output-format", "json"}, argv...)...)
		c.Dir, c.Env = dir, probeEnv()
		out, _ := runCmd(c)
		if err := json.Unmarshal([]byte(out.out), &got); err != nil || got.SessionID == "" {
			return "", &Fail{Msg: "claude -p gave no json answer — its output is above", Next: "claude --version", Log: nonBlank(out.log)}
		}
		if got.IsError {
			return "", &Fail{Msg: "claude answered with an error: " + firstLine(got.Result), Next: "claude --version", Log: nonBlank(got.Result)}
		}
		return got.summary(), nil
	})
	if err == nil && r.human {
		r.Show(markdown(got.Result, r.board.inner()-nameCell-2), nameCell+2)
	}
	return got, err
}

func probeBare(r *Run, args []string, flags Flags) (any, error) {
	picked, _ := flags["model"].(string)
	model := cmp.Or(picked, "haiku")
	dir, err := os.MkdirTemp("", "x-probe-")
	if err != nil {
		return nil, err
	}
	// an empty dir of ours; a session that wrote into it keeps its files
	defer os.Remove(dir)
	r.Open("no setup, " + model)
	got, err := ask(r, dir, model, []string{"--safe-mode", "--strict-mcp-config", "--no-session-persistence", "--", args[0]})
	if err != nil {
		return nil, err
	}
	r.Done(got.summary(), "")
	return append(got.data(), kv{"cwd", dir}), nil
}
