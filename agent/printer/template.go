package printer

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// PrintRequest is the payload sent by the kiosk for every printed ticket.
// Field names match the JSON keys used on the wire (snake_case via struct
// tags on server.PrintRequest, which embeds this).
type PrintRequest struct {
	Number string // e.g. "A042"
	// Locale the visitor used on the kiosk: "ru" | "kaa" | "uz" | "en".
	// Drives both which name to print and how to encode it (ru → CP866
	// Cyrillic, everything else → ASCII Latin).
	Locale string
	// Localized names (already in Locale) — preferred over the kaa/ru pair.
	HallName     string
	CategoryName string
	ServiceName  string
	// Legacy bilingual fields — fallback when the kiosk didn't send localized
	// names (older build). Kept so an old kiosk still prints something sane.
	HallNameKaa     string
	HallNameRu      string
	CategoryCode    string // "A".."I"
	CategoryNameKaa string
	CategoryNameRu  string
	ServiceNameKaa  string
	ServiceNameRu   string
	IssuedAt        time.Time // UTC
	TicketID        string    // UUID — goes into the QR code
}

// encodeFor renders a string for the ticket in the request's locale: Russian
// goes through CP866, every other (Latin) locale through ASCII transliteration.
func (req PrintRequest) encodeFor(s string) []byte {
	if req.Locale == "ru" {
		b, _ := EncodeRU(s) // EncodeRU never errors (replaces unsupported)
		return b
	}
	return EncodeLatin(s)
}

// pickName prefers the localized field; otherwise falls back to the bilingual
// pair, choosing by locale (ru → Russian, else Karakalpak).
func (req PrintRequest) pickName(localized, ru, kaa string) string {
	if localized != "" {
		return localized
	}
	if req.Locale == "ru" {
		return ru
	}
	return kaa
}

const (
	// Max characters per line on an 80 mm printer at Font A (12 cpi).
	lineWidth = 42
)

// Render builds the full ESC/POS byte stream for one ticket.
//
// Layout (top to bottom):
//
//	[Init]
//	"АЖИНИЯЗ АТЫНДАҒЫ НДПИ"        (CP1251, centered, bold)
//	"Registrator ofisi"             (ASCII, centered)
//	-------- dashed rule --------
//	"SIZIŃ NOMERIŃIZ / ВАШ НОМЕР"   (centered, small)
//	[Number — 4x width/height]       e.g. "A042"
//	-------- dashed rule --------
//	KAT    <category (KAA transliterated)>
//	       <category (RU CP1251)>
//	XIZMET <service (KAA)>
//	       <service (RU)>
//	        word-wrapped to 42 cols
//	-------- dashed rule --------
//	"2026-04-20 14:30"              (mono)
//	[QR code with ticket UUID]
//	[3 line feeds]
//	[Cut]
func Render(req PrintRequest) ([]byte, error) {
	e := NewESC()

	e.Init().CodePage(17) // PC866 (CP866) for Russian

	// Header
	e.Align(AlignCenter).Bold(true)
	hdr, err := EncodeRU("АЖИНИЯЗ АТЫНДАҒЫ НДПИ")
	if err != nil {
		return nil, fmt.Errorf("encode header: %w", err)
	}
	e.Text(hdr).Feed(1)
	e.Bold(false).Text(EncodeKAA("Registrator ofisi")).Feed(1)

	e.Text([]byte(dashLine())).Feed(1)

	// Number eyebrow — in the visitor's language.
	e.Size(1, 1)
	e.Text(req.encodeFor(numberEyebrow(req.Locale))).Feed(1)

	// Big number
	e.Size(4, 4).Text([]byte(req.Number)).Feed(1)
	e.Size(1, 1)

	e.Text([]byte(dashLine())).Feed(1)

	// Hall + category + service — printed ONLY in the visitor's chosen language
	// (Russian → CP866 Cyrillic, everything else → ASCII Latin).
	e.Align(AlignLeft)
	printField := func(ruLabel, latinLabel, name string) {
		if name == "" {
			return
		}
		label := latinLabel
		if req.Locale == "ru" {
			label = ruLabel
		}
		for i, ln := range wrap(name, lineWidth-5) {
			if i == 0 {
				e.Bold(true).Text(req.encodeFor(label)).Bold(false)
			} else {
				e.Text([]byte("     "))
			}
			e.Text(req.encodeFor(ln)).Feed(1)
		}
	}

	printField("ЗАЛ  ", "ZAL  ", req.pickName(req.HallName, req.HallNameRu, req.HallNameKaa))
	printField("КАТ  ", "KAT  ", req.pickName(req.CategoryName, req.CategoryNameRu, req.CategoryNameKaa))
	printField("УСЛ  ", "XIZ  ", req.pickName(req.ServiceName, req.ServiceNameRu, req.ServiceNameKaa))

	e.Text([]byte(dashLine())).Feed(1)

	// Timestamp
	e.Align(AlignCenter)
	stamp := req.IssuedAt.Local().Format("2006-01-02  15:04")
	e.Text([]byte(stamp)).Feed(2)

	// QR code
	e.QRCode(req.TicketID).Feed(1)

	// Leave space for tear-off and cut
	e.Feed(3).Cut()

	return e.Bytes(), nil
}

func dashLine() string {
	return strings.Repeat("-", lineWidth)
}

// numberEyebrow returns the "your number" caption in the visitor's language.
func numberEyebrow(locale string) string {
	switch locale {
	case "ru":
		return "ВАШ НОМЕР"
	case "uz":
		return "SIZNING RAQAMINGIZ"
	case "en":
		return "YOUR NUMBER"
	default: // kaa
		return "SIZIŃ NÓMERIŃIZ"
	}
}

// wrap breaks s into lines no wider than width, breaking on spaces. Width is
// counted in RUNES (so Cyrillic UTF-8 wraps at the right visual column, not at
// half-width as a byte count would).
func wrap(s string, width int) []string {
	if width <= 0 {
		return []string{s}
	}
	words := strings.Fields(s)
	if len(words) == 0 {
		return []string{""}
	}
	rc := utf8.RuneCountInString
	var out []string
	cur := words[0]
	for _, w := range words[1:] {
		if rc(cur)+1+rc(w) <= width {
			cur = cur + " " + w
			continue
		}
		out = append(out, cur)
		cur = w
	}
	out = append(out, cur)
	return out
}
