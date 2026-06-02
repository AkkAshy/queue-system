/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // warm institutional palette — "paper on charcoal"
        ink: {
          950: '#0E0D0C', // deepest
          900: '#141312', // primary bg
          800: '#1B1918', // surface
          700: '#26231F', // raised surface
          600: '#38342E', // border / divider
          500: '#5C574F', // muted text
          400: '#8A8277', // secondary text
          300: '#B8AEA0', // tertiary text
        },
        paper: {
          50:  '#FBF9F3',
          100: '#F5F1E8', // foreground / primary text
          200: '#E8E1D0',
          300: '#D6CBB2',
        },
        // single accent — muted brass / medal gold
        brass: {
          300: '#E0C98D',
          400: '#D4B878',
          500: '#C9A961', // primary accent
          600: '#B5922F',
          700: '#8C7125',
        },
        // subtle tonal indicators for the 9 categories (4px stripe on each card,
        // not dominant fills). All desaturated, similar luminosity.
        category: {
          A: '#7A8FA3', // slate blue
          B: '#8D9C7C', // sage
          C: '#A98A63', // taupe
          D: '#C2A359', // ochre
          E: '#9B8F6E', // linen
          F: '#B56E5A', // terracotta
          G: '#8C5E6B', // plum
          H: '#6E8489', // pewter teal
          I: '#7E7489', // heather
        },
      },
      fontFamily: {
        // JetBrains Mono across the board — one voice.
        sans: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
        serif: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // editorial hierarchy — many sizes, not just "big/medium/small"
        'micro': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.12em' }], // uppercase labels
        'eyebrow': ['0.75rem', { lineHeight: '1.1', letterSpacing: '0.18em' }],
        'meta': ['0.875rem', { lineHeight: '1.4' }],
        'body': ['1.0625rem', { lineHeight: '1.55' }],
        'lead': ['1.375rem', { lineHeight: '1.45' }],
        'h3': ['1.75rem', { lineHeight: '1.2' }],
        'h2': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
        'h1': ['3.75rem', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        'display': ['5.5rem', { lineHeight: '0.95', letterSpacing: '-0.025em' }],
        // touch-kiosk specific
        'ticket': ['11rem', { lineHeight: '0.88', letterSpacing: '-0.04em' }],
        'category-letter': ['3.5rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        'paper': '0 1px 2px 0 rgba(0,0,0,0.4), 0 12px 40px -12px rgba(0,0,0,0.55)',
        'paper-lift': '0 2px 4px 0 rgba(0,0,0,0.35), 0 20px 60px -18px rgba(0,0,0,0.65)',
        'inset-line': 'inset 0 1px 0 0 rgba(245,241,232,0.05)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
};
