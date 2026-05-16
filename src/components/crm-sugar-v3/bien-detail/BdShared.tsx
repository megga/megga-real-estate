// MEGGA CRM Sugar v3 — Fiche Bien (Sprint 2) — primitives partagées
// Port pixel-près du canon crm-screen-bien-detail-sugar.jsx (handoff Sprint 2).

import type { CSSProperties, ReactNode } from 'react'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'

// ─── Eyebrow ────────────────────────────────────────────────────────────
export function BdEyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: SugarV3.muted,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  )
}

// ─── Card blanche radius 24px + sgFadeUp ────────────────────────────────
export function BdCard({
  children,
  padding = 28,
  style,
}: {
  children: ReactNode
  padding?: number | string
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 24,
        boxShadow: SugarV3.shadow,
        padding,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Input inline (mode édition) ────────────────────────────────────────
// Préserve la typo du champ display tout en révélant un input modifiable.
export function BdEditInput({
  value,
  onChange,
  type = 'text',
  style,
  placeholder,
  prefix,
  suffix,
  block,
  inputProps,
}: {
  value: string | number
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'date'
  style?: CSSProperties
  placeholder?: string
  prefix?: ReactNode
  suffix?: ReactNode
  block?: boolean
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}) {
  return (
    <div
      style={{
        display: block ? 'flex' : 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        width: block ? '100%' : 'auto',
        background: SugarV3.cardSubtle,
        borderRadius: 12,
        padding: '4px 10px',
        boxShadow: `inset 0 0 0 1px ${SugarV3.cardSubtle}`,
        transition: 'box-shadow .12s ease',
        boxSizing: 'border-box',
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${SugarV3.ink}`
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${SugarV3.cardSubtle}`
      }}
    >
      {prefix && (
        <span style={{ color: SugarV3.muted, fontSize: 14, fontWeight: 500 }}>
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...inputProps}
        style={{
          background: 'transparent',
          border: 0,
          outline: 'none',
          fontFamily: 'inherit',
          color: SugarV3.ink,
          padding: 0,
          width: '100%',
          minWidth: 30,
          ...style,
        }}
      />
      {suffix && (
        <span style={{ color: SugarV3.muted, fontSize: 14, fontWeight: 500 }}>
          {suffix}
        </span>
      )}
    </div>
  )
}

// ─── Status chip ─────────────────────────────────────────────────────────
// Mapping aligné sur PropertyStatus (src/lib/constants).
const STATUS_MAP: Record<string, { label: string; dot: string }> = {
  active: { label: 'Actif', dot: SugarV3.ok },
  draft: { label: 'Brouillon', dot: SugarV3.muted },
  reserved: { label: 'Réservé', dot: SugarV3.warn },
  sold: { label: 'Vendu', dot: SugarV3.inkSoft },
  archived: { label: 'Archivé', dot: SugarV3.muted },
}
export function BdStatusChip({ status }: { status: string }) {
  const m = STATUS_MAP[status] ?? { label: status, dot: SugarV3.muted }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 999,
        background: SugarV3.cardSubtle,
        color: SugarV3.inkSoft,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: m.dot,
        }}
      />
      {m.label}
    </span>
  )
}

// ─── Photo : vraie URL si dispo, sinon gradient hash stable ─────────────
export function BdPhoto({
  photos,
  fallbackId,
  c2paVerified,
  photoCount,
  w = '100%',
  h = '100%',
  showBadge = true,
}: {
  photos?: string[] | null
  fallbackId: string
  c2paVerified?: boolean
  photoCount?: number
  w?: string | number
  h?: string | number
  showBadge?: boolean
}) {
  const url = photos && photos.length > 0 ? photos[0] : null
  const hash = fallbackId
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0)
  const hues = [212, 28, 162, 280, 18]
  const hue = hues[hash % hues.length]

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        overflow: 'hidden',
        borderRadius: 'inherit',
        background: url
          ? `url(${url}) center/cover no-repeat`
          : `linear-gradient(135deg, hsl(${hue},35%,42%) 0%, hsl(${
              (hue + 35) % 360
            },45%,28%) 100%)`,
      }}
    >
      {!url && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.18,
          }}
        >
          <rect x="10" y="40" width="20" height="40" fill="#fff" />
          <rect x="35" y="25" width="25" height="55" fill="#fff" />
          <rect x="65" y="35" width="25" height="45" fill="#fff" />
        </svg>
      )}
      {showBadge && c2paVerified && (
        <span
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(11,12,14,0.7)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <SgIcon name="shield" size={11} stroke="#fff" sw={2} />
          C2PA{photoCount ? ` · ${photoCount} photos` : ''}
        </span>
      )}
    </div>
  )
}

// ─── Formatters spécifiques fiche Bien ──────────────────────────────────

/** Format CHF prix principal (vente ou loyer/mois selon transaction_type). */
export function bdFormatPrice(
  amount: number | null | undefined,
  isRent: boolean,
): string {
  if (amount == null) return '—'
  const base = `CHF ${amount.toLocaleString('fr-CH').replace(/[  ,]/g, "'")}`
  return isRent ? `${base}/mois` : base
}

/** Format prix au m² depuis price + surface. Retourne null si l'un manque. */
export function bdPricePerM2(
  price: number | null | undefined,
  area: number | null | undefined,
): string | null {
  if (!price || !area || area === 0) return null
  const ppm2 = Math.round(price / area)
  return `CHF ${ppm2.toLocaleString('fr-CH').replace(/[  ,]/g, "'")}/m²`
}

/** Format CHF simple (sans /mois). */
export function bdFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return `CHF ${n.toLocaleString('fr-CH').replace(/[  ,]/g, "'")}`
}

// ─── Labels stage pipeline (deals liés) ─────────────────────────────────
export const BD_STAGE_LABEL: Record<string, string> = {
  new_lead: 'Nouveau lead',
  to_qualify: 'À qualifier',
  active_search: 'En recherche',
  visit_planned: 'Visite planifiée',
  visit_done: 'Visite effectuée',
  interest_confirmed: 'Intérêt confirmé',
  offer: 'Offre',
  negotiation: 'Négociation',
  reserved: 'Réservé',
  financing: 'Financement',
  notary: 'Notaire',
  signed: 'Signé',
  lost: 'Perdu',
  to_recontact: 'À relancer',
}
