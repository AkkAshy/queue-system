package printer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"golang.org/x/text/encoding/charmap"
)

func TestEncodeRussianCP866(t *testing.T) {
	// "Привет" in CP866: П=8F р=E0 и=A8 в=A2 е=A5 т=E2
	got, err := EncodeRU("Привет")
	assert.NoError(t, err)
	assert.Equal(t, []byte{0x8F, 0xE0, 0xA8, 0xA2, 0xA5, 0xE2}, got)

	// Round-trip: decoding the bytes as CP866 must give back the original.
	back, err := charmap.CodePage866.NewDecoder().Bytes(got)
	assert.NoError(t, err)
	assert.Equal(t, "Привет", string(back))
}

func TestEncodeRussianPassesASCII(t *testing.T) {
	got, err := EncodeRU("Queue #1")
	assert.NoError(t, err)
	assert.Equal(t, []byte("Queue #1"), got)
}

func TestTransliterateKarakalpak(t *testing.T) {
	cases := map[string]string{
		"Akademiyalıq": "Akademiyaliq",
		"Onlayn arza":  "Onlayn arza",
		"hám":          "ha'm",
		"Hújjetler":    "Hu'jjetler",
		"Ózlestiriw":   "O'zlestiriw",
		"Ájiniyaz":     "A'jiniyaz",
		"Ǵalaba":        "G'alaba",
		"Talonńın":     "Talonn'in",
		"Buyrıqlar":    "Buyriqlar",
	}
	for in, want := range cases {
		assert.Equal(t, want, TransliterateKAA(in), "input %q", in)
	}
}

func TestEncodeKAAIsASCIIAfterTranslit(t *testing.T) {
	got := EncodeKAA("Jataqxanaǵa jaylasıw")
	// Plain ASCII, nothing above 0x7F
	for i, b := range got {
		assert.LessOrEqual(t, b, byte(0x7E), "byte %d (%q) should be ASCII", i, b)
	}
}
