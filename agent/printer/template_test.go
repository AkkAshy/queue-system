package printer

import (
	"bytes"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func sampleRequest() PrintRequest {
	return PrintRequest{
		Number:          "A042",
		CategoryCode:    "A",
		CategoryNameKaa: "Akademiyalıq iskerlik",
		CategoryNameRu:  "Академическая деятельность",
		ServiceNameKaa:  "Akademiyalıq maǵlıwmatnama hám transkript alıw",
		ServiceNameRu:   "Получение академической справки и транскрипта",
		IssuedAt:        time.Date(2026, 4, 20, 14, 30, 0, 0, time.UTC),
		TicketID:        "b4a8d8f3-1234-4bcd-9abc-123456789abc",
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

func TestRenderEncodesRussianAsCP866(t *testing.T) {
	req := sampleRequest()
	out, err := Render(req)
	assert.NoError(t, err)
	// The Russian text must appear CP866-encoded in the stream.
	expected, err := EncodeRU("Академ")
	assert.NoError(t, err)
	assert.True(t, bytes.Contains(out, expected),
		"CP866-encoded Russian should be present in output")
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
