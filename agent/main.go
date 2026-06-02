package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/ndpi/queue-agent/config"
	"github.com/ndpi/queue-agent/printer"
	"github.com/ndpi/queue-agent/server"
)

// Version is stamped at build time: go build -ldflags "-X main.Version=0.1.0"
var Version = "dev"

func main() {
	cfg := config.FromEnv(config.Default())

	// CLI flags override env
	addr := flag.String("addr", cfg.Addr, "HTTP listen address")
	backend := flag.String("backend", string(cfg.Backend), "printer backend: cups|file|null")
	printerName := flag.String("printer-name", cfg.PrinterName, "CUPS printer queue name")
	printerDevice := flag.String("printer-device", cfg.PrinterDevice, "raw device path, e.g. /dev/usb/lp0")
	printSecs := flag.Float64("print-timeout-seconds", cfg.PrintTimeoutSeconds, "write-to-printer timeout (seconds)")
	logFile := flag.String("log-file", cfg.LogFile, "append structured logs to this file (stdout too)")
	upstream := flag.String("upstream", cfg.Upstream, "kiosk-host: reverse-proxy non-/print requests to this URL (e.g. https://nmpi.avtoxizmet.uz)")
	kioskFlag := flag.Bool("kiosk", cfg.LaunchKiosk, "launch a Chrome kiosk window at the local server on startup")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("ndpi-queue-agent", Version)
		return
	}

	cfg.Addr = *addr
	cfg.Backend = config.Backend(*backend)
	cfg.PrinterName = *printerName
	cfg.PrinterDevice = *printerDevice
	cfg.PrintTimeoutSeconds = *printSecs
	cfg.LogFile = *logFile
	cfg.Upstream = *upstream
	cfg.LaunchKiosk = *kioskFlag

	if err := cfg.Validate(); err != nil {
		fmt.Fprintln(os.Stderr, "config error:", err)
		os.Exit(2)
	}

	logger, err := buildLogger(cfg.LogFile)
	if err != nil {
		fmt.Fprintln(os.Stderr, "logger error:", err)
		os.Exit(2)
	}

	writer, err := newWriter(cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, "writer error:", err)
		os.Exit(2)
	}

	var proxy http.Handler
	if cfg.Upstream != "" {
		proxy, err = newProxy(cfg.Upstream)
		if err != nil {
			fmt.Fprintln(os.Stderr, "proxy error:", err)
			os.Exit(2)
		}
	}

	srv, err := server.New(server.Options{Writer: writer, Logger: logger, Proxy: proxy})
	if err != nil {
		fmt.Fprintln(os.Stderr, "server error:", err)
		os.Exit(2)
	}

	httpSrv := &http.Server{
		Addr:         cfg.Addr,
		Handler:      srv.Router(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 20 * time.Second, // printing can be slow
		IdleTimeout:  60 * time.Second,
	}
	// Kiosk-host proxies long-lived WebSockets — global read/write deadlines
	// would kill them, so disable them in that mode.
	if proxy != nil {
		httpSrv.ReadTimeout = 0
		httpSrv.WriteTimeout = 0
	}

	ctx, stop := signal.NotifyContext(context.Background(),
		syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("agent started",
			"addr", cfg.Addr,
			"backend", cfg.Backend,
			"writer", writer.Name(),
			"version", Version,
		)
		if err := httpSrv.ListenAndServe(); err != nil &&
			!errors.Is(err, http.ErrServerClosed) {
			logger.Error("http server crashed", "err", err)
			stop()
		}
	}()

	if cfg.LaunchKiosk {
		go launchKiosk("http://"+cfg.Addr+"/", logger)
	}

	<-ctx.Done()
	logger.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
}

func newWriter(c config.Config) (printer.Writer, error) {
	timeout := time.Duration(c.PrintTimeoutSeconds * float64(time.Second))
	switch c.Backend {
	case config.BackendCUPS:
		return printer.NewCUPSWriter(c.PrinterName, timeout), nil
	case config.BackendFile:
		return printer.NewFileWriter(c.PrinterDevice, timeout), nil
	case config.BackendNull:
		return printer.NewNullWriter(), nil
	case config.BackendWindows:
		return printer.NewWindowsWriter(c.PrinterName, timeout), nil
	}
	return nil, fmt.Errorf("unreachable: validated backend %q has no constructor", c.Backend)
}

// newProxy builds a reverse proxy to the cloud upstream. The Host header is
// rewritten to the upstream host so the cloud nginx vhost matches. WebSocket
// upgrades are handled transparently by httputil.ReverseProxy.
func newProxy(upstream string) (http.Handler, error) {
	target, err := url.Parse(upstream)
	if err != nil {
		return nil, fmt.Errorf("parse upstream %q: %w", upstream, err)
	}
	rp := httputil.NewSingleHostReverseProxy(target)
	base := rp.Director
	rp.Director = func(req *http.Request) {
		base(req)
		req.Host = target.Host // match cloud server_name + TLS SNI
	}
	return rp, nil
}

// launchKiosk opens a Chrome kiosk window at the local URL. Best-effort:
// logs and returns on failure (the server keeps running regardless).
func launchKiosk(targetURL string, logger *slog.Logger) {
	var candidates []string
	switch runtime.GOOS {
	case "windows":
		candidates = []string{
			`C:\Program Files\Google\Chrome\Application\chrome.exe`,
			`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
		}
	case "darwin":
		candidates = []string{"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
	default:
		candidates = []string{"google-chrome", "chromium", "chromium-browser"}
	}
	args := []string{
		"--kiosk", targetURL,
		"--no-first-run", "--no-default-browser-check",
		"--disable-pinch", "--overscroll-history-navigation=0",
	}
	for _, bin := range candidates {
		cmd := exec.Command(bin, args...)
		if err := cmd.Start(); err == nil {
			logger.Info("kiosk browser launched", "bin", bin, "url", targetURL)
			return
		}
	}
	logger.Warn("could not launch a Chrome/Chromium kiosk window; open it manually", "url", targetURL)
}

func buildLogger(logFile string) (*slog.Logger, error) {
	// Default: stdout, text format.
	var out *os.File = os.Stdout
	if logFile != "" {
		f, err := os.OpenFile(logFile,
			os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return nil, err
		}
		// Duplicate to stdout too — systemd / terminal still see logs.
		mw := &multiWriter{a: os.Stdout, b: f}
		handler := slog.NewTextHandler(mw, &slog.HandlerOptions{Level: slog.LevelInfo})
		return slog.New(handler), nil
	}
	handler := slog.NewTextHandler(out, &slog.HandlerOptions{Level: slog.LevelInfo})
	return slog.New(handler), nil
}

type multiWriter struct{ a, b *os.File }

func (m *multiWriter) Write(p []byte) (int, error) {
	_, _ = m.a.Write(p)
	return m.b.Write(p)
}
