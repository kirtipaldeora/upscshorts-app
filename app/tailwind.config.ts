import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // toggled via html.dark — matches existing behaviour
  theme: {
    extend: {
      fontFamily: {
        nunito: ['Nunito', 'sans-serif'],
      },
      colors: {
        // Light mode tokens (default)
        bg1: 'var(--bg1)',
        bg2: 'var(--bg2)',
        bg3: 'var(--bg3)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        'panel-border': 'var(--panel-border)',
        card: 'var(--card)',
        card2: 'var(--card2)',
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        ink3: 'var(--ink3)',
        on: 'var(--on)',
        on2: 'var(--on2)',
        on3: 'var(--on3)',
        yellow: 'var(--yellow)',
        'yellow-deep': 'var(--yellow-deep)',
        'yellow-ink': 'var(--yellow-ink)',
        acc: 'var(--acc)',
        accent: 'var(--accent)',
        teal: 'var(--teal)',
        good: 'var(--good)',
        bad: 'var(--bad)',
        border: 'var(--border)',
        glass: 'var(--glass)',
        'glass-border': 'var(--glass-border)',
      },
      boxShadow: {
        hard: 'var(--shadow)',
        soft: 'var(--shadow-soft)',
        overlay: 'var(--overlay)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        panel: '16px',
        soft: '12px',
      },
    },
  },
  plugins: [],
}

export default config
