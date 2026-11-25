package main

import (
	"fmt"
	"os"
)

func brakeStep(r *Run, d *mergeDecision, trunk string) (brake string, err error) {
	err = r.Step("brake", "looking for a revert of a merge-auto merge in 7 days", func() (string, error) {
		var err error
		var kind string
		brake, kind, err = brakeOn(d.Repo, trunk, d.PR)
		switch {
		case err != nil:
			return "", brakeReadFail(err)
		case brake != "" && liftsBrake(d.Override):
			// his word or band press reads the brake as a warning: the merge goes on, the brake named once
			d.Brake = liftedBrake(kind, brake)
			brake = ""
			if !r.human {
				fmt.Fprintln(os.Stderr, brakeWarning(d.Override.Scope, d.Brake))
			}
			return "on: " + d.Brake + " — lifted by operator-override " + d.Override.Scope, nil
		case brake != "":
			return "", notHeld("on: " + brake)
		}
		return "off", nil
	})
	return brake, err
}
