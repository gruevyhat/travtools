import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#080C14',
        panel: '#0E1420',
        steel: '#1E3A5F',
        amber: {
          DEFAULT: '#D4A017',
          dim: '#8A6810',
          bright: '#F5C842',
        },
        cyan: {
          trav: '#1FB8CD',
          dim: '#0E6B7A',
        },
        body: '#8BA4B0',
        bright: '#C8D8E0',
        alert: '#C0392B',
        safe: '#27AE60',
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        display: ['"Rajdhani"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
