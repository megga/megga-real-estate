/** Carte critère de recherche (matching mobile) — champ label/valeur en lecture seule. */
import type { CSSProperties } from 'react'
import { useMobileTokens } from '../useMobileTokens'

interface MmEditFieldProps {
  label: string
  value: string
  suffix?: string
  /** occupe les 2 colonnes (ex. zones ciblées) */
  span2?: boolean
}

/**
 * Carte critère de recherche. **Lecture seule au v1** : la mutation de
 * `search_criteria` n'est pas dans le périmètre Atelier (elle vit sur la fiche
 * contact). L'édition inline + relance moteur sont différées.
 */
export default function MmEditField({ label, value, suffix, span2 }: MmEditFieldProps) {
  const { tk } = useMobileTokens()
  const wrap: CSSProperties = {
    minWidth: 0,
    background: tk.card,
    border: `1px solid ${tk.cardBorder}`,
    borderRadius: 'var(--crm-radius-xl)',
    boxShadow: tk.shadowSm,
    padding: 'var(--crm-space-lg) var(--crm-space-xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--crm-space-2xs)',
    ...(span2 ? { gridColumn: '1 / -1' } : null),
  }
  return (
    <div style={wrap}>
      <span
        style={{
          fontSize: 'var(--crm-text-xs)',
          fontWeight: 800,
          color: tk.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-2xs)' }}>
        <span
          style={{
            fontSize: 'var(--crm-text-xl)',
            fontWeight: 800,
            color: tk.ink,
            letterSpacing: -0.3,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </span>
        {suffix ? (
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 700, color: tk.muted }}>{suffix}</span>
        ) : null}
      </div>
    </div>
  )
}
