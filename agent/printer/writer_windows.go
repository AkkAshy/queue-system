//go:build windows

package printer

import (
	"fmt"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// WindowsWriter sends raw ESC/POS bytes to an installed Windows printer via the
// print spooler (RAW datatype). This is the canonical way to push raw bytes to
// a receipt printer on Windows — no driver rendering, no CUPS.
type WindowsWriter struct {
	name    string
	timeout time.Duration
}

func NewWindowsWriter(name string, timeout time.Duration) *WindowsWriter {
	return &WindowsWriter{name: name, timeout: timeout}
}

func (w *WindowsWriter) Name() string { return "windows:" + w.name }

var (
	winspool             = windows.NewLazySystemDLL("winspool.drv")
	procOpenPrinterW     = winspool.NewProc("OpenPrinterW")
	procClosePrinter     = winspool.NewProc("ClosePrinter")
	procStartDocPrinterW = winspool.NewProc("StartDocPrinterW")
	procEndDocPrinter    = winspool.NewProc("EndDocPrinter")
	procStartPagePrinter = winspool.NewProc("StartPagePrinter")
	procEndPagePrinter   = winspool.NewProc("EndPagePrinter")
	procWritePrinter     = winspool.NewProc("WritePrinter")
)

// docInfo1 mirrors Win32 DOC_INFO_1W.
type docInfo1 struct {
	pDocName    *uint16
	pOutputFile *uint16
	pDatatype   *uint16
}

func (w *WindowsWriter) Write(p []byte) (int, error) {
	namePtr, err := windows.UTF16PtrFromString(w.name)
	if err != nil {
		return 0, fmt.Errorf("printer name: %w", err)
	}

	var h windows.Handle
	r, _, e := procOpenPrinterW.Call(uintptr(unsafe.Pointer(namePtr)), uintptr(unsafe.Pointer(&h)), 0)
	if r == 0 {
		return 0, fmt.Errorf("OpenPrinter %q: %v", w.name, e)
	}
	defer procClosePrinter.Call(uintptr(h))

	docName, _ := windows.UTF16PtrFromString("NDPI ticket")
	rawType, _ := windows.UTF16PtrFromString("RAW")
	di := docInfo1{pDocName: docName, pDatatype: rawType}

	r, _, e = procStartDocPrinterW.Call(uintptr(h), 1, uintptr(unsafe.Pointer(&di)))
	if r == 0 {
		return 0, fmt.Errorf("StartDocPrinter: %v", e)
	}
	defer procEndDocPrinter.Call(uintptr(h))

	r, _, e = procStartPagePrinter.Call(uintptr(h))
	if r == 0 {
		return 0, fmt.Errorf("StartPagePrinter: %v", e)
	}
	defer procEndPagePrinter.Call(uintptr(h))

	var written uint32
	r, _, e = procWritePrinter.Call(
		uintptr(h),
		uintptr(unsafe.Pointer(&p[0])),
		uintptr(len(p)),
		uintptr(unsafe.Pointer(&written)),
	)
	if r == 0 {
		return int(written), fmt.Errorf("WritePrinter: %v", e)
	}
	return int(written), nil
}
