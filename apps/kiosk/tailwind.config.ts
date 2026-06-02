import type { Config } from 'tailwindcss';
import preset from '../../tailwind.preset.js';

// Kiosk-local "warm paper" redesign tokens (light theme). Layered on top of the
// shared preset so the other apps stay on their current theme until reworked.
const config: Config = {
  presets: [preset],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-rubik)', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: { DEFAULT: '#FBF6EE', deep: '#F4ECE0' },
        coral: { DEFAULT: '#DC6A4C', 600: '#C8573B', soft: '#FBE9E1' },
        coal: { DEFAULT: '#2C2722', 2: '#6E655A', 3: '#A79D8F' },
        hair: { DEFAULT: '#ECE2D2', 2: '#E0D4C0' }, // hairlines
        grass: { DEFAULT: '#2F9E72', soft: '#E4F2EA' },
        // pastel category palette (solid + soft) — matches the design
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
      },
      borderRadius: {
        rsm: '10px',
        r: '16px',
        rlg: '22px',
        rxl: '28px',
      },
      boxShadow: {
        soft: '0 4px 8px rgba(74,57,40,.06), 0 24px 48px -16px rgba(74,57,40,.12)',
        coral: '0 8px 20px -6px rgba(220,106,76,.45)',
      },
      transitionTimingFunction: {
        kiosk: 'cubic-bezier(.2,.7,.3,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
