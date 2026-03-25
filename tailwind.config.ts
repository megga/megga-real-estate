import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/** Helper: reference a CSS variable as an RGB color with alpha support */
function themeColor(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
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
        /* ─── Theme-aware semantic tokens ─── */
        'theme-page': themeColor('--color-bg-page'),
        'theme-card': themeColor('--color-bg-card'),
        'theme-section': themeColor('--color-bg-section'),
        'theme-sidebar': themeColor('--color-bg-sidebar'),
        'theme-input': themeColor('--color-bg-input'),
        'theme-elevated': themeColor('--color-bg-elevated'),
        'theme-hover': themeColor('--color-bg-hover'),
        'theme-active': themeColor('--color-bg-active'),
        'theme-overlay': themeColor('--color-bg-overlay'),

        'theme-primary': themeColor('--color-text-primary'),
        'theme-secondary': themeColor('--color-text-secondary'),
        'theme-tertiary': themeColor('--color-text-tertiary'),
        'theme-inverse': themeColor('--color-text-inverse'),
        'theme-muted': themeColor('--color-text-muted'),

        'theme-border': themeColor('--color-border'),
        'theme-border-subtle': themeColor('--color-border-subtle'),
        'theme-border-focus': themeColor('--color-border-focus'),

        /* ─── Accent (theme-aware) ─── */
        accent: {
          DEFAULT: themeColor('--color-accent'),
          hover: themeColor('--color-accent-hover'),
          light: themeColor('--color-accent-light'),
          dark: themeColor('--color-accent-dark'),
          foreground: themeColor('--color-accent-fg'),
        },

        /* ─── Semantic status colors (theme-aware) ─── */
        success: {
          DEFAULT: themeColor('--color-success'),
          light: themeColor('--color-success-light'),
          dark: themeColor('--color-success-dark'),
        },
        warning: {
          DEFAULT: themeColor('--color-warning'),
          light: themeColor('--color-warning-light'),
          dark: themeColor('--color-warning-dark'),
        },
        danger: {
          DEFAULT: themeColor('--color-danger'),
          light: themeColor('--color-danger-light'),
          dark: themeColor('--color-danger-dark'),
        },

        /* ─── Legacy aliases (for shadcn/ui compat) ─── */
        border: themeColor('--color-border'),
        input: themeColor('--color-bg-input'),
        ring: themeColor('--color-ring'),
        background: themeColor('--color-bg-page'),
        foreground: themeColor('--color-text-primary'),
        sidebar: themeColor('--color-bg-sidebar'),
        section: themeColor('--color-bg-section'),

        muted: {
          DEFAULT: themeColor('--color-bg-section'),
          foreground: themeColor('--color-text-muted'),
        },
        popover: {
          DEFAULT: themeColor('--color-bg-elevated'),
          foreground: themeColor('--color-text-primary'),
        },
        card: {
          DEFAULT: themeColor('--color-bg-card'),
          foreground: themeColor('--color-text-primary'),
        },
        primary: {
          DEFAULT: themeColor('--color-text-primary'),
          foreground: themeColor('--color-text-inverse'),
          50: themeColor('--color-bg-hover'),
          100: themeColor('--color-bg-active'),
          200: themeColor('--color-border'),
          300: themeColor('--color-text-tertiary'),
          400: themeColor('--color-text-tertiary'),
          500: themeColor('--color-text-muted'),
          600: themeColor('--color-text-secondary'),
          700: themeColor('--color-text-secondary'),
          800: themeColor('--color-text-primary'),
          900: themeColor('--color-text-primary'),
        },
        secondary: {
          DEFAULT: themeColor('--color-bg-section'),
          foreground: themeColor('--color-text-primary'),
        },
        destructive: {
          DEFAULT: themeColor('--color-danger'),
          foreground: themeColor('--color-accent-fg'),
        },
        'accent-foreground': themeColor('--color-accent-fg'),

        /* ─── CalendarCN event colors ─── */
        'event-red': { DEFAULT: 'var(--event-red)', border: 'var(--event-red-border)', bg: 'var(--event-red-bg)' },
        'event-orange': { DEFAULT: 'var(--event-orange)', border: 'var(--event-orange-border)', bg: 'var(--event-orange-bg)' },
        'event-yellow': { DEFAULT: 'var(--event-yellow)', border: 'var(--event-yellow-border)', bg: 'var(--event-yellow-bg)' },
        'event-green': { DEFAULT: 'var(--event-green)', border: 'var(--event-green-border)', bg: 'var(--event-green-bg)' },
        'event-blue': { DEFAULT: 'var(--event-blue)', border: 'var(--event-blue-border)', bg: 'var(--event-blue-bg)' },
        'event-purple': { DEFAULT: 'var(--event-purple)', border: 'var(--event-purple-border)', bg: 'var(--event-purple-bg)' },
        'event-gray': { DEFAULT: 'var(--event-gray)', border: 'var(--event-gray-border)', bg: 'var(--event-gray-bg)' },
        'calendar-weekend': 'var(--calendar-weekend)',
      },
      fontSize: {
        xxs: ['0.625rem', { lineHeight: '1' }],
      },
      borderRadius: {
        DEFAULT: 'var(--radius-button, 8px)',
        card: 'var(--radius-card, 12px)',
        button: 'var(--radius-button, 8px)',
        input: 'var(--radius-input, 10px)',
        full: '9999px',
        badge: 'var(--radius-badge, 6px)',
        xl: 'var(--radius-card, 12px)',
        lg: 'var(--radius-button, 8px)',
        md: 'var(--radius-badge, 6px)',
        sm: '4px',
        xs: '3px',
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
