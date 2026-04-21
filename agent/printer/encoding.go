package printer

import (
	"strings"

	"golang.org/x/text/encoding/charmap"
)

// EncodeRU converts a UTF-8 string into Windows-1251 bytes suitable for
// ESC/POS printing when the printer's active code page is WPC1251 (46).
// Characters not representable in CP1251 are replaced with their closest
// CP1251 equivalent (see cp1251Fallback map) or '?' if unknown.
func EncodeRU(s string) ([]byte, error) {
	enc := charmap.Windows1251.NewEncoder()
	return enc.Bytes([]byte(sanitizeForCP1251(s)))
}

// sanitizeForCP1251 replaces runes absent from Windows-1251 with the closest
// available substitute so that EncodeRU never returns an encoding error.
// Covers Karakalpak/Kazakh Cyrillic extras that appear on printed tickets.
func sanitizeForCP1251(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if repl, ok := cp1251Fallback[r]; ok {
			b.WriteString(repl)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// cp1251Fallback maps Cyrillic characters absent from Windows-1251 to the
// nearest printable substitute.
var cp1251Fallback = map[rune]string{
	'Ғ': "Г", // U+0492 Cyrillic capital Ghe with stroke → Г
	'ғ': "г", // U+0493 Cyrillic small ghe with stroke   → г
	'Қ': "К", // U+049A Cyrillic capital Ka with descender → К
	'қ': "к", // U+049B
	'Ң': "Н", // U+04A2 Cyrillic capital En with descender → Н
	'ң': "н", // U+04A3
	'Ө': "О", // U+04E8 Cyrillic capital letter Barred O   → О
	'ө': "о", // U+04E9
	'Ү': "У", // U+04AE Cyrillic capital letter Straight U → У
	'ү': "у", // U+04AF
	'Ұ': "У", // U+04B0
	'ұ': "у", // U+04B1
	'Ҳ': "Х", // U+04B2
	'ҳ': "х", // U+04B3
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
