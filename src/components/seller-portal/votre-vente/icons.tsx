// MEGGA — Espace vendeur — iconographie line (stroke), jamais d'emoji.
// Porté de la maquette (SvIcon, SvAvatarCircle).
import type { ReactNode } from 'react'

export type SvIconName =
  | 'whatsapp'
  | 'phone'
  | 'mail'
  | 'lock'
  | 'pin'
  | 'check'
  | 'x'
  | 'arrowUpDown'
  | 'arrowDown'
  | 'sparkle'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'globe'
  | 'calendar'
  | 'grid'
  | 'chevronLeft'
  | 'chevronRight'

const PATHS: Record<SvIconName, ReactNode> = {
  whatsapp: (
    <path
      d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.25.69-1.45 1.32-1.99 1.36-.53.04-.54.42-3.4-.71-2.86-1.13-4.62-4.06-4.76-4.25-.14-.19-1.13-1.5-1.13-2.86 0-1.36.71-2.03.96-2.31.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.25.6.85 2.07.92 2.22.07.15.12.32.02.51-.1.19-.15.31-.3.48-.15.17-.31.38-.45.51-.15.14-.3.29-.13.57.17.28.77 1.27 1.65 2.06 1.13 1.01 2.09 1.32 2.37 1.46.28.14.45.12.61-.07.16-.19.71-.83.9-1.11.19-.28.37-.23.62-.14.25.09 1.61.76 1.89.9.28.14.46.21.53.32.07.11.07.65-.18 1.34Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  check: <path d="m5 13 4 4 10-12" />,
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  arrowUpDown: (
    <>
      <path d="M7 4v16" />
      <path d="m3 8 4-4 4 4" />
      <path d="M17 20V4" />
      <path d="m21 16-4 4-4-4" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 4.9L18.7 9.7 13.8 11.5 12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
}

interface SvIconProps {
  name: SvIconName
  size?: number
  stroke?: string
  sw?: number
  fill?: string
}

export function SvIcon({ name, size = 20, stroke = 'currentColor', sw = 1.7, fill = 'none' }: SvIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name] ?? null}
    </svg>
  )
}

/** Wordmark MEGGA officiel (assets/megga-logo.svg du handoff), monochrome.
 *  fill = SP.ink → noir en clair, presque-blanc en dark (équivalent du filter:invert de la maquette). */
export function SvLogo({ height = 22, color = 'currentColor' }: { height?: number; color?: string }) {
  return (
    <svg viewBox="0 0 1920 419" height={height} role="img" aria-label="MEGGA" style={{ display: 'block', width: 'auto', fill: color }}>
      <polygon points="92 0 237.62 219.08 384 0 475 0 475.31 63.04 363.87 229.77 237.7 418.79 104.93 220.12 104.62 419 0 419 0 0 92 0" />
      <polygon points="826 0 826.06 94.73 622.1 94.74 621.94 167.65 791.33 167.66 791.33 251.37 622.01 251.37 621.99 324.3 826.05 324.29 825.97 419 517.35 419 517 0 826 0" />
      <path d="M1052,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92-96.69-88.85-90.73-249.43,12.42-329.58,29.62-23.01,64.08-35.58,100.62-39.5h31Z" />
      <path d="M1732,0l188,418.23v.77h-104.98l-42.28-94.7h-124.31s-42.38,94.7-42.38,94.7h-104.22c.24-1.34.57-2.95,1.41-4.82L1690,0h42ZM1739.67,250.92l-29.06-64.46-29.15,64.86,58.21-.39Z" />
      <path d="M1351,419h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8Z" />
      <path d="M1351,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25,31.59-28.19,70.35-43.46,111.55-47.62h29Z" />
      <polygon points="475.11 419 370.91 419 370.69 251.26 475.21 95.29 475.11 419" />
    </svg>
  )
}

interface SvAvatarCircleProps {
  name: string
  size?: number
  photo?: string | null
}

/** Avatar agent : cercle dégradé bleu→cyan avec initiales en fallback. */
export function SvAvatarCircle({ name, size = 84, photo }: SvAvatarCircleProps) {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #2A6FDB 0%, #0E7490 100%)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span
          style={{
            color: '#fff',
            fontWeight: 700,
            fontSize: Math.round(size * 0.4),
            letterSpacing: 0.3,
            lineHeight: 1,
          }}
        >
          {initials}
        </span>
      )}
    </div>
  )
}
