package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// what `_clio/script/wish-cover.ts` prints for FRM-1 (its lines 418-446): a green run and a red one with an uncited line
const (
	// the call it must get: the ticket, --all, then the lane's spec (the script exits 2 on a usage it cannot read)
	wishCoverArgs  = "[ \"$2 $3\" = \"FRM-1 --all\" ] && case \"$4\" in */.scratch/lane-1/spec.md) ;; *) false ;; esac || { echo usage >&2; exit 2; }\n"
	wishCoverGreen = wishCoverArgs + "echo \"FRM-1: every cited W-line's text is in the drafts\"\nexit 0\n"
	wishCoverRed   = wishCoverArgs + "echo '✗ FRM-1:W2 uncited: another'\necho 'FRM-1: 0 W-line(s) reworded or dropped, 1 uncited — copy the wish'\"'\"'s words verbatim'\nexit 1\n"
)

// the stub node reds until the ticket's line carries a settled-elsewhere note, which a marker file stands for here: the rule is
// the script's own (`uncovered`'s «→ <home>», proven in wish-cover.test.ts)
func wishCoverRedUntil(marker string) string {
	return wishCoverArgs + "[ -e " + marker + " ] && exit 0\n" + wishCoverRed
}

func specStays(w landedWorld) bool {
	return exists(filepath.Join(w.repo, ".scratch/lane-1/spec.md")) && !exists(filepath.Join(w.repo, ".scratch/_archive"))
}

// FRM-674 exit 1: a close with a W-line in no slice is refused, names it, and closes nothing
func TestLandedApplyRefusesAWishLineNoSliceCites(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	plan := w.lanePlan(t, "- [ ] 01 · FRM-1 reviewed and closed\n")

	envelope, got := w.landedWith(t, wishCoverRed, "--apply")

	said := linesOf(envelope)
	if got.code != 1 || !strings.Contains(said, "FRM-1:W2 uncited: another") || strings.Contains(said, "W1 uncited") {
		t.Fatalf("exit %d, want a refusal naming only W2:\n%s", got.code, got.stdout)
	}
	if raw, _ := os.ReadFile(plan); !specStays(w) || strings.Contains(string(raw), "[x]") {
		t.Errorf("the close ran past the refusal: spec stays %v, plan:\n%s", specStays(w), raw)
	}
}

// exit 2: the same ticket, run again once the line is settled elsewhere, closes
func TestLandedApplyClosesOnceTheLineIsSettled(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	marker := filepath.Join(t.TempDir(), "settled")
	if _, got := w.landedWith(t, wishCoverRedUntil(marker), "--apply"); got.code == 0 || !specStays(w) {
		t.Fatalf("the first run should refuse, exit %d", got.code)
	}
	write(t, marker, "")

	envelope, _ := w.landedWith(t, wishCoverRedUntil(marker), "--apply")

	// the re-read after the archive finds no open spec, so it prints no wish-cover line: the check has been passed
	if specStays(w) || strings.Contains(linesOf(envelope), "🔴 wish-cover") {
		t.Errorf("the settled line did not let the close through:\n%s", linesOf(envelope))
	}
}

// exit 3: a ticket with no W-line is not read at all, and prints no line
func TestLandedReadsNoWishCoverForATicketWithNoWishBlock(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	*w.body = "## signed\n\n🚀 dispatched 2026-10-30 — lane-1, codie s1, sixth sense s2\n"

	envelope, _ := w.landedWith(t, "echo called >&2\nexit 1\n", "--apply")

	if specStays(w) || strings.Contains(linesOf(envelope), "wish-cover") || strings.Contains(linesOf(envelope), "called") {
		t.Errorf("the check ran or spoke for a ticket with no wish block:\n%s", linesOf(envelope))
	}
}

// exit 4, the dry print: the red line names the W-line and nothing is written
func TestLandedPrintsTheUncitedWishLinesWithoutApply(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)

	envelope, got := w.landedWith(t, wishCoverRed)

	if !strings.Contains(linesOf(envelope), "🔴 wish-cover — FRM-1:W2 uncited: another") || !specStays(w) {
		t.Errorf("exit %d, want the red line and no write:\n%s", got.code, linesOf(envelope))
	}
}

// a close the check cannot run is refused too: «the script is gone» never reads as «every line is cited»
func TestLandedApplyRefusesWhenWishCoverCannotRun(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	if err := os.Remove(filepath.Join(w.repo, wishCoverScript)); err != nil {
		t.Fatal(err)
	}

	envelope, got := w.landed(t, "--apply")

	if got.code != 1 || !strings.Contains(linesOf(envelope), "cannot run "+wishCoverScript) || !specStays(w) {
		t.Errorf("exit %d, want a refusal naming the missing script:\n%s", got.code, linesOf(envelope))
	}
}

// the script's own refusal (no numbered block, an unreadable ticket) reaches the line as its last words, not as a pass
func TestLandedReadsWishCoversOwnRefusal(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)

	envelope, _ := w.landedWith(t, "echo \"FRM-1: number the ticket's wish block into FRM-1:W1… lines first\" >&2\nexit 2\n", "--apply")

	if !strings.Contains(linesOf(envelope), "wish-cover said: FRM-1: number the ticket's wish block") || !specStays(w) {
		t.Errorf("want the script's words and no close:\n%s", linesOf(envelope))
	}
}

// a lane whose spec is already archived has no open spec to read the W-lines against, so the check stays out of a re-run
func TestLandedReadsNoWishCoverOnceTheSpecIsArchived(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	w.landedWith(t, wishCoverGreen, "--apply")

	envelope, _ := w.landedWith(t, "echo called >&2\nexit 1\n", "--apply")

	if strings.Contains(linesOf(envelope), "wish-cover") || strings.Contains(linesOf(envelope), "called") {
		t.Errorf("the check ran with no open spec:\n%s", linesOf(envelope))
	}
}
