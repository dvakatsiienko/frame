package main

import (
	"os"
	"time"
)

func clock() time.Time {
	if mergeTestEnvOn() {
		if at, err := time.Parse(time.RFC3339, os.Getenv("X_NOW")); err == nil {
			return at
		}
	}
	return time.Now()
}
