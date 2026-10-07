package main

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// a fake tool that writes the env var it was handed to a file, so x's own output stays separate from it
func fakeTool(t *testing.T, bin, name, envName string) string {
	t.Helper()
	seen := filepath.Join(t.TempDir(), name+".env")
	write(t, filepath.Join(bin, name), "#!/bin/sh\nprintf '%s' \"$"+envName+"\" > '"+seen+"'\nexit ${FAKE_EXIT:-0}\n")
	if err := os.Chmod(filepath.Join(bin, name), 0o755); err != nil {
		t.Fatal(err)
	}
	return seen
}

func keysFixture(t *testing.T, entries map[string]string) string {
	t.Helper()
	raw, _ := json.Marshal(entries)
	path := filepath.Join(t.TempDir(), "keys.json")
	write(t, path, string(raw))
	return path
}

type asRun struct {
	stdout, stderr, trace string
	code                  int
}

func runAs(t *testing.T, env []string, argv ...string) asRun {
	t.Helper()
	state := t.TempDir()
	cmd := exec.Command(xbin, argv...)
	// the test's own env comes last, so it can point X_STATE at a dir shared across calls
	cmd.Env = append(append(cleanEnv(), "X_TEST=1", "X_TRACE=1", "X_STATE="+state), env...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	code := exitOf(cmd.Run())
	traces, _ := filepath.Glob(filepath.Join(state, "traces", "*.jsonl"))
	trace := ""
	for _, file := range traces {
		trace += read(t, file)
	}
	return asRun{stdout.String(), stderr.String(), trace, code}
}

const farFuture = "4102444800" // 2100-01-01

func TestAsHandsTheMemberTokenToTheChildOnly(t *testing.T) {
	cases := []struct {
		name, member, tool, envName, key, token string
	}{
		{"coder on linear", "coder", "linear", "LINEAR_API_KEY", "keychain:x-token-linear-coder:x", "tok-linear-coder"},
		{"cclio on linear", "cclio", "linear", "LINEAR_API_KEY", "keychain:x-token-linear-cclio:x", "tok-linear-cclio"},
		{"dima on linear", "dima", "linear", "LINEAR_API_KEY", "op://dev/linear-golden/credential", "lin_api_dima"},
		{"coder on gh", "coder", "gh", "GH_TOKEN", "keychain:x-token-gh-x-coder:x", "ghs_coder"},
		{"cclio on gh", "cclio", "gh", "GH_TOKEN", "keychain:x-token-gh-x-cclio-cc:x", "ghs_cclio"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			bin := t.TempDir()
			seen := fakeTool(t, bin, c.tool, c.envName)
			// a cached app token carries its expiry; dima's 1password key is the bare value
			value := farFuture + ":" + c.token
			if strings.HasPrefix(c.key, "op://") {
				value = c.token
			}
			keys := keysFixture(t, map[string]string{c.key: value})
			got := runAs(t, []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_KEYS=" + keys, c.envName + "=inherited"},
				"as", c.member, "--", c.tool, "issue", "view", "FRM-1")
			if got.code != 0 {
				t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
			}
			if child := read(t, seen); child != c.token {
				t.Errorf("child saw %s=%q, want %q", c.envName, child, c.token)
			}
			for where, text := range map[string]string{"stdout": got.stdout, "stderr": got.stderr, "trace": got.trace} {
				if strings.Contains(text, c.token) {
					t.Errorf("the token leaked onto x's %s: %q", where, text)
				}
			}
			if !strings.Contains(got.trace, `"x.actor":"`+c.member+`"`) {
				t.Errorf("the trace does not name the actor %s: %s", c.member, got.trace)
			}
		})
	}
}

func TestAsMintsALinearTokenWhenTheCacheRunsOut(t *testing.T) {
	var form url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		form = r.PostForm
		_, _ = w.Write([]byte(`{"access_token":"tok-fresh","expires_in":2592000}`))
	}))
	defer server.Close()
	bin := t.TempDir()
	seen := fakeTool(t, bin, "linear", "LINEAR_API_KEY")
	keys := keysFixture(t, map[string]string{"keychain:x-token-linear-coder:x": "1:tok-stale",
		"keychain:linear-coder-id:coder": "client-id", "keychain:linear-coder-secret:coder": "client-secret"})
	got := runAs(t, []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_KEYS=" + keys, "X_LINEAR_URL=" + server.URL},
		"as", "coder", "--", "linear", "api", "query")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if child := read(t, seen); child != "tok-fresh" {
		t.Errorf("child saw %q, want the minted token", child)
	}
	if form.Get("client_secret") != "client-secret" || form.Get("grant_type") != "client_credentials" || form.Get("scope") == "" {
		t.Errorf("the mint sent %v", form)
	}
	if cache := read(t, keys); !strings.Contains(cache, ":tok-fresh") {
		t.Errorf("the minted token was not cached: %s", cache)
	}
}

func TestAsNeverCachesATokenTheKeychainWouldSplit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"access_token":"tok with space","expires_in":2592000}`))
	}))
	defer server.Close()
	bin := t.TempDir()
	seen := fakeTool(t, bin, "linear", "LINEAR_API_KEY")
	keys := keysFixture(t, map[string]string{"keychain:linear-coder-id:coder": "id", "keychain:linear-coder-secret:coder": "secret"})
	got := runAs(t, []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_KEYS=" + keys, "X_LINEAR_URL=" + server.URL},
		"as", "coder", "--", "linear", "api", "query")
	if got.code != 0 || read(t, seen) != "tok with space" {
		t.Fatalf("exit %d, child saw %q", got.code, read(t, seen))
	}
	if cache := read(t, keys); strings.Contains(cache, "x-token-linear-coder") {
		t.Errorf("a token with a space was cached: %s", cache)
	}
}

func TestAsMintsAGithubTokenWithASignedAppJWT(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	encoded := base64.StdEncoding.EncodeToString(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}))
	var verifyErr error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "), ".")
		if len(parts) != 3 {
			verifyErr = fmt.Errorf("not a jwt: %q", r.Header.Get("Authorization"))
		} else {
			signature, _ := base64.RawURLEncoding.DecodeString(parts[2])
			digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
			if err := rsa.VerifyPKCS1v15(&key.PublicKey, crypto.SHA256, digest[:], signature); err != nil {
				verifyErr = err
			}
		}
		switch r.URL.Path {
		case "/app/installations":
			_, _ = w.Write([]byte(`[{"id":77}]`))
		case "/app/installations/77/access_tokens":
			_, _ = w.Write([]byte(`{"token":"ghs_fresh","expires_at":"2100-01-01T00:00:00Z"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	bin := t.TempDir()
	seen := fakeTool(t, bin, "gh", "GH_TOKEN")
	keys := keysFixture(t, map[string]string{"keychain:github-x-coder-id:x-coder": "4873606", "keychain:github-x-coder-key:x-coder": encoded})
	got := runAs(t, []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_KEYS=" + keys, "X_GITHUB_URL=" + server.URL},
		"as", "coder", "--", "gh", "pr", "view")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if verifyErr != nil {
		t.Errorf("the app jwt does not verify against the app key: %v", verifyErr)
	}
	if child := read(t, seen); child != "ghs_fresh" {
		t.Errorf("child saw %q, want the installation token", child)
	}
}

func TestAsDimaOnGhRunsOnHisOwnLogin(t *testing.T) {
	bin := t.TempDir()
	seen := fakeTool(t, bin, "gh", "GH_TOKEN")
	got := runAs(t, []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_KEYS=" + keysFixture(t, map[string]string{}), "GH_TOKEN=ghs_an_app"},
		"as", "dima", "--", "gh", "pr", "view")
	if got.code != 0 || read(t, seen) != "" {
		t.Errorf("exit %d, child saw GH_TOKEN=%q — an inherited app token would act for dima", got.code, read(t, seen))
	}
}

// the shapes linear, github and an app key take when real — a pem header of any kind, and its base64
// form (`LS0tLS1CRUdJTi…`), the one the keychain holds; a fixture's short fake never matches
var keyShapes = regexp.MustCompile(`lin_api_[A-Za-z0-9]{40}|lin_oauth_[A-Za-z0-9]{40,}|gh[spo]_[A-Za-z0-9]{36}|-----BEGIN [A-Z ]*PRIVATE KEY-----(?:\\n|\s)+[A-Za-z0-9+/=]{40}|LS0tLS1CRUdJTi[A-Za-z0-9+/=]{20,}`)

func TestNoKeyLivesInARepoFile(t *testing.T) {
	root, _ := filepath.Abs("../..")
	cmd := exec.Command("git", "ls-files", "-z")
	cmd.Dir, cmd.Env = root, cleanEnv()
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("git ls-files: %v", err)
	}
	for file := range strings.SplitSeq(strings.TrimRight(string(out), "\x00"), "\x00") {
		raw, err := os.ReadFile(filepath.Join(root, file))
		if err != nil || bytes.IndexByte(raw, 0) >= 0 {
			continue // gone from the tree, or binary
		}
		// the redact mod's fixtures spell FAKE inside a real key's shape on purpose
		for _, found := range keyShapes.FindAll(raw, -1) {
			if !bytes.Contains(found, []byte("FAKE")) {
				t.Errorf("%s holds a key-shaped string: %.12s…", file, found)
			}
		}
	}
}

func TestAsEndsOnTheChildExitCode(t *testing.T) {
	bin := t.TempDir()
	fakeTool(t, bin, "linear", "LINEAR_API_KEY")
	keys := keysFixture(t, map[string]string{"keychain:x-token-linear-coder:x": farFuture + ":tok"})
	got := runAs(t, []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_KEYS=" + keys, "FAKE_EXIT=3"},
		"as", "coder", "--", "linear", "api", "query")
	if got.code != 3 || got.stdout != "" {
		t.Errorf("exit %d stdout %q, want the child's 3 and no envelope", got.code, got.stdout)
	}
}

func TestAsRefusesWhatItCannotRunWithUsage(t *testing.T) {
	bin := t.TempDir()
	fakeTool(t, bin, "linear", "LINEAR_API_KEY")
	keys := keysFixture(t, map[string]string{})
	for name, argv := range map[string][]string{
		"an unknown member":      {"as", "ghost", "--", "linear", "api"},
		"a tool with no token":   {"as", "coder", "--", "curl", "https://example.com"},
		"no command":             {"as", "coder"},
		"a tool missing on PATH": {"as", "coder", "--", "/nowhere/linear"},
	} {
		t.Run(name, func(t *testing.T) {
			got := runAs(t, []string{"PATH=" + bin + ":/usr/bin:/bin", "X_KEYS=" + keys}, argv...)
			if got.code != 2 || !strings.Contains(got.stdout, `"status":"usage"`) {
				t.Errorf("exit %d, want 2 with a usage envelope: %s", got.code, got.stdout)
			}
		})
	}
}
