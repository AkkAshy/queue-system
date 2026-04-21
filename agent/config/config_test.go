package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDefaults(t *testing.T) {
	c := Default()
	assert.Equal(t, "127.0.0.1:8089", c.Addr)
	assert.Equal(t, "cups", c.Backend)
	assert.Equal(t, "XP-80T", c.PrinterName)
	assert.Equal(t, "", c.PrinterDevice)
	assert.Equal(t, 10.0, c.PrintTimeoutSeconds)
}

func TestFromEnv(t *testing.T) {
	t.Setenv("AGENT_ADDR", "0.0.0.0:9000")
	t.Setenv("AGENT_BACKEND", "file")
	t.Setenv("AGENT_PRINTER_DEVICE", "/dev/usb/lp0")
	t.Setenv("AGENT_PRINTER_NAME", "MY-PRINTER")

	c := FromEnv(Default())
	assert.Equal(t, "0.0.0.0:9000", c.Addr)
	assert.Equal(t, "file", c.Backend)
	assert.Equal(t, "/dev/usb/lp0", c.PrinterDevice)
	assert.Equal(t, "MY-PRINTER", c.PrinterName)
}

func TestValidateRejectsUnknownBackend(t *testing.T) {
	c := Default()
	c.Backend = "smoke-signals"
	err := c.Validate()
	assert.ErrorContains(t, err, "unknown backend")
}

func TestValidateFileBackendRequiresDevice(t *testing.T) {
	c := Default()
	c.Backend = "file"
	c.PrinterDevice = ""
	err := c.Validate()
	assert.ErrorContains(t, err, "printer device")
}
