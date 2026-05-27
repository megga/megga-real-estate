// MEGGA CRM Sugar v2 — Documents atoms (DocIcon, DocStatusPill, DocViewToggle)
// 1:1 port from `crm-documents-sugar-shell.jsx`.

import type { ReactNode } from 'react'
import type { SugarPalette } from '../tokens'
import { DOC_STATUSES, type DocStatus } from './data'

export type DocIconName =
  | 'file' | 'file-signature' | 'file-check' | 'file-plus' | 'package'
  | 'door-open' | 'hand-coin' | 'award' | 'sparkles' | 'clock' | 'alert'
  | 'check' | 'x' | 'eye' | 'download' | 'send' | 'link' | 'search'
  | 'plus' | 'arrowL' | 'arrowR' | 'grid' | 'dossier' | 'template'
  | 'upload' | 'mic' | 'sliders' | 'anonymous' | 'user' | 'chevron'
  | 'edit'

const PATHS: Record<DocIconName, ReactNode> = {
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </>
  ),
  'file-signature': (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 18s1-2 4-2 4 2 4 2" />
    </>
  ),
  'file-check': (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  'file-plus': (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M12 12v6M9 15h6" />
    </>
  ),
  package: (
    <>
      <path d="m21 16-9 5-9-5V8l9-5 9 5v8Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 12v9" />
    </>
  ),
  'door-open': (
    <>
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h20" />
      <path d="M13 20V4l-7 2v14" />
      <path d="M10 12h.01" />
    </>
  ),
  'hand-coin': (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h2" />
      <path d="M9 12V8" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m15.5 13-2 7L12 17l-1.5 3-2-7" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.3 6.3 2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.5 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  check: <path d="m20 6-11 11-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrowL: <path d="M19 12H5M11 19l-7-7 7-7" />,
  arrowR: <path d="M5 12h14M13 5l7 7-7 7" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  dossier: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  ),
  template: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </>
  ),
  upload: (
    <>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21v-5M20 12V3" />
      <path d="M2 14h4M10 8h4M18 16h4" />
    </>
  ),
  anonymous: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
      <path d="m9 7 6 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  edit: (
    <>
      <path d="M11 4H4v16h16v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </>
  ),
}

interface DocIconProps {
  name: DocIconName
  size?: number
  color?: string
  strokeWidth?: number
  fill?: string
}

export function DocIcon({
  name,
  size = 18,
  color = 'currentColor',
  strokeWidth = 1.6,
  fill = 'none',
}: DocIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {PATHS[name] || null}
    </svg>
  )
}

interface DocStatusPillProps {
  status: DocStatus
  size?: 'sm' | 'md'
}

export function DocStatusPill({ status, size = 'md' }: DocStatusPillProps) {
  const s = DOC_STATUSES[status] || DOC_STATUSES.draft
  const fontSize = size === 'sm' ? 11 : 12
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: size === 'sm' ? '3px 8px' : '4px 10px',
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        fontSize,
        fontWeight: 600,
        letterSpacing: '.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

// 'templates' retiré : pas de table document_templates en prod, view inerte.
export type DocViewId = 'living' | 'grid'

interface DocViewToggleProps {
  value: DocViewId
  onChange: (v: DocViewId) => void
  sp: SugarPalette
}

export function DocViewToggle({ value, onChange, sp }: DocViewToggleProps) {
  const opts: { id: DocViewId; label: string; icon: DocIconName }[] = [
    { id: 'living', label: 'Dossier vivant', icon: 'dossier' },
    { id: 'grid', label: 'Grille docs', icon: 'grid' },
  ]
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 999,
        background: sp.cardSubBg,
        boxShadow: `inset 0 0 0 1px ${sp.cardBorder}`,
      }}
    >
      {opts.map(o => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              padding: '0 16px',
              borderRadius: 999,
              background: active ? sp.ink : 'transparent',
              color: active ? sp.pageBg : sp.soft,
              boxShadow: active ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 700 : 600,
              fontFamily: 'inherit',
              letterSpacing: -0.1,
              transition: 'all .18s ease',
            }}
          >
            <DocIcon name={o.icon} size={14} color={active ? sp.pageBg : sp.soft} />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
