#!/usr/bin/env bash
# a round is «applied» only when every ticked line proves itself on disk.
# input: a tsv, one ticked line per row: <line> TAB <file, repo-relative> TAB <text that must be gone> TAB <text that must be present>
# either text may be empty; «keep» rows are left out. exit 0 only when every row passes.
set -uo pipefail
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
fail=0
# tab is whitespace to IFS, so an empty field would collapse: split on \037 instead
while IFS=$'\037' read -r n file gone present; do
  [[ -z "$n" || "$n" == \#* ]] && continue
  path="$root/$file"; [[ "$file" == /* || "$file" == ~* ]] && path="${file/#\~/$HOME}"
  if [[ ! -f "$path" ]]; then echo "❌ $n $file: no such file"; fail=1; continue; fi
  msg=""
  if [[ -n "$gone" ]] && grep -qF -- "$gone" "$path"; then msg+=" still holds «$gone»"; fi
  if [[ -n "$present" ]] && ! grep -qF -- "$present" "$path"; then msg+=" lacks «$present»"; fi
  if [[ -n "$msg" ]]; then echo "❌ $n $file:$msg"; fail=1; else echo "✅ $n $file"; fi
done < <(tr '\t' '\037' < "${1:?usage: applied-check.sh <round.tsv>}")
exit $fail
