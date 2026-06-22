// MEGGA CRM Sugar v3 — Fiche Bien (Sprint 2) — primitives partagées
// Port pixel-près du canon crm-screen-bien-detail-sugar.jsx (handoff Sprint 2).

import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
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

// ─── Alerte C2PA Sprint 3 ───────────────────────────────────────────────
// Le seul endroit du chrome agent où la signature C2PA redevient visible :
// quand des photos sont publiées sans certification d'authenticité.
// Phrasing volontairement non-technique (red-team C1) : on ne dit pas
// « C2PA », on parle de « certification d'authenticité » côté agent.
export function BdC2paAlert({
  hasPhotos,
  isVerified,
  onAction,
}: {
  hasPhotos: boolean
  isVerified: boolean
  onAction?: () => void
}) {
  const { t: tr } = useTranslation('listings')
  if (!hasPhotos || isVerified) return null
  return (
    <div
      style={{
        background: SugarV3.warnSoft,
        borderRadius: 16,
        padding: '14px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: SugarV3.card,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          boxShadow: SugarV3.shadowSm,
        }}
      >
        <SgIcon name="alert" size={16} stroke={SugarV3.warn} sw={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: SugarV3.ink, marginBottom: 2 }}>
          {tr('detail.c2paAlert.title')}
        </div>
        <div style={{ fontSize: 12.5, color: SugarV3.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
          {tr('detail.c2paAlert.body')}
        </div>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            border: 0,
            background: SugarV3.ink,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {tr('detail.c2paAlert.action')}
        </button>
      )}
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
// Mapping aligné sur PropertyStatus (src/lib/constants). Couleur du dot par
// statut ; le libellé vient de i18n (listings:status.* pour les statuts
// communs, listings:detail.status.archived pour le statut propre à la fiche).
const STATUS_DOT: Record<string, string> = {
  active: SugarV3.ok,
  draft: SugarV3.muted,
  reserved: SugarV3.warn,
  sold: SugarV3.inkSoft,
  archived: SugarV3.muted,
}
const STATUS_LABEL_KEY: Record<string, string> = {
  active: 'status.active',
  draft: 'status.draft',
  reserved: 'status.reserved',
  sold: 'status.sold',
  archived: 'detail.status.archived',
}
export function BdStatusChip({ status }: { status: string }) {
  const { t: tr } = useTranslation('listings')
  const dot = STATUS_DOT[status] ?? SugarV3.muted
  const labelKey = STATUS_LABEL_KEY[status]
  const m = { label: labelKey ? tr(labelKey) : status, dot }
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
// Sprint 3 : le badge C2PA a été RETIRÉ du chrome agent. Les props
// c2paVerified / photoCount / showBadge sont conservées pour la compat
// API mais ignorées — la signature C2PA tourne en arrière-plan, sa trace
// vit dans le journal d'audit nLPD (Sprint 1).
// Côté marketplace publique, le badge reste sur C2PaBadge / ListingCard.
export function BdPhoto({
  photos,
  fallbackId,
  w = '100%',
  h = '100%',
}: {
  photos?: string[] | null
  fallbackId: string
  /** @deprecated Sprint 3 — badge retiré du chrome agent. Prop ignorée. */
  c2paVerified?: boolean
  /** @deprecated Sprint 3 — badge retiré du chrome agent. Prop ignorée. */
  photoCount?: number
  w?: string | number
  h?: string | number
  /** @deprecated Sprint 3 — badge retiré du chrome agent. Prop ignorée. */
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
      {/* Sprint 3 : badge C2PA retiré — signature en arrière-plan, log audit nLPD. */}
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
  const base = `CHF ${amount.toLocaleString('fr-CH').replace(/[\u00A0\u202F,]/g, "'")}`
  return isRent ? `${base}${i18n.t('listings:detail.perMonth')}` : base
}

/** Format prix au m² depuis price + surface. Retourne null si l'un manque. */
export function bdPricePerM2(
  price: number | null | undefined,
  area: number | null | undefined,
): string | null {
  if (!price || !area || area === 0) return null
  const ppm2 = Math.round(price / area)
  return `CHF ${ppm2.toLocaleString('fr-CH').replace(/[\u00A0\u202F,]/g, "'")}/m²`
}

/** Format CHF simple (sans /mois). */
export function bdFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return `CHF ${n.toLocaleString('fr-CH').replace(/[\u00A0\u202F,]/g, "'")}`
}

// ─── Labels stage pipeline (deals liés) ─────────────────────────────────
// Les 14 stades DB de la fiche bien. i18n-aware via l'instance i18n (utilisable
// hors composant React) ; fallback sur le code brut si la clé manque ou est
// inconnue. Clés sous listings:detail.stage.*.
const BD_STAGE_KEYS = new Set([
  'new_lead', 'to_qualify', 'active_search', 'visit_planned', 'visit_done',
  'interest_confirmed', 'offer', 'negotiation', 'reserved', 'financing',
  'notary', 'signed', 'lost', 'to_recontact',
])
export function bdStageLabel(stage: string): string {
  if (BD_STAGE_KEYS.has(stage)) return i18n.t(`listings:detail.stage.${stage}`)
  return stage
}
