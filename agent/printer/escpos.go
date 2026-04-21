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
