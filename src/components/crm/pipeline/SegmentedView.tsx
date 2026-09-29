/**
 * La bascule de vue du Pipeline : Kanban (OÙ en est chaque affaire) ou Timeline (QUAND agir).
 *
 * ⚠ La vue Liste est partie avec l'ancien écran (27.09.2026) : elle ne répondait à aucune
 * question que ces deux-là ne couvrent.
 */
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '../tokens'

export type VuePipeline = 'kanban' | 'timeline'

export function SegmentedView({ value, onChange, sp }: {
  value: VuePipeline
  onChange: (v: VuePipeline) => void
  sp: CrmPalette
}) {
  const { t } = useTranslation('pipeline')
  return (
    <div style={{
      display: 'flex', padding: 'var(--crm-space-xs)', background: sp.cardBg,
      // Même filet qu'aux cartes en sombre : l'ombre y vaut 'none', et la bascule se fondait au fond.
      borderRadius: 'var(--crm-radius-pill)', boxShadow: sp.isDark ? `inset 0 0 0 1px ${sp.cardBorder}` : sp.shadowSm,
    }}>
      {(['kanban', 'timeline'] as const).map((k) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} style={{
          padding: 'var(--crm-space-md) var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
          background: value === k ? sp.accent : 'transparent',
          color: value === k ? sp.accentInk : sp.soft,
          fontWeight: value === k ? 600 : 500, fontSize: 'var(--crm-text-lg)',
          fontFamily: 'inherit',
          boxShadow: value === k ? sp.focusShadow : 'none',
        }}>{t(`view.${k}`)}</button>
      ))}
    </div>
  )
}
