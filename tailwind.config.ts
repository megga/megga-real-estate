import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
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
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          light: '#EFF6FF',
          dark: '#1E40AF',
        },
        success: {
          DEFAULT: '#059669',
          light: '#ECFDF5',
          dark: '#047857',
        },
        warning: {
          DEFAULT: '#D97706',
          light: '#FFFBEB',
          dark: '#B45309',
        },
        danger: {
          DEFAULT: '#DC2626',
          light: '#FEF2F2',
          dark: '#B91C1C',
        },
        border: '#E5E7EB',
        input: '#F3F4F6',
        ring: '#2563EB',
        background: '#FFFFFF',
        foreground: '#1A1A1A',
        sidebar: '#FAFAFA',
        section: '#F9FAFB',
        muted: {
          DEFAULT: '#F9FAFB',
          foreground: '#6B7280',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#1A1A1A',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1A1A1A',
        },
        primary: {
          DEFAULT: '#1A1A1A',
          foreground: '#FFFFFF',
          50: '#F7F7F7',
          100: '#E8E8E8',
          200: '#D1D1D1',
          300: '#B0B0B0',
          400: '#888888',
          500: '#6D6D6D',
          600: '#5D5D5D',
          700: '#4F4F4F',
          800: '#3D3D3D',
          900: '#1A1A1A',
        },
        secondary: {
          DEFAULT: '#F9FAFB',
          foreground: '#1A1A1A',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        'accent-foreground': '#FFFFFF',
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
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)',
        navbar: '0 1px 3px rgba(0,0,0,0.05)',
        dropdown: '0 10px 40px rgba(0,0,0,0.12)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
