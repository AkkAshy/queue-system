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

// targetWriter is a fake that implements Lister + TargetWriter so we can assert
// the server enumerates printers and routes jobs to a per-request target.
type targetWriter struct {
	printer.NullWriter
	list    []string
	lastTo  string
	toCalls int
}

func (w *targetWriter) List() ([]string, error) { return w.list, nil }

func (w *targetWriter) WriteTo(name string, p []byte) (int, error) {
	w.lastTo = name
	w.toCalls++
	return w.NullWriter.Write(p)
}

func TestPrintersListsBackendAndDefault(t *testing.T) {
	tw := &targetWriter{list: []string{"XP-80T", "Office-HP"}}
	s, err := New(Options{Writer: tw, DefaultPrinter: "XP-80T"})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/printers", nil)
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got struct {
		OK       bool     `json:"ok"`
		Printers []string `json:"printers"`
		Default  string   `json:"default"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.True(t, got.OK)
	assert.Equal(t, []string{"XP-80T", "Office-HP"}, got.Printers)
	assert.Equal(t, "XP-80T", got.Default)
}

func TestPrintersFallsBackToDefaultWhenNotListed(t *testing.T) {
	// Null backend doesn't implement Lister — default must still be selectable.
	s, _ := New(Options{Writer: printer.NewNullWriter(), DefaultPrinter: "XP-80T"})
	req := httptest.NewRequest(http.MethodGet, "/printers", nil)
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "XP-80T")
}

func TestPrintRoutesToSelectedPrinter(t *testing.T) {
	tw := &targetWriter{list: []string{"XP-80T", "Office-HP"}}
	s, err := New(Options{Writer: tw})
	require.NoError(t, err)

	payload := `{"number":"A001","category_code":"A","ticket_id":"x","printer_name":"Office-HP"}`
	req := httptest.NewRequest(http.MethodPost, "/print", strings.NewReader(payload))
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 1, tw.toCalls, "should route via WriteTo")
	assert.Equal(t, "Office-HP", tw.lastTo)
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
