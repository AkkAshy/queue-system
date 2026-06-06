/** @type {import('tailwindcss').Config} */

// All themeable colours are CSS variables so the whole design system can flip
// between light/dark by toggling a `.dark` class on <html>. The variables live
// in ONE place (the addBase plugin below) and are injected into every app that
// uses this preset — no per-app duplication.
//
// Neutrals + brand use space-separated RGB triples consumed via
// `rgb(var(--x) / <alpha-value>)`, so opacity utilities (bg-cream/80) still work.
// shadcn/ui primitives keep their HSL `--background` etc. vars (also flipped).

const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  darkMode: /** @type {const} */ ('class'),
  theme: {
    extend: {
      colors: {
        // ── neutrals (flip in dark) ──
        cream: { DEFAULT: v('--cream'), deep: v('--cream-deep') },
        coal: { DEFAULT: v('--coal'), 2: v('--coal-2'), 3: v('--coal-3') },
        hair: { DEFAULT: v('--hair'), 2: v('--hair-2') },
        // ── brand (now BLUE; class names kept as `coral` to avoid churn) ──
        coral: { DEFAULT: v('--brand'), 600: v('--brand-600'), soft: v('--brand-soft') },
        grass: { DEFAULT: v('--grass'), soft: v('--grass-soft') },
        // ── category accents (static — used as small color dots/labels) ──
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

        // ── shadcn/ui semantic tokens → CSS vars (light+dark below) ──
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover) / <alpha-value>)', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card) / <alpha-value>)', foreground: 'hsl(var(--card-foreground))' },
      },
      fontFamily: {
        sans: ['var(--font-rubik)', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-rubik)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { rsm: '10px', r: '16px', rlg: '22px', rxl: '28px', '4xl': '2rem' },
      boxShadow: {
        soft: '0 4px 8px rgba(20,30,50,.06), 0 24px 48px -16px rgba(20,30,50,.14)',
        // brand glow (blue)
        coral: '0 8px 20px -6px rgba(37,99,235,.42)',
      },
      spacing: { '18': '4.5rem', '22': '5.5rem', '30': '7.5rem' },
    },
  },
  plugins: [
    function ({ addBase }) {
      addBase({
        ':root': {
          // neutrals — light "warm paper"
          '--cream': '251 246 238',
          '--cream-deep': '244 236 224',
          '--coal': '44 39 34',
          '--coal-2': '110 101 90',
          '--coal-3': '167 157 143',
          '--hair': '236 226 210',
          '--hair-2': '224 212 192',
          // brand — blue
          '--brand': '37 99 235',      // #2563EB
          '--brand-600': '29 78 216',  // #1D4ED8 (hover)
          '--brand-soft': '230 238 252', // #E6EEFC tint
          '--grass': '47 158 114',
          '--grass-soft': '228 242 234',
          // shadcn primitives — light
          '--background': '38 53% 96%',
          '--foreground': '30 13% 15%',
          '--card': '0 0% 100%',
          '--card-foreground': '30 13% 15%',
          '--popover': '0 0% 100%',
          '--popover-foreground': '30 13% 15%',
          '--primary': '221 83% 53%',
          '--primary-foreground': '0 0% 100%',
          '--secondary': '38 39% 91%',
          '--secondary-foreground': '30 13% 15%',
          '--muted': '38 39% 91%',
          '--muted-foreground': '30 9% 45%',
          '--accent': '214 95% 93%',
          '--accent-foreground': '221 70% 30%',
          '--destructive': '8 70% 55%',
          '--destructive-foreground': '0 0% 100%',
          '--border': '38 33% 87%',
          '--input': '38 33% 87%',
          '--ring': '221 83% 53%',
          '--radius': '0.75rem',
        },
        '.dark': {
          // neutrals — cool dark (pairs with blue brand)
          '--cream': '15 18 23',        // page bg  #0F1217
          '--cream-deep': '22 27 34',   // raised panel #161B22
          '--coal': '233 236 241',      // primary text #E9ECF1
          '--coal-2': '163 170 181',    // secondary text
          '--coal-3': '122 130 142',    // muted text
          '--hair': '38 45 54',         // borders #262D36
          '--hair-2': '48 56 67',
          // brand — slightly lighter blue for contrast on dark
          '--brand': '96 165 250',      // #60A5FA
          '--brand-600': '129 184 252', // hover lighter
          '--brand-soft': '23 37 64',   // dark navy tint
          '--grass': '52 197 142',
          '--grass-soft': '18 38 30',
          // shadcn primitives — dark
          '--background': '220 20% 9%',
          '--foreground': '220 14% 92%',
          '--card': '220 17% 13%',
          '--card-foreground': '220 14% 92%',
          '--popover': '220 17% 13%',
          '--popover-foreground': '220 14% 92%',
          '--primary': '213 94% 68%',
          '--primary-foreground': '220 40% 10%',
          '--secondary': '220 14% 17%',
          '--secondary-foreground': '220 14% 92%',
          '--muted': '220 14% 17%',
          '--muted-foreground': '220 9% 60%',
          '--accent': '220 30% 20%',
          '--accent-foreground': '213 94% 80%',
          '--destructive': '6 62% 52%',
          '--destructive-foreground': '0 0% 100%',
          '--border': '220 13% 20%',
          '--input': '220 13% 22%',
          '--ring': '213 94% 68%',
        },
      });
    },
  ],
};
