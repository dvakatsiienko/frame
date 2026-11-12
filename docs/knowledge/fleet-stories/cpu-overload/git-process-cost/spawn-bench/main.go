package main

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/zchee/fastexec"
)

const target = "/opt/homebrew/bin/git"

func runStd() error {
	return exec.Command(target, "--version").Run()
}

func runFast() error {
	return fastexec.Command(target, "--version").Run()
}

func seconds(t syscall.Timeval) float64 {
	return float64(t.Sec) + float64(t.Usec)/1e6
}

func main() {
	mode, count, workers := os.Args[1], atoi(os.Args[2]), atoi(os.Args[3])
	run := runStd
	if mode == "fast" {
		run = runFast
	}
	var self0, kids0, self1, kids1 syscall.Rusage
	_ = syscall.Getrusage(syscall.RUSAGE_SELF, &self0)
	_ = syscall.Getrusage(syscall.RUSAGE_CHILDREN, &kids0)
	start := time.Now()
	var wg sync.WaitGroup
	for range workers {
		wg.Go(func() {
			for range count / workers {
				if err := run(); err != nil {
					fmt.Fprintln(os.Stderr, err)
					os.Exit(1)
				}
			}
		})
	}
	wg.Wait()
	wall := time.Since(start).Seconds()
	_ = syscall.Getrusage(syscall.RUSAGE_SELF, &self1)
	_ = syscall.Getrusage(syscall.RUSAGE_CHILDREN, &kids1)
	selfCPU := seconds(self1.Utime) - seconds(self0.Utime) + seconds(self1.Stime) - seconds(self0.Stime)
	kidCPU := seconds(kids1.Utime) - seconds(kids0.Utime) + seconds(kids1.Stime) - seconds(kids0.Stime)
	n := float64(count)
	fmt.Printf("%s workers=%d wall=%.1fms/spawn parent=%.2fms child=%.2fms total=%.2fms\n",
		mode, workers, wall/n*1000, selfCPU/n*1000, kidCPU/n*1000, (selfCPU+kidCPU)/n*1000)
}

func atoi(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		panic(err)
	}
	return n
}
