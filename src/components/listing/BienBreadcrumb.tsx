// MEGGA — Bien breadcrumb (port 1:1 du proto megga-bien-page.jsx).
// Accueil › Acheter|Louer › Canton › Quartier › Type X p.

import { Link } from 'react-router-dom'

const M = {
  ink: '#0E1410',
  soft: '#4A5249',
  muted: '#847D6E',
  green: '#0041D9',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

interface BienBreadcrumbProps {
  mode: 'acheter' | 'louer'
  canton?: string | null
  neighborhood?: string | null
  address?: string | null
  type?: string | null
  rooms?: number | null
}

const TYPE_LABEL: Record<string, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  villa: 'Villa',
  chalet: 'Chalet',
  loft: 'Loft',
  studio: 'Studio',
  terrain: 'Terrain',
}

function Sep() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M3 2l3 3-3 3"
        stroke="#7A8079"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function BienBreadcrumb({
  mode,
  canton,
  neighborhood,
  address,
  type,
  rooms,
}: BienBreadcrumbProps) {
  const typeLabel = type ? TYPE_LABEL[type] || type : ''
  const lastLabel = `${typeLabel}${rooms ? ` ${rooms} p.` : ''}`.trim()

  const items: Array<{ l: string; h: string | null }> = [
    { l: 'Accueil', h: '/' },
    { l: mode === 'louer' ? 'Louer' : 'Acheter', h: mode === 'louer' ? '/louer' : '/acheter' },
  ]
  if (canton) items.push({ l: canton, h: `/${mode}?canton=${canton}` })
  if (neighborhood || address) items.push({ l: (neighborhood || address) as string, h: null })
  if (lastLabel) items.push({ l: lastLabel, h: null })

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '16px clamp(20px, 4vw, 32px) 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        fontFamily: FONT,
        fontSize: 12,
        color: M.muted,
      }}
    >
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {i > 0 && <Sep />}
          {it.h ? (
            <Link
              to={it.h}
              style={{
                color: M.muted,
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = M.green)}
              onMouseLeave={e => (e.currentTarget.style.color = M.muted)}
            >
              {it.l}
            </Link>
          ) : (
            <span
              style={{
                color: i === items.length - 1 ? M.ink : M.soft,
                fontWeight: i === items.length - 1 ? 700 : 500,
              }}
            >
              {it.l}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
