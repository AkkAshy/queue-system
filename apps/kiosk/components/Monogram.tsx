import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * Stylized institutional monogram — interlaced "NP" (Nókis Pedagogikalıq).
 * Drawn as an outlined seal that nods to academic crest traditions without
 * mimicking the actual university logo (which would need licensing).
 */
export function Monogram({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      {/* outer ring */}
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.55"
      />
      {/* inner ring */}
      <circle
        cx="32"
        cy="32"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.35"
      />
      {/* N */}
      <path
        d="M20 44 V20 L32 40 V20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* P */}
      <path
        d="M36 44 V20 H42 Q48 20 48 26 Q48 32 42 32 H36"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* decorative dots */}
      <circle cx="32" cy="7.5" r="1.25" fill="currentColor" opacity="0.55" />
      <circle cx="32" cy="56.5" r="1.25" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
