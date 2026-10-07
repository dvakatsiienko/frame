//go:build xpanic

package main

import "os"

// only the test binary is built with this tag: X_PANIC turns `knowledge list` into a panic, so the
// dispatcher's recover is proven from outside without a branch in the shipped binary
func init() {
	if os.Getenv("X_PANIC") != "" {
		impls["knowledge list"] = Impl{Run: func(*Run, []string, Flags) (any, error) { panic("forced by X_PANIC") }}
	}
}
