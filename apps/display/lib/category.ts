// Category accent colours mirror tailwind.preset.js `cat.*`. We key off the
// ticket number's leading letter (e.g. 'A013' → A) so the board can colour a
// call without fetching the full category list.
const ACCENT: Record<string, string> = {
  A: '#3F7CC4',
  B: '#2C9E76',
  C: '#7B6AD2',
  D: '#E0973A',
  E: '#1FA2A2',
  F: '#E0654F',
  G: '#C85C9C',
  H: '#4E97D1',
  I: '#8C79C6',
};

export function accentFor(ticketNumber: string): string {
  const letter = ticketNumber.charAt(0).toUpperCase();
  return ACCENT[letter] ?? '#DC6A4C'; // fall back to coral
}
