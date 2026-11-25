package main

import (
	"net/http"
	"regexp"
	"strings"
)

// github's own auto-merge is never turned on: a stack cannot take it (gh-stack#504)
const mergeTrailer = "Merged-by: x lane merge-auto"

const renovateExemptTrailer = "Clean-exempt: renovate's own commits, ci is their review"

// the mark of a merge whose commit carries no trailer (github's async merge takes no message)
const mergedLabel = "merged-by-x"

// the mark of a merge that landed another head than the one the gate read: the brake, until dima's typed word
const brakeLabel = "merge-brake"

var prOfSubject = regexp.MustCompile(`\(#(\d+)\)$`)

// a reverted commit is merge-auto's when it carries the trailer, or when github says its pr wears the label
func mergedByX(api string, trailered map[string]bool, key, path string) (bool, error) {
	if trailered[key] {
		return true, nil
	}
	if path == "" {
		return false, nil
	}
	type labelled struct {
		Labels []struct {
			Name string `json:"name"`
		} `json:"labels"`
	}
	var prs []labelled
	var target any = &prs
	var one labelled
	if strings.HasPrefix(path, "/pulls/") {
		target = &one
	}
	status, _, err := ghSend(asDima, http.MethodGet, api+path, nil, target)
	switch {
	case status == http.StatusNotFound:
		return false, nil
	case err != nil:
		return false, err
	}
	if target == &one {
		prs = []labelled{one}
	}
	for _, pr := range prs {
		for _, label := range pr.Labels {
			if label.Name == mergedLabel {
				return true, nil
			}
		}
	}
	return false, nil
}
