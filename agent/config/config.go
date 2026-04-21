// Package config holds runtime configuration for the agent.
// Values are sourced (in order): built-in defaults → env vars → CLI flags.
package config

import (
	"fmt"
	"os"
	"strconv"
)

type Backend = string

const (
	BackendCUPS Backend = "cups" // pipe ESC/POS bytes into `lp -d <name> -o raw`
	BackendFile Backend = "file" // write raw bytes to a file/device path
	BackendNull Backend = "null" // discard bytes (for tests + dev without printer)
)

// Config is the fully-resolved runtime configuration.
type Config struct {
	// HTTP listen address, e.g. "127.0.0.1:8089".
	Addr string

	// Which printer backend to use.
	Backend Backend

	// CUPS printer name (used when Backend=cups).
	PrinterName string

	// Raw device path (used when Backend=file), e.g. "/dev/usb/lp0".
	PrinterDevice string

	// Timeout (seconds) for writing one ticket's bytes to the printer.
	PrintTimeoutSeconds float64

	// Path for append-only log file. If empty, logs go to stdout only.
	LogFile string
}

// Default returns the baseline configuration (no env / flags applied).
func Default() Config {
	return Config{
		Addr:                "127.0.0.1:8089",
		Backend:             BackendCUPS,
		PrinterName:         "XP-80T",
		PrinterDevice:       "",
		PrintTimeoutSeconds: 10,
		LogFile:             "",
	}
}

// FromEnv overlays supported env vars onto `c` and returns the merged Config.
func FromEnv(c Config) Config {
	if v := os.Getenv("AGENT_ADDR"); v != "" {
		c.Addr = v
	}
	if v := os.Getenv("AGENT_BACKEND"); v != "" {
		c.Backend = Backend(v)
	}
	if v := os.Getenv("AGENT_PRINTER_NAME"); v != "" {
		c.PrinterName = v
	}
	if v := os.Getenv("AGENT_PRINTER_DEVICE"); v != "" {
		c.PrinterDevice = v
	}
	if v := os.Getenv("AGENT_LOG_FILE"); v != "" {
		c.LogFile = v
	}
	if v := os.Getenv("AGENT_PRINT_TIMEOUT_SECONDS"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			c.PrintTimeoutSeconds = f
		}
	}
	return c
}

// Validate checks the config is internally consistent.
func (c Config) Validate() error {
	switch c.Backend {
	case BackendCUPS, BackendFile, BackendNull:
		// ok
	default:
		return fmt.Errorf("unknown backend %q (allowed: cups, file, null)", c.Backend)
	}
	if c.Backend == BackendFile && c.PrinterDevice == "" {
		return fmt.Errorf("backend=file requires AGENT_PRINTER_DEVICE (printer device path)")
	}
	if c.Backend == BackendCUPS && c.PrinterName == "" {
		return fmt.Errorf("backend=cups requires AGENT_PRINTER_NAME (CUPS queue name)")
	}
	if c.Addr == "" {
		return fmt.Errorf("listen address must not be empty")
	}
	return nil
}
