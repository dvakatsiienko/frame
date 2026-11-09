package main

import "golang.org/x/sys/unix"

// an apfs clone shares the blocks until one side writes, so a whole repo copies in about half a second
func cloneFile(from, to string) error {
	if err := unix.Clonefile(from, to, unix.CLONE_NOFOLLOW); err != nil {
		return copyFile(from, to)
	}
	return nil
}
