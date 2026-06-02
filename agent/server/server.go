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
	Logger *slog.Logger   // nil => slog.Default()
	// Proxy, when set, handles every request that isn't /print or /health
	// (kiosk-host mode: forwards the UI + /api + /ws to the cloud).
	Proxy http.Handler
}

// Server owns the HTTP router and serializes print jobs.
type Server struct {
	writer printer.Writer
	log    *slog.Logger
	proxy  http.Handler

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
	return &Server{writer: opt.Writer, log: log, proxy: opt.Proxy}, nil
}

// Router returns an http.Handler covering all agent endpoints.
func (s *Server) Router() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/print", s.handlePrint)
	// Kiosk-host mode: everything else is reverse-proxied to the cloud.
	if s.proxy != nil {
		mux.Handle("/", s.proxy)
	}
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
