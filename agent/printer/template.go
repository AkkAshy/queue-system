package printer

import (
	"fmt"
	"strings"
	"time"
)

// PrintRequest is the payload sent by the kiosk for every printed ticket.
// Field names match the JSON keys used on the wire (snake_case via struct
// tags on server.PrintRequest, which embeds this).
type PrintRequest struct {
	Number          string    // e.g. "A042"
	HallNameKaa     string    // hall (zal) Karakalpak name
	HallNameRu      string    // hall (zal) Russian name
	CategoryCode    string    // "A".."I"
	CategoryNameKaa string    // Karakalpak name
	CategoryNameRu  string    // Russian name
	ServiceNameKaa  string    // Karakalpak service name
	ServiceNameRu   string    // Russian service name
	IssuedAt        time.Time // UTC
	TicketID        string    // UUID — goes into the QR code
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

	// Number eyebrow
	e.Size(1, 1)
	eyebrow, err := EncodeRU("ВАШ НОМЕР")
	if err != nil {
		return nil, fmt.Errorf("encode eyebrow: %w", err)
	}
	e.Text(eyebrow).Feed(1)

	// Big number
	e.Size(4, 4).Text([]byte(req.Number)).Feed(1)
	e.Size(1, 1)

	e.Text([]byte(dashLine())).Feed(1)

	// Hall (zal) — so the student knows which hall to wait in.
	e.Align(AlignLeft)
	if req.HallNameRu != "" || req.HallNameKaa != "" {
		e.Bold(true).Text([]byte("ZAL  ")).Bold(false)
		e.Text(EncodeKAA(req.HallNameKaa)).Feed(1)
		if req.HallNameRu != "" {
			hall, err := EncodeRU("     " + req.HallNameRu)
			if err != nil {
				return nil, err
			}
			e.Text(hall).Feed(1)
		}
	}

	// Category + service — bilingual
	e.Bold(true).Text([]byte("KAT  ")).Bold(false)
	e.Text(EncodeKAA(req.CategoryNameKaa)).Feed(1)
	cat, err := EncodeRU("     " + req.CategoryNameRu)
	if err != nil {
		return nil, err
	}
	e.Text(cat).Feed(1)

	kaaLines := wrap(TransliterateKAA(req.ServiceNameKaa), lineWidth-5)
	for i, ln := range kaaLines {
		if i == 0 {
			e.Bold(true).Text([]byte("XIZ  ")).Bold(false)
		} else {
			e.Text([]byte("     "))
		}
		e.Text([]byte(ln)).Feed(1)
	}
	for _, ln := range wrap(req.ServiceNameRu, lineWidth-5) {
		encoded, err := EncodeRU(ln)
		if err != nil {
			return nil, err
		}
		e.Text([]byte("     ")).Text(encoded).Feed(1)
	}

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

// wrap breaks s into lines not longer than width, breaking on spaces.
// Pure ASCII input only (run after EncodeKAA / before EncodeRU caller decides).
func wrap(s string, width int) []string {
	if width <= 0 {
		return []string{s}
	}
	words := strings.Fields(s)
	if len(words) == 0 {
		return []string{""}
	}
	var out []string
	cur := words[0]
	for _, w := range words[1:] {
		if len(cur)+1+len(w) <= width {
			cur = cur + " " + w
			continue
		}
		out = append(out, cur)
		cur = w
	}
	out = append(out, cur)
	return out
}
