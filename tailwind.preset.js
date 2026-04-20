/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // category palette (matches spec §3)
        category: {
          academic: '#60a5fa',    // A
          online: '#60a5fa',      // B
          hemis: '#a78bfa',       // C
          extra: '#fbbf24',       // D
          finance: '#34d399',     // E
          orders: '#f87171',      // F
          intl: '#fb7185',        // G
          science: '#22d3ee',     // H
          docs: '#e879f9',        // I
        },
      },
      fontSize: {
        // huge sizes for kiosk/display screens
        'kiosk-xl': ['6rem', { lineHeight: '1' }],
        'kiosk-lg': ['4rem', { lineHeight: '1.1' }],
        'kiosk-md': ['2rem', { lineHeight: '1.3' }],
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
