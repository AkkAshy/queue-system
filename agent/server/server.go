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
	// Proxy, when set, handles every request that isn't /print, /health or
	// /printers (kiosk-host mode: forwards the UI + /api + /ws to the cloud).
	Proxy http.Handler
	// DefaultPrinter is the configured printer name (cups/windows). Reported by
	// GET /printers so the kiosk can mark the current default.
	DefaultPrinter string
}

// Server owns the HTTP router and serializes print jobs.
type Server struct {
	writer         printer.Writer
	log            *slog.Logger
	proxy          http.Handler
	defaultPrinter string

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
	return &Server{
		writer:         opt.Writer,
		log:            log,
		proxy:          opt.Proxy,
		defaultPrinter: opt.DefaultPrinter,
	}, nil
}

// Router returns an http.Handler covering all agent endpoints.
func (s *Server) Router() http.Handler {
	mux := http.NewServeMux()
	// Local API endpoints get CORS so the kiosk page can call them regardless of
	// how its origin reads (localhost vs 127.0.0.1, or the cloud HTTPS origin —
	// localhost is a browser "secure context", so HTTPS→http://localhost is allowed).
	mux.HandleFunc("/health", cors(s.handleHealth))
	mux.HandleFunc("/print", cors(s.handlePrint))
	mux.HandleFunc("/printers", cors(s.handlePrinters))
	// Kiosk-host mode: everything else is reverse-proxied to the cloud.
	if s.proxy != nil {
		mux.Handle("/", s.proxy)
	}
	return mux
}

// handlePrinters reports the printers installed on this host so the kiosk can
// offer a choice. Backends without enumeration (file/null) yield just the
// configured default.
func (s *Server) handlePrinters(w http.ResponseWriter, r *http.Request) {
	var names []string
	if l, ok := s.writer.(printer.Lister); ok {
		got, err := l.List()
		if err != nil {
			s.log.Warn("list printers failed", "err", err, "writer", s.writer.Name())
		} else {
			names = got
		}
	}
	// Guarantee the configured default is selectable even if enumeration is
	// empty or unsupported.
	if s.defaultPrinter != "" && !contains(names, s.defaultPrinter) {
		names = append([]string{s.defaultPrinter}, names...)
	}
	if names == nil {
		names = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"printers": names,
		"default":  s.defaultPrinter,
	})
}

func contains(ss []string, target string) bool {
	for _, s := range ss {
		if s == target {
			return true
		}
	}
	return false
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
	HallNameKaa     string    `json:"hall_name_kaa"`
	HallNameRu      string    `json:"hall_name_ru"`
	CategoryCode    string    `json:"category_code"`
	CategoryNameKaa string    `json:"category_name_kaa"`
	CategoryNameRu  string    `json:"category_name_ru"`
	ServiceNameKaa  string    `json:"service_name_kaa"`
	ServiceNameRu   string    `json:"service_name_ru"`
	IssuedAt        time.Time `json:"issued_at"`
	TicketID        string    `json:"ticket_id"`
	// PrinterName, when set, overrides the agent's default printer for this job
	// (chosen in the kiosk's hidden settings page). Empty => default queue.
	PrinterName string `json:"printer_name"`
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
		"printer", req.PrinterName,
	)

	bytesOut, err := printer.Render(printer.PrintRequest{
		Number:          req.Number,
		HallNameKaa:     req.HallNameKaa,
		HallNameRu:      req.HallNameRu,
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
	var werr error
	if tw, ok := s.writer.(printer.TargetWriter); ok && req.PrinterName != "" {
		_, werr = tw.WriteTo(req.PrinterName, bytesOut)
	} else {
		_, werr = s.writer.Write(bytesOut)
	}
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

// cors wraps a handler with permissive CORS + preflight handling. The agent
// only listens on localhost, so allowing any origin is safe here and lets the
// kiosk page reach it whether its origin is localhost, 127.0.0.1, or the cloud.
func cors(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("content-type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
