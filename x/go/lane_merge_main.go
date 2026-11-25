package main

import (
	"strings"
)

func mergeMain(r *Run, _ []string, _ Flags) (any, error) {
	name, err := branch()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	// git stops a merge over staged work with a line that names no file; the order out of it is said here, before anything moves
	if unmerged, _ := git("diff", "--name-only", "--diff-filter=U"); isMerging() && unmerged.out != "" {
		files := strings.Split(unmerged.out, "\n")
		return nil, &Fail{Refused: true, Msg: "a merge of main is under way, with conflicts: " + strings.Join(files, ", ") + "; nothing was fetched or merged",
			Next: "resolve them, then x lane commit <msg-file> -- <resolved paths>", Log: files}
	}
	if staged, _ := git("diff", "--cached", "--name-only"); staged.out != "" {
		var quoted []string
		for path := range strings.SplitSeq(staged.out, "\n") {
			quoted = append(quoted, quote(path))
		}
		files := strings.Join(quoted, " ")
		return nil, &Fail{Refused: true, Msg: "staged work blocks the merge: " + strings.ReplaceAll(staged.out, "\n", ", ") + "; nothing was fetched or merged",
			Next: "x lane commit <msg-file> -- " + files + ", then x lane merge-main again"}
	}
	if err := r.Step("fetch", "git fetch origin main", func() (string, error) {
		_, err := mustGit("fetch", "fetch", "-q", "origin", "main")
		return "origin/main", err
	}); err != nil {
		return nil, err
	}
	var sha string
	if err := r.Step("merge", "merging origin/main", func() (string, error) {
		merged, _ := git("merge", "--no-edit", "origin/main")
		if !merged.ok {
			conflicts, _ := git("diff", "--name-only", "--diff-filter=U")
			if conflicts.out == "" {
				return "", &Fail{Msg: "merge failed without conflicts: " + gitReason(merged.log), Next: "git status", Log: nonBlank(merged.log)}
			}
			files := strings.Split(conflicts.out, "\n")
			return "", &Fail{Msg: "conflicts: " + strings.Join(files, ", "),
				Next: "resolve them, then x lane commit <msg-file> -- <resolved paths>", Log: files}
		}
		var err error
		sha, err = head()
		return "HEAD is " + short(sha), err
	}); err != nil {
		return nil, err
	}
	r.Done(short(sha)+" on "+name+", main merged in", "x lane push --apply")
	return ordered{{"sha", sha}}, nil
}

// gitReason is the line git leads its refusal with, so an envelope reader needs no stderr
func gitReason(log string) string {
	lines := nonBlank(log)
	for i, line := range lines {
		if strings.HasPrefix(line, "error: ") || strings.HasPrefix(line, "fatal: ") {
			// a reason ending in «:» names its files on the next line
			if strings.HasSuffix(line, ":") && i+1 < len(lines) {
				return line + " " + strings.TrimSpace(lines[i+1])
			}
			return line
		}
	}
	if len(lines) == 0 {
		return "git printed nothing"
	}
	return lines[len(lines)-1]
}
