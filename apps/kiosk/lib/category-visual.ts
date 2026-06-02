import {
  GraduationCap,
  Send,
  Monitor,
  FolderPlus,
  Wallet,
  FileText,
  Plane,
  Globe,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

interface CatVisual {
  Icon: LucideIcon;
  /** soft chip (bg + icon colour) */
  chip: string;
  /** solid background (accent bars) */
  solid: string;
  /** solid text colour */
  text: string;
}

// Category code (A..I) → icon + pastel chip colours (see tailwind cat.* tokens).
const MAP: Record<string, CatVisual> = {
  A: { Icon: GraduationCap, chip: 'bg-cat-a-soft text-cat-a', solid: 'bg-cat-a', text: 'text-cat-a' },
  B: { Icon: Send, chip: 'bg-cat-b-soft text-cat-b', solid: 'bg-cat-b', text: 'text-cat-b' },
  C: { Icon: Monitor, chip: 'bg-cat-c-soft text-cat-c', solid: 'bg-cat-c', text: 'text-cat-c' },
  D: { Icon: FolderPlus, chip: 'bg-cat-d-soft text-cat-d', solid: 'bg-cat-d', text: 'text-cat-d' },
  E: { Icon: Wallet, chip: 'bg-cat-e-soft text-cat-e', solid: 'bg-cat-e', text: 'text-cat-e' },
  F: { Icon: FileText, chip: 'bg-cat-f-soft text-cat-f', solid: 'bg-cat-f', text: 'text-cat-f' },
  G: { Icon: Plane, chip: 'bg-cat-g-soft text-cat-g', solid: 'bg-cat-g', text: 'text-cat-g' },
  H: { Icon: Globe, chip: 'bg-cat-h-soft text-cat-h', solid: 'bg-cat-h', text: 'text-cat-h' },
  I: { Icon: Sparkles, chip: 'bg-cat-i-soft text-cat-i', solid: 'bg-cat-i', text: 'text-cat-i' },
};

const FALLBACK: CatVisual = {
  Icon: Sparkles, chip: 'bg-coral-soft text-coral', solid: 'bg-coral', text: 'text-coral',
};

export function categoryVisual(code: string): CatVisual {
  return MAP[code?.toUpperCase()] ?? FALLBACK;
}
