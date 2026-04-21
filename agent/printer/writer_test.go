package printer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNullWriterDiscards(t *testing.T) {
	w := NewNullWriter()
	n, err := w.Write([]byte("hello"))
	assert.NoError(t, err)
	assert.Equal(t, 5, n)
}

func TestNullWriterRecordsCalls(t *testing.T) {
	w := NewNullWriter()
	_, _ = w.Write([]byte("first"))
	_, _ = w.Write([]byte("second"))
	assert.Equal(t, 2, w.Calls())
	assert.Equal(t, []byte("firstsecond"), w.Buffer())
}

func TestCUPSWriterCommand(t *testing.T) {
	// Use /bin/echo as the fake lp binary (available on macOS and Linux).
	// echo accepts args and piped stdin without error, so Write() should succeed.
	w := newCUPSWriterWithCmd("XP-80T", "/bin/echo")
	n, err := w.Write([]byte("abc"))
	assert.NoError(t, err)
	assert.Equal(t, 3, n)
}
