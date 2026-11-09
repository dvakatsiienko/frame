//go:build !darwin

package main

func cloneFile(from, to string) error { return copyFile(from, to) }
