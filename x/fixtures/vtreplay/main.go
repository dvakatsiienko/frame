// vtreplay <cols> <rows> < raw-pty-bytes > rendered-ansi : replays a pty capture through charm's vt
// emulator and prints the final screen with its styles, so freeze shoots what a terminal shows
package main

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/charmbracelet/x/vt"
)

func main() {
	cols, _ := strconv.Atoi(os.Args[1])
	rows, _ := strconv.Atoi(os.Args[2])
	raw, err := io.ReadAll(os.Stdin)
	if err != nil {
		os.Exit(2)
	}
	term := vt.NewEmulator(cols, rows)
	// a program that asks the terminal something (OSC 11, the background colour) gets an answer
	// written back; nobody reads it here, and an unread answer blocks the write forever
	go func() { _, _ = io.Copy(io.Discard, term) }()
	_, _ = term.Write([]byte(strings.ReplaceAll(string(raw), "\n", "\r\n")))
	lines := strings.Split(term.Render(), "\n")
	last := 0
	for i, line := range lines {
		if strings.TrimSpace(stripped(line)) != "" {
			last = i
		}
	}
	fmt.Println(strings.Join(lines[:last+1], "\n"))
}

func stripped(s string) string {
	var b strings.Builder
	in := false
	for _, r := range s {
		switch {
		case r == 0x1b:
			in = true
		case in && (r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z'):
			in = false
		case !in:
			b.WriteRune(r)
		}
	}
	return b.String()
}
