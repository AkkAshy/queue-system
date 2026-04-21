package printer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEncodeRussianCP1251(t *testing.T) {
	// "Привет" in CP1251: 0xCF 0xF0 0xE8 0xE2 0xE5 0xF2
	got, err := EncodeRU("Привет")
	assert.NoError(t, err)
	assert.Equal(t, []byte{0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2}, got)
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
