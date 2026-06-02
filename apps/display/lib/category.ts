// Category accent colours mirror tailwind.preset.js `category.*`.
// We key off the ticket number's leading letter (e.g. 'A013' → A) so the
// board can colour a call without fetching the full category list.
const ACCENT: Record<string, string> = {
  A: '#7A8FA3', // slate blue
  B: '#8D9C7C', // sage
  C: '#A98A63', // taupe
  D: '#C2A359', // ochre
  E: '#9B8F6E', // linen
  F: '#B56E5A', // terracotta
  G: '#8C5E6B', // plum
  H: '#6E8489', // pewter teal
  I: '#7E7489', // heather
};

export function accentFor(ticketNumber: string): string {
  const letter = ticketNumber.charAt(0).toUpperCase();
  return ACCENT[letter] ?? '#C9A961'; // fall back to brass
}
