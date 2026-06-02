# Phase 2 — Go Agent + Xprinter XP-80T Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock `printTicket()` in the kiosk frontend with a real Go agent that drives an Xprinter XP-80T via ESC/POS, printing a bilingual bank-style ticket on 80mm thermal paper.

**Architecture:** A single Go binary (`agent`) runs on the kiosk PC, listens on `localhost:8089`, and exposes `POST /print` + `GET /health`. The kiosk's `printer.ts` sends a JSON payload with ticket/category/service fields; the agent composes raw ESC/POS bytes (using a hand-rolled command builder — no heavyweight library) and writes them to the printer through a pluggable backend (CUPS `lp -d <name> -o raw` on macOS; raw `/dev/usb/lp0` on Linux; a `null` sink for tests).

**Tech Stack:** Go 1.22+, `log/slog` for structured logging, `net/http` standard library, `testify` for assertions, `golang.org/x/text/encoding/charmap` for Windows-1251 encoding of Russian text, built-in ESC/POS QR command for the QR code. No ESC/POS libraries — we write the commands ourselves for full control.

**Spec:** `docs/superpowers/specs/2026-04-20-queue-system-design.md` §8 (Phase 2) and §9.2 (printer model).

---

## File Map

```
queue-system/
├── agent/
│   ├── go.mod
│   ├── go.sum
│   ├── main.go                       # bootstrap + flag parsing
│   ├── .gitignore
│   ├── README.md                     # setup & troubleshooting
│   ├── config/
│   │   └── config.go                 # env + flags → Config struct
│   ├── printer/
│   │   ├── writer.go                 # Writer interface + backends
│   │   ├── writer_test.go
│   │   ├── escpos.go                 # low-level ESC/POS byte builder
│   │   ├── escpos_test.go
│   │   ├── encoding.go               # UTF-8 → PC866 / KAA transliteration
│   │   ├── encoding_test.go
│   │   ├── template.go               # ticket layout renderer
│   │   └── template_test.go
│   ├── server/
│   │   ├── server.go                 # HTTP router + /print + /health
│   │   └── server_test.go
│   ├── scripts/
│   │   └── test-print.sh             # manual smoke test
│   └── systemd/
│       └── ndpi-queue-agent.service
└── apps/kiosk/
    ├── lib/printer.ts                # fetch to agent (replaces mock)
    └── tests/printer.test.ts         # updated — mocks fetch
```

---

## Known Constraints & Decisions

- **No external ESC/POS library.** Commands are short and hand-building them gives us full control over bilingual layout, QR sizing, and cut timing.
- **Text encoding:** printer is single-code-page at a time. Russian lines encoded via **Windows-1251** (ESC t 46 → CP1251 on Xprinter XP-80T). Karakalpak lines use an **ASCII transliteration** (`ǵ`→`g'`, `ń`→`n'`, `ı`→`i`, `ú`→`u'`, `ó`→`o'`, `á`→`a'`, `ı́`→`i'`, `ș`→`s`). A future v2 can upgrade to raster (bitmap) text rendering for perfect Karakalpak glyphs. The README documents this limitation.
- **Printer backend default:** `cups` (`lp -d <name> -o raw` via stdin). On Linux the `file` backend (`/dev/usb/lp0`) is an option. The `null` backend (discards bytes) is used in tests and for dev without a printer.
- **Ports / URLs:** agent binds `127.0.0.1:8089` by default. Kiosk uses `NEXT_PUBLIC_AGENT_URL` with default `http://localhost:8089`.
- **Timeouts:** HTTP server 5s read/write; printer backend 10s; kiosk fetch to agent 15s (slower paper, retries in future).
- **Only macOS + Linux in v1.** Windows support deferred.

---

### Task 1: Initialize Go module and skeleton

**Files:**
- Create: `agent/go.mod`
- Create: `agent/.gitignore`
- Create: `agent/main.go`
- Modify: `.gitignore` (root) to allow `agent/`

- [ ] **Step 1: Create `agent/go.mod`**

```bash
cd /Users/akkanat/Projects/queue-system/agent
```

```bash
go mod init github.com/ndpi/queue-agent
```

Then confirm `go.mod` looks like:

```go
module github.com/ndpi/queue-agent

go 1.22
```

- [ ] **Step 2: Create `agent/.gitignore`**

```gitignore
# build artifacts
agent
ndpi-queue-agent
dist/
*.test

# logs
*.log

# local env overrides
.env
.env.local
```

- [ ] **Step 3: Create minimal `agent/main.go`**

```go
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
```

- [ ] **Step 4: Verify it builds and runs**

```bash
cd /Users/akkanat/Projects/queue-system/agent
go build -o dist/agent .
./dist/agent
```

Expected: prints `ndpi-queue-agent dev (bootstrap stub — not wired yet)` and exits 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/
git commit -m "feat(agent): init Go module skeleton"
```

---

### Task 2: Config package (env vars + flags)

**Files:**
- Create: `agent/config/config.go`
- Create: `agent/config/config_test.go`

- [ ] **Step 1: Write the failing test** — `agent/config/config_test.go`

```go
package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDefaults(t *testing.T) {
	c := Default()
	assert.Equal(t, "127.0.0.1:8089", c.Addr)
	assert.Equal(t, "cups", c.Backend)
	assert.Equal(t, "XP-80T", c.PrinterName)
	assert.Equal(t, "", c.PrinterDevice)
	assert.Equal(t, 10.0, c.PrintTimeoutSeconds)
}

func TestFromEnv(t *testing.T) {
	t.Setenv("AGENT_ADDR", "0.0.0.0:9000")
	t.Setenv("AGENT_BACKEND", "file")
	t.Setenv("AGENT_PRINTER_DEVICE", "/dev/usb/lp0")
	t.Setenv("AGENT_PRINTER_NAME", "MY-PRINTER")

	c := FromEnv(Default())
	assert.Equal(t, "0.0.0.0:9000", c.Addr)
	assert.Equal(t, "file", c.Backend)
	assert.Equal(t, "/dev/usb/lp0", c.PrinterDevice)
	assert.Equal(t, "MY-PRINTER", c.PrinterName)
}

func TestValidateRejectsUnknownBackend(t *testing.T) {
	c := Default()
	c.Backend = "smoke-signals"
	err := c.Validate()
	assert.ErrorContains(t, err, "unknown backend")
}

func TestValidateFileBackendRequiresDevice(t *testing.T) {
	c := Default()
	c.Backend = "file"
	c.PrinterDevice = ""
	err := c.Validate()
	assert.ErrorContains(t, err, "printer device")
}
```

- [ ] **Step 2: Add testify dep and verify test fails**

```bash
cd /Users/akkanat/Projects/queue-system/agent
go get github.com/stretchr/testify/assert
go test ./config/...
```

Expected: FAIL with `undefined: Default` (module doesn't exist yet).

- [ ] **Step 3: Implement `agent/config/config.go`**

```go
// Package config holds runtime configuration for the agent.
// Values are sourced (in order): built-in defaults → env vars → CLI flags.
package config

import (
	"fmt"
	"os"
	"strconv"
)

type Backend string

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
go test ./config/...
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/config/ agent/go.mod agent/go.sum
git commit -m "feat(agent): add config package (env + defaults + validation)"
```

---

### Task 3: Printer writer abstraction

**Files:**
- Create: `agent/printer/writer.go`
- Create: `agent/printer/writer_test.go`

- [ ] **Step 1: Write failing test** — `agent/printer/writer_test.go`

```go
package printer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNullWriterDiscards(t *testing.T) {
	w := NewNullWriter()
	n, err := w.Write([]byte("hello"))
	assert.NoError(t, err)
	assert.Equal(t, 5, n)
}

func TestNullWriterRecordsCalls(t *testing.T) {
	w := NewNullWriter()
	_, _ = w.Write([]byte("first"))
	_, _ = w.Write([]byte("second"))
	assert.Equal(t, 2, w.Calls())
	assert.Equal(t, []byte("firstsecond"), w.Buffer())
}

func TestCUPSWriterCommand(t *testing.T) {
	w := newCUPSWriterWithCmd("XP-80T", "/usr/bin/echo")
	// echo writes the piped stdin to stdout, so write should not error
	n, err := w.Write([]byte("abc"))
	assert.NoError(t, err)
	assert.Equal(t, 3, n)
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd /Users/akkanat/Projects/queue-system/agent
go test ./printer/...
```

Expected: FAIL with `undefined: NewNullWriter`.

- [ ] **Step 3: Implement `agent/printer/writer.go`**

```go
// Package printer implements ticket rendering and delivery to a thermal
// receipt printer. The Writer interface is the seam between the rendering
// code (which just emits ESC/POS bytes) and the physical transport (CUPS,
// raw device file, or a test sink).
package printer

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"time"
)

// Writer accepts raw ESC/POS bytes and delivers them to a printer.
// Implementations must be safe to call from a single goroutine at a time
// (we serialize print jobs in the server).
type Writer interface {
	io.Writer
	// Name returns a short descriptor for logging, e.g. "cups:XP-80T".
	Name() string
}

// -------- NullWriter: test/dev sink --------

type NullWriter struct {
	mu    sync.Mutex
	buf   bytes.Buffer
	calls int
}

func NewNullWriter() *NullWriter { return &NullWriter{} }

func (n *NullWriter) Write(p []byte) (int, error) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.calls++
	return n.buf.Write(p)
}

func (n *NullWriter) Name() string { return "null" }

// Buffer returns a copy of everything written so far (thread-safe).
func (n *NullWriter) Buffer() []byte {
	n.mu.Lock()
	defer n.mu.Unlock()
	out := make([]byte, n.buf.Len())
	copy(out, n.buf.Bytes())
	return out
}

// Calls returns the number of Write() invocations.
func (n *NullWriter) Calls() int {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.calls
}

// Reset clears the internal buffer and call counter.
func (n *NullWriter) Reset() {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.buf.Reset()
	n.calls = 0
}

// -------- FileWriter: writes bytes to a device path (e.g. /dev/usb/lp0) --------

type FileWriter struct {
	path    string
	timeout time.Duration
}

func NewFileWriter(path string, timeout time.Duration) *FileWriter {
	return &FileWriter{path: path, timeout: timeout}
}

func (f *FileWriter) Write(p []byte) (int, error) {
	// Open on each write so /dev/usb/lp0 behaves predictably when the device
	// is unplugged and replugged between jobs.
	fh, err := os.OpenFile(f.path, os.O_WRONLY, 0)
	if err != nil {
		return 0, fmt.Errorf("open %s: %w", f.path, err)
	}
	defer fh.Close()

	if f.timeout > 0 {
		_ = fh.SetWriteDeadline(time.Now().Add(f.timeout))
	}
	return fh.Write(p)
}

func (f *FileWriter) Name() string { return "file:" + f.path }

// -------- CUPSWriter: pipes bytes into `lp -d <name> -o raw` --------

type CUPSWriter struct {
	queue   string
	lpPath  string
	timeout time.Duration
}

// NewCUPSWriter creates a writer that uses the system CUPS stack.
// Discovers `lp` from PATH. Use newCUPSWriterWithCmd for tests.
func NewCUPSWriter(queue string, timeout time.Duration) *CUPSWriter {
	return newCUPSWriterWithCmd(queue, "lp")
}

func newCUPSWriterWithCmd(queue, lpPath string) *CUPSWriter {
	return &CUPSWriter{queue: queue, lpPath: lpPath, timeout: 10 * time.Second}
}

func (c *CUPSWriter) Name() string { return "cups:" + c.queue }

func (c *CUPSWriter) Write(p []byte) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), c.timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, c.lpPath, "-d", c.queue, "-o", "raw")
	cmd.Stdin = bytes.NewReader(p)
	// Capture stderr so we can surface CUPS errors in logs.
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return 0, fmt.Errorf("lp -d %s: %w (stderr: %s)", c.queue, err, stderr.String())
	}
	return len(p), nil
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
go test ./printer/... -run TestNullWriter -v
go test ./printer/... -run TestCUPSWriterCommand -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/printer/writer.go agent/printer/writer_test.go agent/go.mod agent/go.sum
git commit -m "feat(agent): add printer writer abstraction (null/file/cups)"
```

---

### Task 4: ESC/POS low-level command builder

**Files:**
- Create: `agent/printer/escpos.go`
- Create: `agent/printer/escpos_test.go`

- [ ] **Step 1: Write failing test** — `agent/printer/escpos_test.go`

```go
package printer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestInitBytes(t *testing.T) {
	b := NewESC()
	b.Init()
	assert.Equal(t, []byte{0x1B, 0x40}, b.Bytes())
}

func TestAlignCenter(t *testing.T) {
	b := NewESC()
	b.Align(AlignCenter)
	assert.Equal(t, []byte{0x1B, 0x61, 0x01}, b.Bytes())
}

func TestAlignLeftRight(t *testing.T) {
	b := NewESC()
	b.Align(AlignLeft)
	b.Align(AlignRight)
	assert.Equal(t, []byte{0x1B, 0x61, 0x00, 0x1B, 0x61, 0x02}, b.Bytes())
}

func TestSize(t *testing.T) {
	b := NewESC()
	b.Size(3, 3) // 3x width, 3x height => (2<<4)|2 = 0x22
	assert.Equal(t, []byte{0x1D, 0x21, 0x22}, b.Bytes())
}

func TestSizeClampsToMax(t *testing.T) {
	b := NewESC()
	b.Size(99, 99)
	// max allowed by ESC/POS is 8x = index 7 => high nibble 0x70 | low 0x07
	assert.Equal(t, []byte{0x1D, 0x21, 0x77}, b.Bytes())
}

func TestBold(t *testing.T) {
	b := NewESC()
	b.Bold(true)
	b.Bold(false)
	assert.Equal(t, []byte{0x1B, 0x45, 0x01, 0x1B, 0x45, 0x00}, b.Bytes())
}

func TestCodePage(t *testing.T) {
	b := NewESC()
	b.CodePage(46) // PC1251 = Cyrillic
	assert.Equal(t, []byte{0x1B, 0x74, 0x2E}, b.Bytes())
}

func TestTextAndFeed(t *testing.T) {
	b := NewESC()
	b.Text([]byte("hi"))
	b.Feed(2)
	assert.Equal(t, []byte{'h', 'i', 0x0A, 0x0A}, b.Bytes())
}

func TestFullCut(t *testing.T) {
	b := NewESC()
	b.Cut()
	assert.Equal(t, []byte{0x1D, 0x56, 0x00}, b.Bytes())
}

func TestQRCodeEnvelope(t *testing.T) {
	b := NewESC()
	b.QRCode("u")
	// Expect: model select, size, ec, store "u", print
	out := b.Bytes()
	assert.Contains(t, string(out), "u", "payload should be embedded")
	// First three bytes of the model select command
	assert.Equal(t, byte(0x1D), out[0])
	assert.Equal(t, byte(0x28), out[1])
	assert.Equal(t, byte(0x6B), out[2])
}
```

- [ ] **Step 2: Run, confirm failure**

```bash
go test ./printer/... -run TestInitBytes
```

Expected: FAIL with `undefined: NewESC`.

- [ ] **Step 3: Implement `agent/printer/escpos.go`**

```go
package printer

import "bytes"

// Alignment values for ESC a.
type Alignment byte

const (
	AlignLeft   Alignment = 0
	AlignCenter Alignment = 1
	AlignRight  Alignment = 2
)

// ESC is a builder for ESC/POS command streams. Zero value not usable —
// use NewESC(). Calls are chainable via the returned *ESC.
//
// Reference: Epson ESC/POS command manual (Xprinter XP-80T implements the
// standard subset used here).
type ESC struct {
	buf bytes.Buffer
}

func NewESC() *ESC { return &ESC{} }

// Bytes returns the accumulated command stream. Safe to call any time.
func (e *ESC) Bytes() []byte { return e.buf.Bytes() }

// Reset empties the buffer so the builder can be reused.
func (e *ESC) Reset() { e.buf.Reset() }

// Init sends ESC @ — resets the printer to default state.
func (e *ESC) Init() *ESC {
	e.buf.Write([]byte{0x1B, 0x40})
	return e
}

// Align sets text alignment for subsequent lines.
func (e *ESC) Align(a Alignment) *ESC {
	e.buf.Write([]byte{0x1B, 0x61, byte(a)})
	return e
}

// Size scales text from 1..8 (width × height). Values are clamped.
// Encoding: high nibble = height-1, low nibble = width-1.
func (e *ESC) Size(width, height int) *ESC {
	w := clamp(width-1, 0, 7)
	h := clamp(height-1, 0, 7)
	n := byte((h << 4) | w)
	e.buf.Write([]byte{0x1D, 0x21, n})
	return e
}

// Bold toggles emphasized mode.
func (e *ESC) Bold(on bool) *ESC {
	v := byte(0)
	if on {
		v = 1
	}
	e.buf.Write([]byte{0x1B, 0x45, v})
	return e
}

// Underline: n is 0 (off), 1 (1-dot), 2 (2-dot).
func (e *ESC) Underline(n byte) *ESC {
	e.buf.Write([]byte{0x1B, 0x2D, n})
	return e
}

// CodePage selects the printer's active code page. Common values on XP-80T:
//
//	 0 = PC437 (USA)
//	 6 = WPC1252 (Latin-1)
//	17 = PC866 (Cyrillic Russian)
//	46 = WPC1251 (Cyrillic Windows)
func (e *ESC) CodePage(n byte) *ESC {
	e.buf.Write([]byte{0x1B, 0x74, n})
	return e
}

// Text appends raw bytes. Callers are responsible for encoding the bytes
// to the printer's currently-selected code page.
func (e *ESC) Text(b []byte) *ESC {
	e.buf.Write(b)
	return e
}

// Feed advances paper by n lines.
func (e *ESC) Feed(n int) *ESC {
	for i := 0; i < n; i++ {
		e.buf.WriteByte(0x0A)
	}
	return e
}

// Cut triggers a full paper cut.
func (e *ESC) Cut() *ESC {
	e.buf.Write([]byte{0x1D, 0x56, 0x00})
	return e
}

// QRCode emits a QR-code print sequence encoding payload.
//   - Model: 2 (default)
//   - Module size: 6 dots (prints ~20mm wide on 80mm paper)
//   - Error correction: M (15%)
func (e *ESC) QRCode(payload string) *ESC {
	data := []byte(payload)

	// 1. Select model (GS ( k 4 0 65 50 0)
	e.buf.Write([]byte{0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00})

	// 2. Set module size n (GS ( k 3 0 67 n)  — n=1..16
	e.buf.Write([]byte{0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06})

	// 3. Error correction (GS ( k 3 0 69 n)  — 48=L 49=M 50=Q 51=H
	e.buf.Write([]byte{0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31})

	// 4. Store the data (GS ( k pL pH 49 80 48 <data>)
	n := len(data) + 3
	pL := byte(n & 0xFF)
	pH := byte(n >> 8)
	e.buf.Write([]byte{0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30})
	e.buf.Write(data)

	// 5. Print (GS ( k 3 0 49 81 48)
	e.buf.Write([]byte{0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30})

	return e
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
go test ./printer/... -v
```

Expected: all 10 `TestESC*` tests PASS plus prior writer tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/printer/escpos.go agent/printer/escpos_test.go
git commit -m "feat(agent): add ESC/POS command builder (init, align, size, QR, cut)"
```

---

### Task 5: Text encoding — CP1251 + Karakalpak transliteration

**Files:**
- Create: `agent/printer/encoding.go`
- Create: `agent/printer/encoding_test.go`

- [ ] **Step 1: Write failing test** — `agent/printer/encoding_test.go`

```go
package printer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEncodeRussianCP1251(t *testing.T) {
	// "Привет" in CP1251: 0xCF 0xF0 0xE8 0xE2 0xE5 0xF2
	got, err := EncodeRU("Привет")
	assert.NoError(t, err)
	assert.Equal(t, []byte{0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2}, got)
}

func TestEncodeRussianPassesASCII(t *testing.T) {
	got, err := EncodeRU("Queue #1")
	assert.NoError(t, err)
	assert.Equal(t, []byte("Queue #1"), got)
}

func TestTransliterateKarakalpak(t *testing.T) {
	cases := map[string]string{
		"Akademiyalıq":      "Akademiyaliq",
		"Onlayn arza":       "Onlayn arza",
		"hám":               "ha'm",
		"Hújjetler":         "Hu'jjetler",
		"Ózlestiriw":        "O'zlestiriw",
		"Ájiniyaz":          "A'jiniyaz",
		"Ǵálaba":            "G'alaba",
		"Talonńın":          "Talonn'in",
		"Buyrıqlar":         "Buyriqlar",
	}
	for in, want := range cases {
		assert.Equal(t, want, TransliterateKAA(in), "input %q", in)
	}
}

func TestEncodeKAAIsASCIIAfterTranslit(t *testing.T) {
	got := EncodeKAA("Jataqxanaǵa jaylasıw")
	// Plain ASCII, nothing above 0x7F
	for i, b := range got {
		assert.LessOrEqual(t, b, byte(0x7E), "byte %d (%q) should be ASCII", i, b)
	}
}
```

- [ ] **Step 2: Run, confirm failure**

```bash
go test ./printer/... -run TestEncodeRussian
```

Expected: FAIL with `undefined: EncodeRU`.

- [ ] **Step 3: Implement `agent/printer/encoding.go`**

```go
package printer

import (
	"golang.org/x/text/encoding/charmap"
	"strings"
)

// EncodeRU converts a UTF-8 string into Windows-1251 bytes suitable for
// ESC/POS printing when the printer's active code page is WPC1251 (46).
// Any character not representable in CP1251 is replaced with '?'.
func EncodeRU(s string) ([]byte, error) {
	enc := charmap.Windows1251.NewEncoder()
	// Encoder.Bytes silently replaces untranslatable runes with '?'.
	return enc.Bytes([]byte(s))
}

// EncodeKAA transliterates Karakalpak text to plain ASCII and returns the
// bytes. Used on the ticket when the printer is in an ASCII-compatible code
// page. See TransliterateKAA for the glyph → digraph mapping.
func EncodeKAA(s string) []byte {
	return []byte(TransliterateKAA(s))
}

// TransliterateKAA converts Karakalpak-Latin diacritics to ASCII digraphs.
// Mapping (UPPER first, then lower):
//
//	Á/á → A'/a'        Ǵ/ǵ → G'/g'       Ń/ń → N'/n'
//	Ó/ó → O'/o'        Ú/ú → U'/u'       ı    → i
//	I   → I            Í/ı́ → i'         Ş/ş → Sh/sh
//	Sh stays as Sh; Ch, Yo, Yu, Ya, Ts are left as the original Latin chars.
func TransliterateKAA(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if repl, ok := translitMap[r]; ok {
			b.WriteString(repl)
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// Explicit per-rune map so behaviour is predictable and easy to extend.
var translitMap = map[rune]string{
	'Á':  "A'",
	'á':  "a'",
	'Ǵ':  "G'",
	'ǵ':  "g'",
	'Ń':  "N'",
	'ń':  "n'",
	'Ó':  "O'",
	'ó':  "o'",
	'Ú':  "U'",
	'ú':  "u'",
	'Í':  "I'",
	'í':  "i'",
	'Ǽ':  "AE",
	'ǽ':  "ae",
	'Ħ':  "H",
	'ħ':  "h",
	'Ș':  "S",
	'ș':  "s",
	'Ț':  "T",
	'ț':  "t",
	'İ':  "I",
	'ı':  "i",
	// Cyrillic letters occasionally found mixed in — leave them alone
	// (caller should use EncodeRU for Russian text).
}
```

- [ ] **Step 4: Add `x/text` dep and run tests**

```bash
cd /Users/akkanat/Projects/queue-system/agent
go get golang.org/x/text/encoding/charmap
go test ./printer/...
```

Expected: all encoding tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/printer/encoding.go agent/printer/encoding_test.go agent/go.mod agent/go.sum
git commit -m "feat(agent): add CP1251 encoder + Karakalpak transliteration"
```

---

### Task 6: Ticket template renderer

**Files:**
- Create: `agent/printer/template.go`
- Create: `agent/printer/template_test.go`

- [ ] **Step 1: Write failing test** — `agent/printer/template_test.go`

```go
package printer

import (
	"bytes"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func sampleRequest() PrintRequest {
	return PrintRequest{
		Number:            "A042",
		CategoryCode:      "A",
		CategoryNameKaa:   "Akademiyalıq iskerlik",
		CategoryNameRu:    "Академическая деятельность",
		ServiceNameKaa:    "Akademiyalıq maǵlıwmatnama hám transkript alıw",
		ServiceNameRu:     "Получение академической справки и транскрипта",
		IssuedAt:          time.Date(2026, 4, 20, 14, 30, 0, 0, time.UTC),
		TicketID:          "b4a8d8f3-1234-4bcd-9abc-123456789abc",
	}
}

func TestRenderIncludesTicketNumber(t *testing.T) {
	out, err := Render(sampleRequest())
	assert.NoError(t, err)
	// Ticket number is ASCII — should appear verbatim in the byte stream.
	assert.Contains(t, string(out), "A042")
}

func TestRenderIncludesCutAndInitMarkers(t *testing.T) {
	out, err := Render(sampleRequest())
	assert.NoError(t, err)
	// Starts with ESC @ (init)
	assert.True(t, bytes.HasPrefix(out, []byte{0x1B, 0x40}))
	// Contains full-cut sequence
	assert.Contains(t, string(out), string([]byte{0x1D, 0x56, 0x00}))
}

func TestRenderIncludesQRCodePayload(t *testing.T) {
	req := sampleRequest()
	out, err := Render(req)
	assert.NoError(t, err)
	assert.Contains(t, string(out), req.TicketID, "QR payload = ticket UUID")
}

func TestRenderTransliteratesKarakalpak(t *testing.T) {
	req := sampleRequest()
	out, err := Render(req)
	assert.NoError(t, err)
	// "hám" → "ha'm" on paper
	assert.Contains(t, string(out), "ha'm")
	// Original diacritic must NOT appear as raw UTF-8
	assert.NotContains(t, string(out), "hám")
}

func TestRenderEncodesRussianAsCP1251(t *testing.T) {
	req := sampleRequest()
	out, err := Render(req)
	assert.NoError(t, err)
	// "Академическая" in CP1251 starts with 0xC0 0xEA 0xE0 0xE4 0xE5 ...
	expected := []byte{0xC0, 0xEA, 0xE0, 0xE4, 0xE5}
	assert.True(t, bytes.Contains(out, expected),
		"CP1251-encoded Russian should be present in output")
}

func TestRenderWrapsLongServiceName(t *testing.T) {
	req := sampleRequest()
	req.ServiceNameKaa = "A very long service name that absolutely will not fit on a single 72mm-wide receipt line even after all the transliteration"
	out, err := Render(req)
	assert.NoError(t, err)
	// Body contains LF multiple times within the wrapped service name area.
	// Minimum sanity: output length > 200 bytes (original without wrap is ~140).
	assert.Greater(t, len(out), 200)
}
```

- [ ] **Step 2: Run, confirm failure**

```bash
go test ./printer/... -run TestRender
```

Expected: FAIL with `undefined: Render`.

- [ ] **Step 3: Implement `agent/printer/template.go`**

```go
package printer

import (
	"fmt"
	"strings"
	"time"
)

// PrintRequest is the payload sent by the kiosk for every printed ticket.
// Field names match the JSON keys used on the wire (snake_case via struct
// tags on server.PrintRequest, which embeds this).
type PrintRequest struct {
	Number          string    // e.g. "A042"
	CategoryCode    string    // "A".."I"
	CategoryNameKaa string    // Karakalpak name
	CategoryNameRu  string    // Russian name
	ServiceNameKaa  string    // Karakalpak service name
	ServiceNameRu   string    // Russian service name
	IssuedAt        time.Time // UTC
	TicketID        string    // UUID — goes into the QR code
}

const (
	// Max characters per line on an 80 mm printer at Font A (12 cpi).
	lineWidth = 42
)

// Render builds the full ESC/POS byte stream for one ticket.
//
// Layout (top to bottom):
//
//	[Init]
//	"АДЖИНИЯЗ АТЫНДАҒЫ НДПИ"        (CP1251, centered, bold)
//	"Registrator ofisi"             (ASCII, centered)
//	-------- dashed rule --------
//	"SIZIŃ NOMERIŃIZ / ВАШ НОМЕР"   (centered, small)
//	[Number — 4x width/height]       e.g. "A042"
//	-------- dashed rule --------
//	KAT    <category (KAA transliterated)>
//	       <category (RU CP1251)>
//	XIZMET <service (KAA)>
//	       <service (RU)>
//	        word-wrapped to 42 cols
//	-------- dashed rule --------
//	"2026-04-20 14:30"              (mono)
//	[QR code with ticket UUID]
//	[3 line feeds]
//	[Cut]
func Render(req PrintRequest) ([]byte, error) {
	e := NewESC()

	e.Init().CodePage(46) // CP1251 for Russian

	// Header
	e.Align(AlignCenter).Bold(true)
	hdr, err := EncodeRU("АДЖИНИЯЗ АТЫНДАҒЫ НДПИ")
	if err != nil {
		return nil, fmt.Errorf("encode header: %w", err)
	}
	e.Text(hdr).Feed(1)
	e.Bold(false).Text(EncodeKAA("Registrator ofisi")).Feed(1)

	e.Text([]byte(dashLine())).Feed(1)

	// Number eyebrow
	e.Size(1, 1)
	eyebrow, err := EncodeRU("ВАШ НОМЕР")
	if err != nil {
		return nil, fmt.Errorf("encode eyebrow: %w", err)
	}
	e.Text(eyebrow).Feed(1)

	// Big number
	e.Size(4, 4).Text([]byte(req.Number)).Feed(1)
	e.Size(1, 1)

	e.Text([]byte(dashLine())).Feed(1)

	// Category + service — bilingual
	e.Align(AlignLeft)
	e.Bold(true).Text([]byte("KAT  ")).Bold(false)
	e.Text(EncodeKAA(req.CategoryNameKaa)).Feed(1)
	cat, err := EncodeRU("     " + req.CategoryNameRu)
	if err != nil {
		return nil, err
	}
	e.Text(cat).Feed(1)

	kaaLines := wrap(TransliterateKAA(req.ServiceNameKaa), lineWidth-5)
	for i, ln := range kaaLines {
		if i == 0 {
			e.Bold(true).Text([]byte("XIZ  ")).Bold(false)
		} else {
			e.Text([]byte("     "))
		}
		e.Text([]byte(ln)).Feed(1)
	}
	for _, ln := range wrap(req.ServiceNameRu, lineWidth-5) {
		encoded, err := EncodeRU(ln)
		if err != nil {
			return nil, err
		}
		e.Text([]byte("     ")).Text(encoded).Feed(1)
	}

	e.Text([]byte(dashLine())).Feed(1)

	// Timestamp
	e.Align(AlignCenter)
	stamp := req.IssuedAt.Local().Format("2006-01-02  15:04")
	e.Text([]byte(stamp)).Feed(2)

	// QR code
	e.QRCode(req.TicketID).Feed(1)

	// Leave space for tear-off and cut
	e.Feed(3).Cut()

	return e.Bytes(), nil
}

func dashLine() string {
	return strings.Repeat("-", lineWidth)
}

// wrap breaks s into lines not longer than width, breaking on spaces.
// Pure ASCII input only (run after EncodeKAA / before EncodeRU caller decides).
func wrap(s string, width int) []string {
	if width <= 0 {
		return []string{s}
	}
	words := strings.Fields(s)
	if len(words) == 0 {
		return []string{""}
	}
	var out []string
	cur := words[0]
	for _, w := range words[1:] {
		if len(cur)+1+len(w) <= width {
			cur = cur + " " + w
			continue
		}
		out = append(out, cur)
		cur = w
	}
	out = append(out, cur)
	return out
}
```

Note: the wrap routine operates on runes-as-bytes, which is fine because
ASCII-after-transliteration has one byte per rune. The Russian wrap path
receives UTF-8 runes which are multi-byte — `strings.Fields` still splits
correctly on whitespace, and byte-length is close enough to rune count for
a 42-col budget. Good enough for Phase 2; we can tighten with rune counting
later if receipt widths get off.

- [ ] **Step 4: Run tests**

```bash
go test ./printer/... -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/printer/template.go agent/printer/template_test.go
git commit -m "feat(agent): render bilingual ticket ESC/POS stream with QR code"
```

---

### Task 7: HTTP server

**Files:**
- Create: `agent/server/server.go`
- Create: `agent/server/server_test.go`

- [ ] **Step 1: Write failing test** — `agent/server/server_test.go`

```go
package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ndpi/queue-agent/printer"
)

func newTestServer(t *testing.T) (*Server, *printer.NullWriter) {
	t.Helper()
	nw := printer.NewNullWriter()
	s, err := New(Options{Writer: nw})
	require.NoError(t, err)
	return s, nw
}

func TestHealthOK(t *testing.T) {
	s, _ := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"ok":true`)
}

func TestPrintHappyPath(t *testing.T) {
	s, nw := newTestServer(t)

	payload := `{
		"number": "B017",
		"category_code": "B",
		"category_name_kaa": "Onlayn arza tapsırıw",
		"category_name_ru": "Подача онлайн-заявлений",
		"service_name_kaa": "Jataqxanaǵa jaylasıw arzası",
		"service_name_ru": "Заявление на общежитие",
		"issued_at": "2026-04-20T14:30:00Z",
		"ticket_id": "abc-123"
	}`

	req := httptest.NewRequest(http.MethodPost, "/print",
		strings.NewReader(payload))
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()

	s.Router().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 1, nw.Calls(), "one print call expected")
	// The number should be in the raw output
	assert.Contains(t, string(nw.Buffer()), "B017")
}

func TestPrintRejectsInvalidJSON(t *testing.T) {
	s, _ := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/print",
		strings.NewReader("{not json"))
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPrintRejectsWrongMethod(t *testing.T) {
	s, _ := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/print", nil)
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusMethodNotAllowed, rec.Code)
}

func TestPrintAcceptsMissingTimestamp(t *testing.T) {
	s, _ := newTestServer(t)
	payload := `{"number":"A001","category_code":"A","ticket_id":"x"}`
	req := httptest.NewRequest(http.MethodPost, "/print",
		strings.NewReader(payload))
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code,
		"issued_at should default to server's current time")
}

// Utility: body decodes as JSON success envelope.
func assertJSONSuccess(t *testing.T, body io.Reader) {
	var got struct {
		OK bool `json:"ok"`
	}
	b, _ := io.ReadAll(body)
	require.NoError(t, json.NewDecoder(bytes.NewReader(b)).Decode(&got))
	assert.True(t, got.OK, "body = %s", string(b))
}

func TestPrintSuccessEnvelope(t *testing.T) {
	s, _ := newTestServer(t)
	payload := `{"number":"A007","category_code":"A","ticket_id":"x","issued_at":"2026-04-20T10:00:00Z"}`
	req := httptest.NewRequest(http.MethodPost, "/print",
		strings.NewReader(payload))
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assertJSONSuccess(t, rec.Body)
	_ = time.Now
}
```

- [ ] **Step 2: Run, confirm failure**

```bash
cd /Users/akkanat/Projects/queue-system/agent
go test ./server/...
```

Expected: FAIL with `undefined: New`.

- [ ] **Step 3: Implement `agent/server/server.go`**

```go
// Package server exposes the agent's HTTP endpoints (POST /print, GET /health).
package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/ndpi/queue-agent/printer"
)

// Options wires concrete dependencies into the server.
type Options struct {
	Writer printer.Writer // where to send ESC/POS bytes
	Logger *slog.Logger   // nil ⇒ slog.Default()
}

// Server owns the HTTP router and serializes print jobs.
type Server struct {
	writer printer.Writer
	log    *slog.Logger

	// Serialize print jobs — most thermal printers cannot interleave.
	mu sync.Mutex
}

// New validates options and returns a ready-to-serve Server.
func New(opt Options) (*Server, error) {
	if opt.Writer == nil {
		return nil, fmt.Errorf("server: Writer is required")
	}
	log := opt.Logger
	if log == nil {
		log = slog.Default()
	}
	return &Server{writer: opt.Writer, log: log}, nil
}

// Router returns an http.Handler covering all agent endpoints.
func (s *Server) Router() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/print", s.handlePrint)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"writer": s.writer.Name(),
	})
}

// printRequest is the JSON schema accepted by POST /print.
type printRequest struct {
	Number          string    `json:"number"`
	CategoryCode    string    `json:"category_code"`
	CategoryNameKaa string    `json:"category_name_kaa"`
	CategoryNameRu  string    `json:"category_name_ru"`
	ServiceNameKaa  string    `json:"service_name_kaa"`
	ServiceNameRu   string    `json:"service_name_ru"`
	IssuedAt        time.Time `json:"issued_at"`
	TicketID        string    `json:"ticket_id"`
}

func (s *Server) handlePrint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("allow", "POST")
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{
			"ok":    false,
			"error": "method not allowed",
		})
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<16))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "read body: " + err.Error(),
		})
		return
	}

	var req printRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "invalid json: " + err.Error(),
		})
		return
	}

	if req.Number == "" || req.TicketID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "number and ticket_id are required",
		})
		return
	}
	if req.IssuedAt.IsZero() {
		req.IssuedAt = time.Now().UTC()
	}

	s.log.Info("print requested",
		"number", req.Number,
		"category", req.CategoryCode,
		"ticket_id", req.TicketID,
	)

	bytesOut, err := printer.Render(printer.PrintRequest{
		Number:          req.Number,
		CategoryCode:    req.CategoryCode,
		CategoryNameKaa: req.CategoryNameKaa,
		CategoryNameRu:  req.CategoryNameRu,
		ServiceNameKaa:  req.ServiceNameKaa,
		ServiceNameRu:   req.ServiceNameRu,
		IssuedAt:        req.IssuedAt,
		TicketID:        req.TicketID,
	})
	if err != nil {
		s.log.Error("render failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"ok":    false,
			"error": "render: " + err.Error(),
		})
		return
	}

	s.mu.Lock()
	_, werr := s.writer.Write(bytesOut)
	s.mu.Unlock()
	if werr != nil {
		s.log.Error("printer write failed", "err", werr, "writer", s.writer.Name())
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"ok":    false,
			"error": "printer: " + werr.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"number": req.Number,
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("content-type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
```

- [ ] **Step 4: Run tests**

```bash
go test ./server/... -v
```

Expected: all 6 server tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/server/
git commit -m "feat(agent): HTTP server with POST /print + GET /health"
```

---

### Task 8: Wire it all up in `main.go`

**Files:**
- Modify: `agent/main.go`

- [ ] **Step 1: Replace `agent/main.go`**

```go
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ndpi/queue-agent/config"
	"github.com/ndpi/queue-agent/printer"
	"github.com/ndpi/queue-agent/server"
)

var Version = "dev"

func main() {
	cfg := config.FromEnv(config.Default())

	// CLI flags override env
	addr := flag.String("addr", cfg.Addr, "HTTP listen address")
	backend := flag.String("backend", string(cfg.Backend), "printer backend: cups|file|null")
	printerName := flag.String("printer-name", cfg.PrinterName, "CUPS printer queue name")
	printerDevice := flag.String("printer-device", cfg.PrinterDevice, "raw device path, e.g. /dev/usb/lp0")
	printSecs := flag.Float64("print-timeout-seconds", cfg.PrintTimeoutSeconds, "write-to-printer timeout (seconds)")
	logFile := flag.String("log-file", cfg.LogFile, "append structured logs to this file (stdout too)")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("ndpi-queue-agent", Version)
		return
	}

	cfg.Addr = *addr
	cfg.Backend = config.Backend(*backend)
	cfg.PrinterName = *printerName
	cfg.PrinterDevice = *printerDevice
	cfg.PrintTimeoutSeconds = *printSecs
	cfg.LogFile = *logFile

	if err := cfg.Validate(); err != nil {
		fmt.Fprintln(os.Stderr, "config error:", err)
		os.Exit(2)
	}

	logger, err := buildLogger(cfg.LogFile)
	if err != nil {
		fmt.Fprintln(os.Stderr, "logger error:", err)
		os.Exit(2)
	}

	writer, err := newWriter(cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, "writer error:", err)
		os.Exit(2)
	}

	srv, err := server.New(server.Options{Writer: writer, Logger: logger})
	if err != nil {
		fmt.Fprintln(os.Stderr, "server error:", err)
		os.Exit(2)
	}

	httpSrv := &http.Server{
		Addr:         cfg.Addr,
		Handler:      srv.Router(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 20 * time.Second, // printing can be slow
		IdleTimeout:  60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(),
		syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("agent started",
			"addr", cfg.Addr,
			"backend", cfg.Backend,
			"writer", writer.Name(),
			"version", Version,
		)
		if err := httpSrv.ListenAndServe(); err != nil &&
			!errors.Is(err, http.ErrServerClosed) {
			logger.Error("http server crashed", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
}

func newWriter(c config.Config) (printer.Writer, error) {
	timeout := time.Duration(c.PrintTimeoutSeconds * float64(time.Second))
	switch c.Backend {
	case config.BackendCUPS:
		return printer.NewCUPSWriter(c.PrinterName, timeout), nil
	case config.BackendFile:
		return printer.NewFileWriter(c.PrinterDevice, timeout), nil
	case config.BackendNull:
		return printer.NewNullWriter(), nil
	}
	return nil, fmt.Errorf("unreachable: validated backend %q has no constructor", c.Backend)
}

func buildLogger(logFile string) (*slog.Logger, error) {
	// Default: stdout, text format.
	var out *os.File = os.Stdout
	if logFile != "" {
		f, err := os.OpenFile(logFile,
			os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return nil, err
		}
		// Duplicate to stdout too — systemd / terminal still see logs.
		// Write to a multi-writer by wrapping.
		mw := &multiWriter{a: os.Stdout, b: f}
		handler := slog.NewTextHandler(mw, &slog.HandlerOptions{Level: slog.LevelInfo})
		return slog.New(handler), nil
	}
	handler := slog.NewTextHandler(out, &slog.HandlerOptions{Level: slog.LevelInfo})
	return slog.New(handler), nil
}

type multiWriter struct{ a, b *os.File }

func (m *multiWriter) Write(p []byte) (int, error) {
	_, _ = m.a.Write(p)
	return m.b.Write(p)
}
```

- [ ] **Step 2: Build and smoke-test**

```bash
cd /Users/akkanat/Projects/queue-system/agent
go build -o dist/agent .

# Run against the null backend (no printer needed)
AGENT_BACKEND=null ./dist/agent &
AGENT_PID=$!
sleep 1
curl -s http://127.0.0.1:8089/health
echo
curl -s -X POST http://127.0.0.1:8089/print \
  -H "content-type: application/json" \
  -d '{"number":"A001","category_code":"A","category_name_kaa":"Akademiyalıq iskerlik","category_name_ru":"Академическая деятельность","service_name_kaa":"test","service_name_ru":"тест","issued_at":"2026-04-20T14:30:00Z","ticket_id":"smoke-1"}'
echo
kill $AGENT_PID
wait $AGENT_PID 2>/dev/null || true
```

Expected: `/health` returns `{"ok":true,"writer":"null"}`; `/print` returns `{"ok":true,"number":"A001"}`.

- [ ] **Step 3: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/main.go
git commit -m "feat(agent): wire main — flags, signals, logger, writer selection"
```

---

### Task 9: Manual smoke-test script + systemd unit

**Files:**
- Create: `agent/scripts/test-print.sh`
- Create: `agent/systemd/ndpi-queue-agent.service`

- [ ] **Step 1: Create `agent/scripts/test-print.sh`**

```bash
#!/usr/bin/env bash
# Sends a test print job to a running agent. Useful for verifying the printer
# is wired correctly. Requires `curl` and a running agent on :8089.
#
# Usage: ./test-print.sh [AGENT_URL]
#   AGENT_URL defaults to http://127.0.0.1:8089

set -euo pipefail

URL="${1:-http://127.0.0.1:8089}"

payload=$(cat <<'JSON'
{
  "number": "TEST01",
  "category_code": "A",
  "category_name_kaa": "Akademiyalıq iskerlik",
  "category_name_ru": "Академическая деятельность",
  "service_name_kaa": "Akademiyalıq maǵlıwmatnama hám transkript alıw",
  "service_name_ru": "Получение академической справки и транскрипта",
  "issued_at": "2026-04-20T14:30:00Z",
  "ticket_id": "smoke-test-0001"
}
JSON
)

echo "health check → $URL/health"
curl -fsS "$URL/health" && echo
echo
echo "sending test print to $URL/print…"
curl -fsS -X POST "$URL/print" \
  -H "content-type: application/json" \
  -d "$payload" && echo
```

Make executable:

```bash
chmod +x /Users/akkanat/Projects/queue-system/agent/scripts/test-print.sh
```

- [ ] **Step 2: Create `agent/systemd/ndpi-queue-agent.service`**

```ini
[Unit]
Description=NDPI Queue System — local printer agent
After=network.target cups.service
Wants=cups.service

[Service]
Type=simple
User=ndpi-agent
Group=ndpi-agent
ExecStart=/usr/local/bin/ndpi-queue-agent
Environment=AGENT_ADDR=127.0.0.1:8089
Environment=AGENT_BACKEND=cups
Environment=AGENT_PRINTER_NAME=XP-80T
Environment=AGENT_LOG_FILE=/var/log/ndpi-queue-agent.log
Restart=on-failure
RestartSec=3
# Reasonable lockdown for a local agent
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/ndpi-queue-agent.log
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/scripts/ agent/systemd/
git commit -m "chore(agent): add test-print smoke script and systemd unit"
```

---

### Task 10: agent/README.md

**Files:**
- Create: `agent/README.md`

- [ ] **Step 1: Create `agent/README.md`**

```markdown
# NDPI Queue Agent

Local printer agent for the NDPI electronic-queue system.
Listens on `localhost:8089`; the kiosk frontend calls `POST /print` whenever
a student confirms a service, and the agent delivers ESC/POS bytes to an
**Xprinter XP-80T** thermal receipt printer.

## Layout

- `main.go` — bootstrap, flags, graceful shutdown
- `config/`  — env + flags → `Config`
- `printer/` — ESC/POS command builder, encoding (CP1251 + KAA transliteration), ticket template, writer backends
- `server/`  — HTTP handlers (`POST /print`, `GET /health`)
- `scripts/test-print.sh` — manual smoke test
- `systemd/ndpi-queue-agent.service` — Linux service unit

## Build

```bash
cd agent
go build -o dist/agent .
```

## Run (quick-start)

### macOS — with Xprinter XP-80T connected via USB

1. Install the manufacturer driver once (downloads from `xprintertech.com` or
   similar). The printer then appears as a CUPS queue; find its name:

   ```bash
   lpstat -p
   # printer XP-80T is idle.  enabled since …
   ```

2. Start the agent using that queue name:

   ```bash
   AGENT_BACKEND=cups AGENT_PRINTER_NAME=XP-80T ./dist/agent
   ```

3. Verify:

   ```bash
   ./scripts/test-print.sh
   ```

   A test ticket should print with header, a large `TEST01` number, bilingual
   category/service, timestamp, and a QR code.

### Linux (Ubuntu 24.04)

Option A — via CUPS (recommended; same flow as macOS after setup):

```bash
sudo apt install cups cups-client
# add printer via web UI at http://localhost:631 or
sudo lpadmin -p XP-80T -E -v usb://... -m raw
AGENT_BACKEND=cups AGENT_PRINTER_NAME=XP-80T ./dist/agent
```

Option B — raw device (no CUPS):

```bash
ls /dev/usb/lp*           # confirm lp0 exists
sudo usermod -aG lp $USER # allow current user to write to it; log out/in
AGENT_BACKEND=file AGENT_PRINTER_DEVICE=/dev/usb/lp0 ./dist/agent
```

### Dev mode (no real printer)

```bash
AGENT_BACKEND=null ./dist/agent
# Prints to stdout-style logs only; great for smoke-testing from the kiosk.
```

## Configuration

| Env var                         | Flag                    | Default             | Notes |
|---------------------------------|-------------------------|---------------------|-------|
| `AGENT_ADDR`                    | `-addr`                 | `127.0.0.1:8089`    | HTTP listen address |
| `AGENT_BACKEND`                 | `-backend`              | `cups`              | `cups` / `file` / `null` |
| `AGENT_PRINTER_NAME`            | `-printer-name`         | `XP-80T`            | CUPS queue name |
| `AGENT_PRINTER_DEVICE`          | `-printer-device`       | *(empty)*           | e.g. `/dev/usb/lp0` when backend=file |
| `AGENT_PRINT_TIMEOUT_SECONDS`   | `-print-timeout-seconds`| `10`                | Per-job write timeout |
| `AGENT_LOG_FILE`                | `-log-file`             | *(stdout only)*     | Appends to this file + stdout |

## API

### `GET /health`

```
{ "ok": true, "writer": "cups:XP-80T" }
```

### `POST /print`

Request:

```json
{
  "number": "A042",
  "category_code": "A",
  "category_name_kaa": "Akademiyalıq iskerlik",
  "category_name_ru": "Академическая деятельность",
  "service_name_kaa": "Akademiyalıq maǵlıwmatnama hám transkript alıw",
  "service_name_ru": "Получение академической справки и транскрипта",
  "issued_at": "2026-04-20T14:30:00Z",
  "ticket_id": "b4a8d8f3-1234-4bcd-9abc-123456789abc"
}
```

Response `200 OK`:

```json
{ "ok": true, "number": "A042" }
```

Errors return `4xx` / `5xx` with `{"ok": false, "error": "…"}`.

## Known limitations (v1)

- **Karakalpak diacritics** (`ǵ`, `ń`, `á`, `ó`, `ú`) are printed with an
  ASCII digraph fallback (`g'`, `n'`, `a'`, `o'`, `u'`). This is because
  thermal printers only have one code page active at a time and we picked
  CP1251 for Russian. A v2 upgrade can render KAA text as a raster bitmap
  and combine both scripts on the same ticket.
- **Windows not supported.** The `file` backend path format is POSIX. A
  future Windows backend can use named-pipe raw printing.
- **No retry.** A failed `Write` returns `502`. The kiosk retries via the
  same idempotency-key path.

## Deploying on the kiosk PC (Ubuntu)

```bash
sudo cp dist/agent /usr/local/bin/ndpi-queue-agent
sudo useradd --system --no-create-home --shell /usr/sbin/nologin ndpi-agent
sudo usermod -aG lp ndpi-agent
sudo touch /var/log/ndpi-queue-agent.log
sudo chown ndpi-agent:ndpi-agent /var/log/ndpi-queue-agent.log
sudo cp systemd/ndpi-queue-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ndpi-queue-agent
sudo systemctl status ndpi-queue-agent
```
```

- [ ] **Step 2: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add agent/README.md
git commit -m "docs(agent): add README with mac/linux setup and API reference"
```

---

### Task 11: Update kiosk `lib/printer.ts` to call the real agent

**Files:**
- Modify: `apps/kiosk/lib/printer.ts`

- [ ] **Step 1: Replace `apps/kiosk/lib/printer.ts`**

```ts
import type { Ticket, Service, ServiceCategory } from '@queue/types';

export interface PrintResult {
  ok: boolean;
  error?: string;
}

export interface PrintContext {
  ticket: Ticket;
  category: ServiceCategory;
  service: Service | null;
}

/**
 * POSTs the ticket to the local Go agent at NEXT_PUBLIC_AGENT_URL
 * (default http://localhost:8089). The agent drives the Xprinter XP-80T
 * via ESC/POS and returns { ok: true } on success.
 *
 * For development without a physical printer, set
 *   NEXT_PUBLIC_FORCE_PRINTER_FAIL=1   (always fails — test error flow)
 *   NEXT_PUBLIC_PRINTER_MOCK=1         (always succeeds — no network)
 */
export async function printTicket(
  input: Ticket | PrintContext,
): Promise<PrintResult> {
  if (process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL === '1') {
    return { ok: false, error: 'forced failure' };
  }

  const ctx: PrintContext | null =
    'ticket' in input ? input : ({ ticket: input, category: null as unknown as ServiceCategory, service: null });

  if (process.env.NEXT_PUBLIC_PRINTER_MOCK === '1') {
    // eslint-disable-next-line no-console
    console.log('[mock-printer]', ctx.ticket.number);
    return { ok: true };
  }

  const base = process.env.NEXT_PUBLIC_AGENT_URL ?? 'http://localhost:8089';

  const body = {
    number: ctx.ticket.number,
    category_code: ctx.category?.code ?? '',
    category_name_kaa: ctx.category?.name_kaa ?? '',
    category_name_ru: ctx.category?.name_ru ?? '',
    service_name_kaa: ctx.service?.name_kaa ?? '',
    service_name_ru: ctx.service?.name_ru ?? '',
    issued_at: ctx.ticket.created_at,
    ticket_id: ctx.ticket.id,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(`${base}/print`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `agent returned ${res.status}` };
    }
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (json.ok) return { ok: true };
    return { ok: false, error: json.error ?? 'unknown agent error' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 2: Update the confirm page to pass category + service**

Modify `apps/kiosk/app/[locale]/confirm/page.tsx` — in the `onSuccess`
handler of the mutation, call `printTicket` with the context object:

```tsx
onSuccess: async (ticket) => {
  setTicket(ticket);
  const result = await printTicket({ ticket, category, service });
  if (!result.ok) {
    router.push(`/${locale}/error`);
    return;
  }
  router.push(`/${locale}/ticket`);
},
```

The `category` and `service` come from the existing destructuring at the top
of the page (`const { category, service, ... } = useKioskStore();`).

- [ ] **Step 3: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/kiosk/lib/printer.ts apps/kiosk/app/[locale]/confirm/page.tsx
git commit -m "feat(kiosk): POST tickets to Go agent at localhost:8089"
```

---

### Task 12: Update kiosk `printer.test.ts` to match the new implementation

**Files:**
- Modify: `apps/kiosk/tests/printer.test.ts`

- [ ] **Step 1: Replace the test file**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printTicket } from '@/lib/printer';
import type { Ticket, ServiceCategory, Service } from '@queue/types';

const sampleTicket: Ticket = {
  id: 't1',
  number: 'A042',
  category_id: 1,
  service_id: 5,
  status: 'waiting',
  counter_id: null,
  created_at: new Date('2026-04-20T14:30:00Z').toISOString(),
};

const sampleCategory: ServiceCategory = {
  id: 1,
  code: 'A',
  name_kaa: 'Akademiyalıq iskerlik',
  name_ru: 'Академическая деятельность',
  color: '#7A8FA3',
  order: 1,
};

const sampleService: Service = {
  id: 5,
  category_id: 1,
  name_kaa: 'Test xızmet',
  name_ru: 'Тестовая услуга',
  sla_days: 0,
  delivery_type: 'electron',
  requires_visit: true,
  is_active: true,
};

const ctx = { ticket: sampleTicket, category: sampleCategory, service: sampleService };

describe('printTicket', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    // Each test installs its own stub
    globalThis.fetch = vi.fn() as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.NEXT_PUBLIC_PRINTER_MOCK;
    delete process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL;
    vi.restoreAllMocks();
  });

  it('succeeds when the agent returns ok:true', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, number: 'A042' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await printTicket(ctx);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/print');
    expect(init!.method).toBe('POST');
    const body = JSON.parse(init!.body as string);
    expect(body.number).toBe('A042');
    expect(body.category_code).toBe('A');
    expect(body.ticket_id).toBe('t1');
  });

  it('fails when the agent returns an error payload', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'offline' }), {
        status: 200,
      }),
    );
    const result = await printTicket(ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('offline');
  });

  it('fails when the agent returns non-2xx', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(new Response('', { status: 502 }));
    const result = await printTicket(ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('502');
  });

  it('fails when fetch itself throws (agent down)', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const result = await printTicket(ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('respects FORCE_PRINTER_FAIL without touching fetch', async () => {
    process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL = '1';
    const result = await printTicket(ctx);
    expect(result.ok).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('respects PRINTER_MOCK without touching fetch', async () => {
    process.env.NEXT_PUBLIC_PRINTER_MOCK = '1';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await printTicket(ctx);
    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('[mock-printer]', 'A042');
  });

  it('still works when called with a bare Ticket (backward compat)', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const result = await printTicket(sampleTicket);
    expect(result.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.number).toBe('A042');
    expect(body.category_code).toBe(''); // no category provided
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/akkanat/Projects/queue-system/apps/kiosk
pnpm test
```

Expected: 7 printer tests PASS, 3 idle-reset tests PASS (total 10).

- [ ] **Step 3: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/kiosk/tests/printer.test.ts
git commit -m "test(kiosk): rewrite printer tests against real agent fetch API"
```

---

### Task 13: Final verification

**Files:** none changed — just run the whole stack.

- [ ] **Step 1: All unit tests green**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm test         # monorepo (packages + kiosk)
(cd agent && go test ./...)
```

Expected: all packages PASS.

- [ ] **Step 2: Typecheck green**

```bash
pnpm typecheck
```

Expected: all three packages typecheck clean.

- [ ] **Step 3: Build the agent and a kiosk production build**

```bash
(cd agent && go build -o dist/agent .)
pnpm --filter @queue/kiosk build
```

Both should succeed without warnings that weren't present before.

- [ ] **Step 4: Two-process smoke test (null backend)**

Terminal A:

```bash
cd /Users/akkanat/Projects/queue-system/agent
AGENT_BACKEND=null ./dist/agent
```

Terminal B:

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/kiosk dev
```

Open `http://localhost:3001/`, walk the flow → pick category A → pick the first
service → confirm → `/ticket`. The agent log should show
`print requested number=A001 category=A ticket_id=…`, the kiosk should navigate
to the ticket screen.

- [ ] **Step 5: (Optional, requires real printer) Paper smoke test**

Connect Xprinter XP-80T via USB. On macOS:

```bash
AGENT_BACKEND=cups AGENT_PRINTER_NAME="XP-80T" ./dist/agent &
./agent/scripts/test-print.sh
```

Expected: a paper ticket emerges with header, huge `TEST01`, category KAT/XIZ
lines in both scripts, timestamp, and a QR code.

- [ ] **Step 6: Mark Phase 2 done in the project README**

Edit `README.md` — change the status line:

```diff
- - ⏳ Phase 2 — Go agent + Xprinter XP-80T
+ - ✅ Phase 2 — Go agent + Xprinter XP-80T
```

Commit:

```bash
git add README.md
git commit -m "docs: mark Phase 2 (agent + printer) complete"
```

---

## Verification Checklist

- [ ] `agent/` Go module builds with `go build`.
- [ ] `go test ./...` in `agent/` shows ≥ 25 PASS cases (writer, escpos, encoding, template, server, config).
- [ ] Kiosk vitest suite is 10/10 green.
- [ ] Kiosk typecheck clean.
- [ ] `agent --backend null` responds 200 on `/health` and `/print` with a valid body.
- [ ] Kiosk end-to-end flow completes against null agent: student taps category → service → confirm → ticket page shows the number, agent logs the request.
- [ ] `agent/README.md` covers Mac CUPS setup, Linux CUPS setup, Linux raw device setup, null dev mode.
- [ ] systemd unit file references the right binary path and env vars.

## Open Questions for Phase 3+

- **Sound / voice.** Announcement of the called number is still only on the operator screen. We'll add a TTS or WAV-bank subsystem in Phase 3/4 — probably as a second endpoint on the same agent (`POST /announce`).
- **Raster text rendering.** Once the printer is real and the bilingual workflow is validated, revisit Karakalpak glyphs: render `ǵ/ń/ú/ó/á` via image commands to get true glyphs on paper.
- **Retry + persistence.** Today a printer write-failure surfaces immediately as a 502. A robust v2 stores pending jobs in a small SQLite journal on the agent and retries with exponential backoff — this is what the spec describes as "offline-buffer mode".
