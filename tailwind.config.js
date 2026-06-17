/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D7377',
          50: '#e6f5f5',
          100: '#ccebeb',
          200: '#99d7d8',
          300: '#66c3c5',
          400: '#33afb2',
          500: '#0D7377',
          600: '#0a5c5f',
          700: '#084547',
          800: '#052e2f',
          900: '#031718',
        },
        'bg-dark': '#1B2A4A',
        'accent-orange': '#F59E0B',
        'accent-green': '#10B981',
        'accent-red': '#EF4444',
      },
      fontFamily: {
        noto: ['"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-status': 'pulse-status 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-status': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
