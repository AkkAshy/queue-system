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
	procEnumPrintersW    = winspool.NewProc("EnumPrintersW")
)

// EnumPrinters flags + level (see Win32 docs).
const (
	printerEnumLocal       = 0x00000002
	printerEnumConnections = 0x00000004
)

// docInfo1 mirrors Win32 DOC_INFO_1W.
type docInfo1 struct {
	pDocName    *uint16
	pOutputFile *uint16
	pDatatype   *uint16
}

// printerInfo4 mirrors Win32 PRINTER_INFO_4W — the lightweight level used to
// list printer names without touching driver/port details.
type printerInfo4 struct {
	pPrinterName *uint16
	pServerName  *uint16
	attributes   uint32
}

// Write sends bytes to the writer's configured default printer.
func (w *WindowsWriter) Write(p []byte) (int, error) {
	return w.WriteTo(w.name, p)
}

// List enumerates installed printers via EnumPrintersW (PRINTER_INFO_4).
func (w *WindowsWriter) List() ([]string, error) {
	flags := uintptr(printerEnumLocal | printerEnumConnections)
	// First call sizes the buffer.
	var needed, returned uint32
	procEnumPrintersW.Call(flags, 0, 4, 0, 0,
		uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if needed == 0 {
		return nil, nil
	}
	buf := make([]byte, needed)
	r, _, e := procEnumPrintersW.Call(flags, 0, 4,
		uintptr(unsafe.Pointer(&buf[0])), uintptr(needed),
		uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if r == 0 {
		return nil, fmt.Errorf("EnumPrinters: %v", e)
	}
	infos := unsafe.Slice((*printerInfo4)(unsafe.Pointer(&buf[0])), int(returned))
	names := make([]string, 0, returned)
	for _, info := range infos {
		if info.pPrinterName != nil {
			names = append(names, windows.UTF16PtrToString(info.pPrinterName))
		}
	}
	return names, nil
}

// WriteTo sends bytes to a specific Windows printer, falling back to the
// configured default when name is empty.
func (w *WindowsWriter) WriteTo(name string, p []byte) (int, error) {
	if name == "" {
		name = w.name
	}
	namePtr, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return 0, fmt.Errorf("printer name: %w", err)
	}

	var h windows.Handle
	r, _, e := procOpenPrinterW.Call(uintptr(unsafe.Pointer(namePtr)), uintptr(unsafe.Pointer(&h)), 0)
	if r == 0 {
		return 0, fmt.Errorf("OpenPrinter %q: %v", name, e)
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
