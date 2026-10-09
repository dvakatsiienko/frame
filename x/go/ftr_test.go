package main

import (
	"path/filepath"
	"testing"
)

// ftrApp plants an app with its FTR.md committed, and a message ending in the Agent trailer
func ftrApp(t *testing.T) (dir, msg string) {
	t.Helper()
	dir = repo(t)
	write(t, filepath.Join(dir, "app/FTR.md"), "# app — features\n")
	write(t, filepath.Join(dir, "app/main.ts"), "export const a = 1;\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "app")
	msg = filepath.Join(t.TempDir(), "msg.txt")
	write(t, msg, "🐞 app: a fix\n\n- ticket: FRM-1\n\nAgent: coder · fixture\n")
	return dir, msg
}

func TestCommitAddsFtrNoneWhenTheAppsFtrDidNotMove(t *testing.T) {
	dir, msg := ftrApp(t)
	write(t, filepath.Join(dir, "app/main.ts"), "export const a = 2;\n")

	got := xIn(t, dir, nil, "lane", "commit", msg, "--", "app/main.ts")

	body := gitT(t, dir, "log", "-1", "--format=%B")
	if want := "🐞 app: a fix\n\n- ticket: FRM-1\n\nftr: none\n\nAgent: coder · fixture"; got.code != 0 || body != want {
		t.Fatalf("exit %d, body %q\n%s", got.code, body, got.stdout)
	}
	if read(t, msg) != "🐞 app: a fix\n\n- ticket: FRM-1\n\nAgent: coder · fixture\n" {
		t.Error("the caller's message file changed")
	}
}

func TestCommitAddsNothingWhenTheFtrMoves(t *testing.T) {
	dir, msg := ftrApp(t)
	write(t, filepath.Join(dir, "app/main.ts"), "export const a = 2;\n")
	write(t, filepath.Join(dir, "app/FTR.md"), "# app — features\n\n- ✅ a is two\n")

	got := xIn(t, dir, nil, "lane", "commit", msg, "--", "app/main.ts", "app/FTR.md")

	if body := gitT(t, dir, "log", "-1", "--format=%B"); got.code != 0 || body != "🐞 app: a fix\n\n- ticket: FRM-1\n\nAgent: coder · fixture" {
		t.Fatalf("exit %d, body %q", got.code, body)
	}
}

func TestWithFtrNoneKeepsTheTrailerLast(t *testing.T) {
	cases := []struct{ name, in, want string }{
		{"a subject only", "fix\n", "fix\n\nftr: none\n"},
		{"a body with no trailer", "fix\n\n- what\n", "fix\n\n- what\n\nftr: none\n"},
		{"a trailer paragraph", "fix\n\n- what\n\nAgent: coder · x\n", "fix\n\n- what\n\nftr: none\n\nAgent: coder · x\n"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := withFtrNone(c.in); got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}
