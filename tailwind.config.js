/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#141414',
        surface2: '#1d1d1d',
        line: '#2a2a2a',
        ink: '#f4f4f4',
        muted: '#9a9a9a',
        accent: '#c6ff00',
        minima: '#ffb020',
        danger: '#ff5a5f',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
