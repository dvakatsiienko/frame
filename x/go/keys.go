package main

import (
	"cmp"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// keys is the one place a token comes from. each secret is read where it lives (checked 2026-10-07):
// dima's linear key in 1password (dev/linear-golden, through the x-fleet service account, `op read`
// in-process — `op run` masks a child's stdout), the cclio/coder linear oauth pairs and the github app
// keys in the macos keychain. a minted token is cached in the keychain until it nears expiry, written
// through `security -i` on stdin. no secret reaches argv, stdout, a trace or a file in a repo.
// X_KEYS names a json fixture that stands in for both stores; under X_TEST nothing else is read.

var members = []string{"cclio", "coder", "dima"}

// the env var each proxied tool reads its token from
var tokenEnv = map[string]string{"linear": "LINEAR_API_KEY", "gh": "GH_TOKEN"}

var githubApp = map[string]string{"coder": "x-coder", "cclio": "x-cclio-cc"}

// a token with less life left than this is minted again
var freshFor = map[string]time.Duration{"linear": 24 * time.Hour, "gh": 10 * time.Minute}

func linearBase() string {
	return strings.TrimSuffix(cmp.Or(os.Getenv("X_LINEAR_URL"), "https://api.linear.app"), "/")
}
func githubBase() string {
	return strings.TrimSuffix(cmp.Or(os.Getenv("X_GITHUB_URL"), "https://api.github.com"), "/")
}

// tokenFor answers the token `member` acts with on `tool`; "" means the tool's own login (dima on gh)
func tokenFor(member, tool string) (string, error) {
	if member == "dima" && tool == "gh" {
		return "", nil
	}
	store, err := openSecrets()
	if err != nil {
		return "", err
	}
	// dima's own key is never copied into the keychain: read from 1password on every call (dima, 2026-10-07)
	if member == "dima" {
		return store.get("op://dev/linear-golden/credential")
	}
	cacheKey := cacheKeyOf(member, tool)
	if cached, err := store.get(cacheKey); err == nil {
		if expiry, token, ok := strings.Cut(cached, ":"); ok {
			if unix, _ := strconv.ParseInt(expiry, 10, 64); time.Until(time.Unix(unix, 0)) > freshFor[tool] {
				return token, nil
			}
		}
	}
	token, expires, err := mint(store, member, tool)
	if err != nil {
		return "", err
	}
	// a cache that cannot be written costs the next call a mint, never this call its token. a value
	// `security -i` would split (a space, a quote) is never cached; no token linear or github mints has one
	if !strings.ContainsAny(token, " \t\n\"'\\") {
		_ = store.put(cacheKey, strconv.FormatInt(expires.Unix(), 10)+":"+token)
	}
	return token, nil
}

// forget expires a cached app token, so the next tokenFor mints it again: a revoked token heals on the
// call after the 401. dima's key has no cache to expire
func forget(member, tool string) {
	if store, err := openSecrets(); member != "dima" && err == nil {
		_ = store.put(cacheKeyOf(member, tool), "0:")
	}
}

func cacheKeyOf(member, tool string) string {
	name := "x-token-" + tool + "-" + member
	if tool == "gh" {
		name = "x-token-gh-" + githubApp[member]
	}
	return "keychain:" + name + ":x"
}

func mint(store secrets, member, tool string) (string, time.Time, error) {
	if tool == "linear" {
		return mintLinear(store, member)
	}
	return mintGithub(store, githubApp[member])
}

// client credentials mint headless; the scope param is mandatory, linear's default bounces invalid_scope
func mintLinear(store secrets, app string) (string, time.Time, error) {
	id, errID := store.get("keychain:linear-" + app + "-id:" + app)
	secret, errSecret := store.get("keychain:linear-" + app + "-secret:" + app)
	if err := errors.Join(errID, errSecret); err != nil {
		return "", time.Time{}, err
	}
	form := url.Values{"client_id": {id}, "client_secret": {secret}, "grant_type": {"client_credentials"},
		"scope": {"read,write,app:assignable,app:mentionable,initiative:read,initiative:write"}}
	var minted struct {
		Token   string `json:"access_token"`
		Expires int64  `json:"expires_in"`
	}
	if err := fetchJSON(http.MethodPost, linearBase()+"/oauth/token", strings.NewReader(form.Encode()),
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"}, &minted); err != nil {
		return "", time.Time{}, fmt.Errorf("minting the linear %s token: %w", app, err)
	}
	if minted.Token == "" {
		return "", time.Time{}, fmt.Errorf("linear minted no token for %s", app)
	}
	return minted.Token, time.Now().Add(time.Duration(minted.Expires) * time.Second), nil
}

// an RS256 jwt signed with the app key (10 min) buys an installation token (1 h)
func mintGithub(store secrets, app string) (string, time.Time, error) {
	id, errID := store.get("keychain:github-" + app + "-id:" + app)
	// the pem is stored base64: `security -w` hex-mangles a multi-line secret on read
	encoded, errKey := store.get("keychain:github-" + app + "-key:" + app)
	if err := errors.Join(errID, errKey); err != nil {
		return "", time.Time{}, err
	}
	jwt, err := appJWT(id, encoded)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("signing the %s jwt: %w", app, err)
	}
	headers := map[string]string{"Accept": "application/vnd.github+json", "Authorization": "Bearer " + jwt,
		"X-GitHub-Api-Version": "2022-11-28"}
	var installations []struct {
		ID int64 `json:"id"`
	}
	if err := fetchJSON(http.MethodGet, githubBase()+"/app/installations", nil, headers, &installations); err != nil {
		return "", time.Time{}, fmt.Errorf("listing the %s installations: %w", app, err)
	}
	if len(installations) == 0 {
		return "", time.Time{}, fmt.Errorf("%s is installed nowhere", app)
	}
	var minted struct {
		Token   string    `json:"token"`
		Expires time.Time `json:"expires_at"`
	}
	path := fmt.Sprintf("%s/app/installations/%d/access_tokens", githubBase(), installations[0].ID)
	if err := fetchJSON(http.MethodPost, path, nil, headers, &minted); err != nil {
		return "", time.Time{}, fmt.Errorf("minting the %s token: %w", app, err)
	}
	return minted.Token, minted.Expires, nil
}

func appJWT(issuer, encodedPEM string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(encodedPEM)
	if err != nil {
		return "", err
	}
	block, _ := pem.Decode(raw)
	if block == nil {
		return "", errors.New("the app key is not a pem")
	}
	var key *rsa.PrivateKey
	if parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		key, _ = parsed.(*rsa.PrivateKey)
	} else if key, err = x509.ParsePKCS1PrivateKey(block.Bytes); err != nil {
		return "", err
	}
	if key == nil {
		return "", errors.New("the app key is not rsa")
	}
	b64 := base64.RawURLEncoding.EncodeToString
	now := time.Now().Unix()
	claims, _ := json.Marshal(map[string]any{"iat": now - 60, "exp": now + 540, "iss": issuer})
	signed := b64([]byte(`{"alg":"RS256","typ":"JWT"}`)) + "." + b64(claims)
	digest := sha256.Sum256([]byte(signed))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return signed + "." + b64(signature), nil
}

func fetchJSON(method, target string, body io.Reader, headers map[string]string, into any) error {
	req, err := http.NewRequest(method, target, body)
	if err != nil {
		return err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s answered %d", req.URL.Host, resp.StatusCode)
	}
	return json.Unmarshal(raw, into)
}

var httpClient = &http.Client{Timeout: 30 * time.Second}

/* Stores */

// a secret is named `keychain:<service>:<account>` or by its 1password reference `op://…`
type secrets interface {
	get(name string) (string, error)
	put(name, value string) error
}

func openSecrets() (secrets, error) {
	if path := os.Getenv("X_KEYS"); path != "" {
		return &fixtureSecrets{path: path}, nil
	}
	if os.Getenv("X_TEST") != "" {
		return nil, errors.New("a test reads keys only from X_KEYS")
	}
	return machineSecrets{}, nil
}

type fixtureSecrets struct {
	path string
	mu   sync.Mutex
}

func (f *fixtureSecrets) load() (map[string]string, error) {
	raw, err := os.ReadFile(f.path)
	if err != nil {
		return nil, err
	}
	entries := map[string]string{}
	return entries, json.Unmarshal(raw, &entries)
}

func (f *fixtureSecrets) get(name string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	entries, err := f.load()
	if err != nil {
		return "", err
	}
	value, ok := entries[name]
	if !ok {
		return "", fmt.Errorf("no secret %s", name)
	}
	return value, nil
}

func (f *fixtureSecrets) put(name, value string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	entries, err := f.load()
	if err != nil {
		return err
	}
	entries[name] = value
	raw, _ := json.Marshal(entries)
	return os.WriteFile(f.path, raw, 0o600)
}

type machineSecrets struct{}

func (machineSecrets) get(name string) (string, error) {
	if strings.HasPrefix(name, "op://") {
		account, err := machineSecrets{}.get("keychain:op-service-account-x-fleet:")
		if err != nil {
			return "", err
		}
		cmd := exec.Command("op", "read", "--no-newline", name)
		cmd.Env = append(os.Environ(), "OP_SERVICE_ACCOUNT_TOKEN="+account)
		out, err := cmd.Output()
		if err != nil {
			return "", fmt.Errorf("1password has no %s: %w", name, err)
		}
		return strings.TrimSpace(string(out)), nil
	}
	service, account := keychainName(name)
	args := []string{"find-generic-password", "-s", service, "-w"}
	if account != "" {
		args = append(args, "-a", account)
	}
	out, err := exec.Command("security", args...).Output()
	if err != nil {
		return "", fmt.Errorf("the keychain has no %s", service)
	}
	return strings.TrimSpace(string(out)), nil
}

// the value goes in on stdin: `security -w <value>` would put it on argv, where ps reads it
func (machineSecrets) put(name, value string) error {
	service, account := keychainName(name)
	cmd := exec.Command("security", "-i")
	cmd.Stdin = strings.NewReader(fmt.Sprintf("add-generic-password -U -a %s -s %s -w %s\n", account, service, value))
	return cmd.Run()
}

func keychainName(name string) (service, account string) {
	service, account, _ = strings.Cut(strings.TrimPrefix(name, "keychain:"), ":")
	return service, account
}
