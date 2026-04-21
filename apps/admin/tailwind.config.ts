import type { Config } from 'tailwindcss';
import preset from '../../tailwind.preset.js';

const config: Config = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  plugins: [require('tailwindcss-animate')],
};

export default config;
