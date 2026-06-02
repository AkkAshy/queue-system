import { describe, it, expect } from 'vitest';
import { accentFor } from '@/lib/category';

describe('accentFor', () => {
  it('maps the leading letter to its category accent', () => {
    expect(accentFor('A013')).toBe('#7A8FA3');
    expect(accentFor('E010')).toBe('#9B8F6E');
    expect(accentFor('G004')).toBe('#8C5E6B');
  });

  it('is case-insensitive on the leading letter', () => {
    expect(accentFor('a013')).toBe(accentFor('A013'));
  });

  it('falls back to brass for unknown letters', () => {
    expect(accentFor('Z999')).toBe('#C9A961');
    expect(accentFor('')).toBe('#C9A961');
  });
});
