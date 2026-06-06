import type { Config } from 'tailwindcss';
import preset from '../../tailwind.preset.js';

// Kiosk inherits all colours (blue brand + light/dark vars) from the shared
// preset. Only kiosk-specific extras stay here.
const config: Config = {
  presets: [preset],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-rubik)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        kiosk: 'cubic-bezier(.2,.7,.3,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
