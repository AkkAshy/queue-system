package main

import (
	"fmt"
	"os"
)

// Version is stamped at build time: go build -ldflags "-X main.Version=0.1.0"
var Version = "dev"

func main() {
	fmt.Fprintf(os.Stderr, "ndpi-queue-agent %s (bootstrap stub — not wired yet)\n", Version)
	os.Exit(0)
}
