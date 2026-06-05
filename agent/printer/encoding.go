package printer

import (
	"strings"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
)

// EncodeRU converts a UTF-8 string into CP866 (PC866 Cyrillic) bytes suitable
// for ESC/POS printing when the printer's active code page is PC866 (ESC t 17).
// Characters not representable in CP866 are first remapped via cp866Fallback
// (nicer substitutes for known Cyrillic extras + typographic punctuation); any
// remaining unsupported rune is replaced with '?' by ReplaceUnsupported instead
// of aborting the whole ticket — so EncodeRU NEVER returns an encoding error.
func EncodeRU(s string) ([]byte, error) {
	enc := encoding.ReplaceUnsupported(charmap.CodePage866.NewEncoder())
	return enc.Bytes([]byte(sanitizeForCP866(s)))
}

// sanitizeForCP866 replaces runes absent from CP866 with the closest available
// substitute so that EncodeRU never returns an encoding error. Covers
// Karakalpak/Kazakh Cyrillic extras that appear on printed tickets (their
// substitutes are all plain Russian letters present in CP866).
func sanitizeForCP866(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if repl, ok := cp866Fallback[r]; ok {
			b.WriteString(repl)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// cp866Fallback maps Cyrillic characters absent from CP866 to the nearest
// printable substitute.
var cp866Fallback = map[rune]string{
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
	// Uzbek Cyrillic extras (in case any RU-field text carries them).
	'Ў': "У", // U+040E
	'ў': "у", // U+045E
	'Ҷ': "Ж", // U+04B6
	'ҷ': "ж", // U+04B7
	// Typographic punctuation absent from CP866 — these are the usual culprits
	// behind "rune not supported": em/en dashes, curly quotes, ellipsis, №.
	'—': "-",   // U+2014 em dash
	'–': "-",   // U+2013 en dash
	'«': "\"",  // U+00AB
	'»': "\"",  // U+00BB
	'“': "\"",  // U+201C
	'”': "\"",  // U+201D
	'‘': "'",   // U+2018
	'’': "'",   // U+2019
	'…': "...", // U+2026 ellipsis
	'№': "No.", // U+2116 numero sign
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
