import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          dark: 'var(--accent-dark)',
        },
        success: {
          DEFAULT: 'var(--success)',
          light: 'var(--success-light)',
          dark: 'var(--success-dark)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          light: 'var(--warning-light)',
          dark: 'var(--warning-dark)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          light: 'var(--danger-light)',
          dark: 'var(--danger-dark)',
        },
        border: 'var(--border-default)',
        input: 'var(--bg-input)',
        ring: 'var(--accent)',
        background: 'var(--bg-page)',
        foreground: 'var(--text-primary)',
        sidebar: 'var(--bg-sidebar)',
        section: 'var(--bg-section)',
        surface: 'var(--bg-surface)',
        muted: {
          DEFAULT: 'var(--bg-section)',
          foreground: 'var(--text-muted)',
        },
        popover: {
          DEFAULT: 'var(--bg-card)',
          foreground: 'var(--text-primary)',
        },
        card: {
          DEFAULT: 'var(--bg-card)',
          foreground: 'var(--text-primary)',
        },
        primary: {
          DEFAULT: 'var(--text-primary)',
          foreground: 'var(--text-inverse)',
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
        secondary: {
          DEFAULT: 'var(--bg-section)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--text-inverse)',
        },
        'accent-foreground': 'var(--text-inverse)',
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '12px',
        button: '8px',
        input: '10px',
        full: '9999px',
        badge: '6px',
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        navbar: 'var(--shadow-navbar)',
        dropdown: 'var(--shadow-dropdown)',
        modal: 'var(--shadow-modal)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
