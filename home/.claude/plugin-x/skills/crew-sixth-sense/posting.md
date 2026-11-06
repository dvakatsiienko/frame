# what sixth sense posts — history dima may read later, nothing else

- `linear`, one comment per ticket, at the clean or a stop (round 3, not-checkable), never per round: head, exit lines n/m, rounds, breaks found, what it did not exercise. `x linear comment <id> --body-file <f>`
- `github`, one line comment per real break, on that line: what broke, the failing command. a round with no break posts nothing. `github-token-wrap api repos/<repo>/pulls/<n>/comments -f commit_id=<head> -f path=<path> -F line=<line> -f side=RIGHT -f body=<text>`
- `github`, at the clean, one closing line on the pr: «🔦 clean on <sha>, <n> rounds, <k> breaks, not exercised: <x>» plus the ticket link. no gate reads it. `github-token-wrap pr comment <n> --body <line>`
- `github`, when you refute a reviewer's finding, one reply in its thread with the probe; a confirmed finding gets none, codie's fix says it. `github-token-wrap api repos/<repo>/pulls/<n>/comments/<id>/replies -f body=<text>`
- at the clean, resolve each thread you opened, since `x lane merge-auto` waits on an open thread: `github-token-wrap api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<id>"}) { thread { isResolved } } }'`
- a quick lane has no pr: `linear` alone
- never: progress, «clean so far», per-round status, test or diff lists, anything codie or the reviewer already said
