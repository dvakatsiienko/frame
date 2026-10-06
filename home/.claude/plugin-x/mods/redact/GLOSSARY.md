# redact

keeps secrets out of every transcript a session writes, and hands them back to the tool calls that name them.

## Language

**Secret**:
A live credential in a row's text: an api key, a token, a private key block.
_Avoid_: password, key (alone), credential string

**Placeholder**:
What a secret reads as in every kept row: `‹`, its first six characters, `…`, eight hex of its hash, `›`. One value, one placeholder.
_Avoid_: tag, token, redaction

**Vault**:
The session's map from placeholder to secret, held in `$.state`; it dies with the session.
_Avoid_: cache, store, keyring

**Restore**:
Swapping a placeholder back for its secret in a tool call's input, just before the call runs.
_Avoid_: unmask, reveal, decrypt

**Mask**:
The one-way fallback: a secret's first six characters followed by `…‹redacted›`, used when its placeholder is taken by another value.
_Avoid_: scrub, censor, hide
