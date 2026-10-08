# AGENTS.md: schedule — every launchd job

one home for every scheduled daemon (`schedule/jobs/<name>/`: plist, source, `bin/`); a feature's readers and tools stay in the feature's own home. load this file before touching a plist, a daemon build or a tcc grant.

## launchd + tcc hazards

- **every daemon build signs through `script/lib/sign.sh`** — the one self-signed identity «x-speak local signing» (to 2036), so a tcc grant pins to the certificate leaf and survives rebuilds, source changes included (x-speak, 2026-09-29). **ad-hoc is the failure case**: its grant pins to the cdhash, the next source change silently drops Input Monitoring, and a listen-only tap still «succeeds» and hears nothing (chord lines stop, app-switch lines continue — the tell). a re-grant still runs edit → build → **re-grant** → restart; a tap created before the grant stays deaf. a plain off/on of the row can re-authorise an old hash — remove the row and add the binary back (2026-09-19)
- **macOS 27 renamed the Accessibility list to «Device Control and Data Access»** (Privacy & Security); the old deep link still lands on it — `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"` (x-speak's grant, 2026-09-29)
- **PlistBuddy cannot `Set` array elements past index 0** in these prefs (`Cannot Perform Set On Containers`; index 0 works, which makes it look transient) — write with python `plistlib` and assert the value's type first (2026-09-19)
- **FDA on an ad-hoc-signed launchd binary does not unlock `FileManager.trashItem` on an iCloud-managed
  folder** (`~/Desktop` with Desktop & Documents in iCloud): reads and a plain `moveItem` into `~/.Trash`
  work, the trash call is brokered and refused — read + a `folder writable` line in the error path told
  it apart from a permission deny in one run (2026-09-18). a bare «trashed 0 / exit 0» on a folder with
  nothing old enough reads identical to a deny: log the scanned count
- `plutil -convert json` drops xml comments — prose in a plist is read from the raw file; `launchctl
  print` repeats `state =` in nested blocks — anchor the parse on the top-level line
- `pnpm frame:link apply` links new leaves and never prunes a dangling old symlink after a rename
