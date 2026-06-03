//go:build !windows

package printer

import (
	"fmt"
	"time"
)

// WindowsWriter stub for non-Windows builds so the package compiles everywhere.
// The "windows" backend is only functional on a Windows host.
type WindowsWriter struct {
	name string
}

func NewWindowsWriter(name string, _ time.Duration) *WindowsWriter {
	return &WindowsWriter{name: name}
}

func (w *WindowsWriter) Name() string { return "windows:" + w.name }

func (w *WindowsWriter) Write(_ []byte) (int, error) {
	return 0, fmt.Errorf("windows backend is only supported on Windows hosts")
}

func (w *WindowsWriter) WriteTo(_ string, _ []byte) (int, error) {
	return 0, fmt.Errorf("windows backend is only supported on Windows hosts")
}

func (w *WindowsWriter) List() ([]string, error) {
	return nil, fmt.Errorf("windows backend is only supported on Windows hosts")
}
