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
        // Property X — Objectivity (Pangram Pangram) avec fallback graceful
        objectivity: ['"Objectivity"', '"Plus Jakarta Sans"', '"DM Sans"', 'sans-serif'],
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
          // L'APLAT : même teinte dans les deux thèmes, parce que c'est un RÔLE.
          solid: themeColor('--color-accent-solid'),
          foreground: themeColor('--color-accent-fg'),
        },

        /* ─── Admin accent (violet, theme-aware) ─── */
        'admin-accent': themeColor('--color-admin-accent'),
        'admin-accent-hover': themeColor('--color-admin-accent-hover'),
        'admin-accent-light': themeColor('--color-admin-accent-light'),

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

        /* ─── Property X — Neutrals (tokens exacts Figma) ─── */
        'px-100': '#FFFFFF',
        'px-200': '#FAFAFB',
        'px-300': '#EEEFF1',
        'px-400': '#A4A6B0',
        'px-500': '#464851',
        'px-600': '#202127',
        'px-700': '#14161C',
        'px-overlay-dark-10': '#0013581A',
      },
      fontSize: {
        xxs: ['0.625rem', { lineHeight: '1' }],
        /* ─── Property X — Display scale 1→10 (tokens exacts Figma) ─── */
        'px-display-1': ['16px', { lineHeight: '1.25', letterSpacing: '-0.48px' }],
        'px-display-2': ['18px', { lineHeight: '1.25', letterSpacing: '-0.54px' }],
        'px-display-3': ['20px', { lineHeight: '1.25', letterSpacing: '-0.6px' }],
        'px-display-4': ['22px', { lineHeight: '1.25', letterSpacing: '-0.66px' }],
        'px-display-5': ['24px', { lineHeight: '1.25', letterSpacing: '-0.72px' }],
        'px-display-6': ['30px', { lineHeight: '1.25', letterSpacing: '-0.9px' }],
        'px-display-7': ['36px', { lineHeight: '1.25', letterSpacing: '-1.08px' }],
        'px-display-8': ['48px', { lineHeight: '1.25', letterSpacing: '-1.44px' }],
        'px-display-9': ['60px', { lineHeight: '1.15', letterSpacing: '-1.8px' }],
        'px-display-10': ['72px', { lineHeight: '1.10', letterSpacing: '-2.16px' }],
        'px-paragraph-sm': ['14px', { lineHeight: '1.5', letterSpacing: '-0.42px' }],
        'px-paragraph-default': ['16px', { lineHeight: '1.5', letterSpacing: '-0.48px' }],
        'px-paragraph-lg': ['18px', { lineHeight: '1.5', letterSpacing: '-0.54px' }],
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
        /* ─── Property X — Border radius (tokens exacts Figma) ─── */
        'px-tiny': '8px',
        'px-small': '12px',
        'px-medium': '16px',
        'px-large': '24px',
        'px-pill': '200px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        navbar: 'var(--shadow-navbar)',
        dropdown: 'var(--shadow-dropdown)',
        modal: 'var(--shadow-modal)',
        /* ─── Property X — Shadows (tokens exacts Figma) ─── */
        'px-small': '0 4px 4px 0 rgba(211, 211, 211, 0.06), 0 1px 1px 0 rgba(14, 14, 14, 0.04)',
        'px-regular': '0 2px 4px 0 rgba(25, 33, 61, 0.08)',
        'px-medium': '0 8px 15px 0 rgba(25, 33, 61, 0.10)',
        'px-large': '0 8px 24px 0 rgba(25, 33, 61, 0.12)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
