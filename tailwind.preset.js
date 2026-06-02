/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // ── New "warm paper" design system (light) ──
        cream: { DEFAULT: '#FBF6EE', deep: '#F4ECE0' },
        coral: { DEFAULT: '#DC6A4C', 600: '#C8573B', soft: '#FBE9E1' },
        coal: { DEFAULT: '#2C2722', 2: '#6E655A', 3: '#A79D8F' },
        hair: { DEFAULT: '#ECE2D2', 2: '#E0D4C0' },
        grass: { DEFAULT: '#2F9E72', soft: '#E4F2EA' },
        cat: {
          a: { DEFAULT: '#3F7CC4', soft: '#E7F0FB' },
          b: { DEFAULT: '#2C9E76', soft: '#E4F3EC' },
          c: { DEFAULT: '#7B6AD2', soft: '#ECE9FA' },
          d: { DEFAULT: '#E0973A', soft: '#FBEEDB' },
          e: { DEFAULT: '#1FA2A2', soft: '#E0F3F3' },
          f: { DEFAULT: '#E0654F', soft: '#FBE7E2' },
          g: { DEFAULT: '#C85C9C', soft: '#F9E7F2' },
          h: { DEFAULT: '#4E97D1', soft: '#E5F1FA' },
          i: { DEFAULT: '#8C79C6', soft: '#EFEAF8' },
        },

        // ── Legacy dark tokens (kept until fully migrated; harmless) ──
        ink: {
          950: '#0E0D0C', 900: '#141312', 800: '#1B1918', 700: '#26231F',
          600: '#38342E', 500: '#5C574F', 400: '#8A8277', 300: '#B8AEA0',
        },
        paper: { 50: '#FBF9F3', 100: '#F5F1E8', 200: '#E8E1D0', 300: '#D6CBB2' },
        brass: { 300: '#E0C98D', 400: '#D4B878', 500: '#C9A961', 600: '#B5922F', 700: '#8C7125' },
        category: {
          A: '#7A8FA3', B: '#8D9C7C', C: '#A98A63', D: '#C2A359', E: '#9B8F6E',
          F: '#B56E5A', G: '#8C5E6B', H: '#6E8489', I: '#7E7489',
        },
      },
      fontFamily: {
        // Rubik — the new system typeface (apps load it as --font-rubik).
        sans: ['var(--font-rubik)', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-rubik)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        rsm: '10px',
        r: '16px',
        rlg: '22px',
        rxl: '28px',
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 4px 8px rgba(74,57,40,.06), 0 24px 48px -16px rgba(74,57,40,.12)',
        coral: '0 8px 20px -6px rgba(220,106,76,.45)',
        // legacy
        paper: '0 1px 2px 0 rgba(0,0,0,0.4), 0 12px 40px -12px rgba(0,0,0,0.55)',
        'paper-lift': '0 2px 4px 0 rgba(0,0,0,0.35), 0 20px 60px -18px rgba(0,0,0,0.65)',
      },
      spacing: { '18': '4.5rem', '22': '5.5rem', '30': '7.5rem' },
    },
  },
};
