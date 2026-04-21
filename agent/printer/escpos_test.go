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
