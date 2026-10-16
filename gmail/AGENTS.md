# AGENTS.md: gmail

the mail side of the mac: filters as code, the spam auto-read script, and the himalaya cli config
(`home/.config/himalaya/config.toml`). gmail's own spam classification is never touched; this dir
only adds delete-on-arrival filters for dima's picks and keeps newton's spam counter at zero.

- `blocklist.json` — **git-crypt encrypted** (`.gitattributes`): plain on an unlocked checkout, ciphertext on
  github. a fresh clone unlocks once with the key in 1password `git-crypt-dotfiles-golden`. the one hand-edited file: `address` (exact sender), `domain` (everything from
  it), `name` (display name). the x-ray «gmail: block sender» command appends here and applies
- `config.jsonnet` — renders the blocklist into gmailctl rules; `gmailctl apply --config ~/frame/gmail`
- `spam-autoread.gs` — the apps script, installed by hand at script.google.com
- `credentials.json` + `token.json` — gmailctl's oauth client + token, gitignored, never committed

⚠️ **the config is the whole truth: `apply` deletes every gmail filter the config does not name.** on a
new account, or after hand-made filters in the web ui, run `gmailctl download --config ~/frame/gmail`
first and fold what it prints into `config.jsonnet`. before an apply by hand, run `gmailctl diff --config ~/frame/gmail`: since 0.13 a quote that cannot form a valid gmail query is rejected, and the diff shows it before anything is deleted.

📌 a filter never touches mail that already arrived — after adding a sender, the sweep of old mail
is one gmail search by hand. 📌 «delete» is gmail's trash, purged after 30 days; there is no
permanent-delete filter action.

<!-- the first apply on 2026-09-20 removed two old filters nobody had folded in. -->
