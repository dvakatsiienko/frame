//go:build !darwin

package main

import (
	"io"
	"os"
)

// a plain copy keeps the mode, so a script the tests run stays executable in the copy
func cloneFile(from, to string) error {
	src, err := os.Open(from)
	if err != nil {
		return err
	}
	defer src.Close()
	info, err := src.Stat()
	if err != nil {
		return err
	}
	dst, err := os.OpenFile(to, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode().Perm())
	if err != nil {
		return err
	}
	_, err = io.Copy(dst, src)
	if closed := dst.Close(); err == nil {
		err = closed
	}
	return err
}
