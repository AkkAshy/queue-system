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

// newCUPSWriterWithCmd is a package-private constructor that allows injecting
// a fake `lp` binary in tests (e.g. /usr/bin/echo) without requiring CUPS.
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
