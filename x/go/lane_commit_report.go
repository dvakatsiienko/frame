package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

type commitDone struct {
	sha, tree string
	present   []string
	aside     *held
	bumped    *bumpTarget
	waited    time.Duration
}

func reportCommit(r *Run, done commitDone) (any, error) {
	branch, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	r.Done(fmt.Sprintf("%s on %s, %s", short(done.sha), branch.out, plural(len(done.present), "path")), "x lane push --apply")
	data := append(ordered{{"branch", branch.out}, {"sha", done.sha}, {"tree", done.tree}}, done.aside.leftForPeers()...)
	if said := withWait(done.waited, ""); said != "" {
		data = append(data, kv{"waited", said})
	}
	if done.bumped == nil {
		// a reminder, never a refusal: a plugin edit can wait for a later bump on purpose
		if plugins := unbumpedPlugins(done.tree, done.present); len(plugins) > 0 {
			var bumps []string
			for _, plugin := range plugins {
				bumps = append(bumps, "x plugin bump "+plugin+" --apply")
			}
			reminder := strings.Join(plugins, ", ") + " changed without --bump; the install keeps the old copy until a bump: " + strings.Join(bumps, ", ")
			r.Done(fmt.Sprintf("%s on %s, %s; %s", short(done.sha), branch.out, plural(len(done.present), "path"), reminder), "x lane push --apply")
			data = append(data, kv{"reminder", reminder})
		}
		return data, nil
	}
	data = append(data, kv{"bump", ordered{{"name", done.bumped.name}, {"from", done.bumped.from}, {"to", done.bumped.to}}})
	if done.bumped.market == "" {
		r.skip("refresh")
		return data, nil
	}
	// the commit stands whatever the refresh says: its fail names the claude call to run again
	var cache string
	if err := r.Step("refresh", "the plugin's marketplace and install", func() (string, error) {
		found, err := refreshPlugin(done.bumped.name+"@"+done.bumped.market, done.bumped.market, done.bumped.to)
		cache = found
		return home(cache), err
	}); err != nil {
		return nil, err
	}
	older := olderCopies(filepath.Dir(cache), done.bumped.to)
	reload := reloadLine(done.bumped.name, done.bumped.to, older)
	r.Done(short(done.sha)+" on "+branch.out+", "+reload, "/reload-plugins")
	return append(data, kv{"cache", cache}, kv{"reload", "/reload-plugins"}, kv{"older", older}, kv{"message", reload}), nil
}
