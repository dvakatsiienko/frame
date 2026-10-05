# redact

keeps secrets out of every transcript a session writes.

## Language

**Secret**:
A live credential in a row's text: an api key, a token, a private key block.
_Avoid_: password, key (alone), credential string

**Mask**:
A secret's first six characters followed by `…‹redacted›`, written in its place.
_Avoid_: scrub, censor, hide
