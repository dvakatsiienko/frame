package main

import (
	"os"

	"golang.org/x/sys/unix"
)

// an apfs clone shares the blocks until one side writes, so a whole repo copies in about half a second
func cloneFile(from, to string) error {
	if err := unix.Clonefile(from, to, unix.CLONE_NOFOLLOW); err != nil {
		body, err := os.ReadFile(from)
		if err != nil {
			return err
		}
		info, err := os.Stat(from)
		if err != nil {
			return err
		}
		// the mode rides along, so a script the tests run stays executable in the copy
		return os.WriteFile(to, body, info.Mode().Perm())
	}
	return nil
}
