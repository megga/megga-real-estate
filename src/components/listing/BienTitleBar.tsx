// MEGGA — Bien title bar (port 1:1 du proto megga-bien-page.jsx TitleBar).
// Chips à gauche (type / mode / Neuf / Baisse de prix) + h1 36px Manrope 800
// + adresse avec icone pin + 3 IconButtons à droite (Favori / Partager / Imprimer).

import { useState, useEffect, type ReactNode } from 'react'

const M = {
  ink: '#0E1410',
  soft: '#4A5249',
  muted: '#847D6E',
  border: '#DDE2EA',
  card: '#FFFFFF',
  green: '#0041D9',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

const TYPE_LABEL: Record<string, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  villa: 'Villa',
  chalet: 'Chalet',
  loft: 'Loft',
  studio: 'Studio',
  terrain: 'Terrain',
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Disponible',
  compromis: 'Sous compromis',
  sold: 'Vendu',
}

type ChipColor = 'default' | 'primary' | 'alert' | 'dark'

const CHIP_STYLES: Record<ChipColor, { bg: string; fg: string; br: string }> = {
  default: { bg: '#fff', fg: M.ink, br: M.border },
  primary: { bg: '#E8EFFE', fg: '#0041D9', br: 'transparent' },
  alert: { bg: '#FEEBEC', fg: '#C2273C', br: 'transparent' },
  dark: { bg: M.ink, fg: '#fff', br: 'transparent' },
}

interface ChipProps {
  children: ReactNode
  color?: ChipColor
}

function Chip({ children, color = 'default' }: ChipProps) {
  const s = CHIP_STYLES[color]
  return (
    <span
      style={{
        height: 26,
        padding: '0 11px',
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.br}`,
        fontFamily: FONT,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        display: 'inline-flex',
        alignItems: 'center',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  )
}

interface IconButtonProps {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  title?: string
}

function IconButton({ children, onClick, active, title }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 42,
        height: 42,
        borderRadius: 999,
        border: `1px solid ${active ? '#E53935' : M.border}`,
        background: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s, background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.borderColor = M.muted
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.borderColor = M.border
      }}
    >
      {children}
    </button>
  )
}

interface SharePopoverProps {
  url: string
  title: string
  onClose: () => void
}

function SharePopover({ url, title, onClose }: SharePopoverProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-share-popover]')) onClose()
    }
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const opts: Array<{ l: string; do: () => void }> = [
    {
      l: copied ? 'Lien copié ✓' : 'Copier le lien',
      do: () => {
        navigator.clipboard?.writeText(url)
        setCopied(true)
      },
    },
    {
      l: 'Email',
      do: () =>
        window.open(
          `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`
        ),
    },
    {
      l: 'WhatsApp',
      do: () =>
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${title} · ${url}`)}`
        ),
    },
    {
      l: 'Messenger',
      do: () =>
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        ),
    },
  ]

  return (
    <div
      data-share-popover
      style={{
        position: 'absolute',
        top: 50,
        right: 0,
        zIndex: 50,
        width: 220,
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 12,
        boxShadow: '0 14px 40px rgba(14,20,16,0.14)',
        padding: 6,
      }}
    >
      {opts.map(o => (
        <button
          key={o.l}
          onClick={o.do}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '10px 12px',
            border: 'none',
            background: 'transparent',
            fontFamily: FONT,
            fontSize: 13,
            color: M.ink,
            fontWeight: 500,
            cursor: 'pointer',
            borderRadius: 8,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F6F8FC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

interface BienTitleBarProps {
  title: string
  type?: string | null
  mode: 'acheter' | 'louer'
  isNew?: boolean
  isPriceReduced?: boolean
  status?: 'available' | 'compromis' | 'sold'
  address: string
  canton?: string | null
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

export default function BienTitleBar({
  title,
  type,
  mode,
  isNew,
  isPriceReduced,
  status = 'available',
  address,
  canton,
  isFavorite = false,
  onToggleFavorite,
}: BienTitleBarProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '20px clamp(20px, 4vw, 32px) 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {type && <Chip>{TYPE_LABEL[type] || type}</Chip>}
          <Chip color="primary">{mode === 'louer' ? 'À louer' : 'À vendre'}</Chip>
          {isNew && <Chip>Neuf</Chip>}
          {isPriceReduced && mode !== 'louer' && <Chip color="alert">Baisse de prix</Chip>}
          {status !== 'available' && <Chip color="dark">{STATUS_LABEL[status]}</Chip>}
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(26px, 4vw, 36px)',
            fontWeight: 800,
            color: M.ink,
            margin: 0,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>

        {/* Address */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 15,
            color: M.soft,
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M7 13s5-4.5 5-8a5 5 0 10-10 0c0 3.5 5 8 5 8z" />
            <circle cx="7" cy="5" r="1.6" />
          </svg>
          {address}
          {canton && `, ${canton}`}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, position: 'relative' }}>
        <IconButton
          onClick={onToggleFavorite}
          active={isFavorite}
          title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 18 18"
            fill={isFavorite ? '#E53935' : 'none'}
            stroke={isFavorite ? '#E53935' : M.ink}
            strokeWidth="1.6"
          >
            <path d="M9 16s-7-4-7-10a4 4 0 017-2 4 4 0 017 2c0 6-7 10-7 10z" />
          </svg>
        </IconButton>
        <IconButton onClick={() => setShareOpen(o => !o)} title="Partager">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke={M.ink}
            strokeWidth="1.5"
          >
            <circle cx="3.5" cy="7" r="1.8" />
            <circle cx="10.5" cy="3.5" r="1.8" />
            <circle cx="10.5" cy="10.5" r="1.8" />
            <path d="M5 6l4-2 M5 8l4 2" />
          </svg>
        </IconButton>
        <IconButton onClick={() => window.print()} title="Imprimer">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke={M.ink}
            strokeWidth="1.4"
          >
            <path d="M3 5V2h8v3 M3 9H1V5h12v4h-2 M4 8h6v5H4z" />
          </svg>
        </IconButton>
        {shareOpen && (
          <SharePopover
            url={url}
            title={title}
            onClose={() => setShareOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
