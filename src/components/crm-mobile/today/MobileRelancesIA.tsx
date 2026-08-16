/**
 * Bloc « Relances IA » de l'écran « Aujourd'hui » mobile (crm-mobile/today) :
 * compte les contacts dormants et ouvre la session de relance.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useRelanceLeads } from '@/hooks/useRelanceLeads'
import { useMobileTokens } from '../useMobileTokens'

/**
 * Bloc « Relances IA » (accent immersif). Câblé `useRelanceLeads` (compte des
 * contacts dormants). « Démarrer la session » ouvre la session de relance qui
 * porte l'envoi réel. Seed (47) derrière `demo`.
 */
export function MobileRelancesIA({ demo = false, onStart }: { demo?: boolean; onStart: () => void }) {
  const { t } = useTranslation('dashboard')
  const { tk } = useMobileTokens()
  const { leads } = useRelanceLeads()
  const total = demo ? 47 : leads.length

  return (
    <div
      style={{
        marginTop: 24,
        background: tk.relanceBg,
        border: `1px solid ${tk.relanceBorder}`,
        borderRadius: 'var(--crm-radius-5xl)',
        padding: 'var(--crm-space-6xl) var(--crm-space-6xl) var(--crm-space-5xl)',
        boxShadow: tk.shadow,
        color: tk.relanceInk,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', color: tk.relanceMuted }}>
        <MEIcon name="bolt" size={15} color={tk.relanceMuted} />
        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {t('today.cockpit.tiles.relances')}
        </span>
      </div>
      <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.6, marginTop: 11 }}>
        {total} {t('today.relances.leadsToFollow')}
      </div>
      <button
        type="button"
        onClick={onStart}
        style={{
          marginTop: 16,
          width: '100%',
          height: 48,
          borderRadius: 'var(--crm-radius-pill)',
          border: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 'var(--crm-text-xl)',
          fontWeight: 600,
          color: tk.ctaInk,
          background: tk.ctaBg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--crm-space-md)',
        }}
      >
        {t('today.relances.startSession')}
        <MEIcon name="arrow-right" size={17} color={tk.ctaInk} />
      </button>
    </div>
  )
}
