package printer

import (
	"strings"

	"golang.org/x/text/encoding/charmap"
)

// EncodeRU converts a UTF-8 string into Windows-1251 bytes suitable for
// ESC/POS printing when the printer's active code page is WPC1251 (46).
// Any character not representable in CP1251 is replaced with '?'.
func EncodeRU(s string) ([]byte, error) {
	enc := charmap.Windows1251.NewEncoder()
	return enc.Bytes([]byte(s))
}

// EncodeKAA transliterates Karakalpak text to plain ASCII and returns the
// bytes. Used on the ticket when the printer is in an ASCII-compatible code
// page. See TransliterateKAA for the glyph → digraph mapping.
func EncodeKAA(s string) []byte {
	return []byte(TransliterateKAA(s))
}

// TransliterateKAA converts Karakalpak-Latin diacritics to ASCII digraphs.
// Mapping (UPPER first, then lower):
//
//	Á/á → A'/a'     Ǵ/ǵ → G'/g'     Ń/ń → N'/n'
//	Ó/ó → O'/o'     Ú/ú → U'/u'     ı   → i
func TransliterateKAA(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if repl, ok := translitMap[r]; ok {
			b.WriteString(repl)
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// Explicit per-rune map so behaviour is predictable and easy to extend.
var translitMap = map[rune]string{
	// Karakalpak-Latin diacritics → ASCII digraphs
	'Á': "A'",
	'á': "a'",
	'Ǵ': "G'",
	'ǵ': "g'",
	'Ń': "N'",
	'ń': "n'",
	'Ó': "O'",
	'ó': "o'",
	'Ú': "U'",
	'ú': "u'",
	'Í': "I'",
	'í': "i'",
	// Dotless i — used as a separate vowel in Karakalpak
	'ı': "i",
}
