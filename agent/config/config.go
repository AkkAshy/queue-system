// Package config holds runtime configuration for the agent.
// Values are sourced (in order): built-in defaults → env vars → CLI flags.
package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// LoadConfFile reads an optional `agent.conf` sitting next to the executable and
// seeds AGENT_* environment variables from it (KEY=VALUE per line, '#' comments).
// Real env vars always win — the file only fills what's unset. This lets the
// kiosk PC run the bare .exe (double-click) with settings in a plain text file,
// no .bat/script needed (handy where script execution is locked down).
func LoadConfFile() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	for _, name := range []string{"agent.conf", "agent.env"} {
		f, err := os.Open(filepath.Join(filepath.Dir(exe), name))
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, val, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = strings.TrimSpace(key)
			val = strings.TrimSpace(strings.TrimRight(val, "\r"))
			if key != "" && os.Getenv(key) == "" {
				_ = os.Setenv(key, val)
			}
		}
		f.Close()
		return // first file found wins
	}
}

type Backend = string

const (
	BackendCUPS    Backend = "cups"    // pipe ESC/POS bytes into `lp -d <name> -o raw`
	BackendFile    Backend = "file"    // write raw bytes to a file/device path
	BackendNull    Backend = "null"    // discard bytes (for tests + dev without printer)
	BackendWindows Backend = "windows" // Windows print spooler RAW (uses PrinterName)
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

	// Kiosk-host mode: when set, the agent reverse-proxies every non-/print,
	// non-/health request to this upstream (the cloud), so the kiosk browser
	// talks to a single same-origin localhost host. Empty = pure print agent.
	Upstream string

	// When true, launch a Chrome kiosk window pointed at the local server on
	// startup (Windows kiosk PC).
	LaunchKiosk bool
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
	if v := os.Getenv("AGENT_UPSTREAM"); v != "" {
		c.Upstream = v
	}
	if v := os.Getenv("AGENT_KIOSK"); v == "1" || v == "true" {
		c.LaunchKiosk = true
	}
	return c
}

// Validate checks the config is internally consistent.
func (c Config) Validate() error {
	switch c.Backend {
	case BackendCUPS, BackendFile, BackendNull, BackendWindows:
		// ok
	default:
		return fmt.Errorf("unknown backend %q (allowed: cups, file, null, windows)", c.Backend)
	}
	if c.Backend == BackendFile && c.PrinterDevice == "" {
		return fmt.Errorf("backend=file requires AGENT_PRINTER_DEVICE (printer device path)")
	}
	if c.Backend == BackendCUPS && c.PrinterName == "" {
		return fmt.Errorf("backend=cups requires AGENT_PRINTER_NAME (CUPS queue name)")
	}
	if c.Backend == BackendWindows && c.PrinterName == "" {
		return fmt.Errorf("backend=windows requires AGENT_PRINTER_NAME (Windows printer name)")
	}
	if c.Addr == "" {
		return fmt.Errorf("listen address must not be empty")
	}
	return nil
}
