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
        borderRadius: 22,
        padding: '22px 22px 20px',
        boxShadow: tk.shadow,
        color: tk.relanceInk,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: tk.relanceMuted }}>
        <MEIcon name="bolt" size={15} color={tk.relanceMuted} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {t('today.cockpit.tiles.relances')}
        </span>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.6, marginTop: 11 }}>
        {total} {t('today.relances.leadsToFollow')}
      </div>
      <button
        type="button"
        onClick={onStart}
        style={{
          marginTop: 16,
          width: '100%',
          height: 48,
          borderRadius: 999,
          border: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 14.5,
          fontWeight: 800,
          color: tk.ctaInk,
          background: tk.ctaBg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        }}
      >
        {t('today.relances.startSession')}
        <MEIcon name="arrow-right" size={17} color={tk.ctaInk} />
      </button>
    </div>
  )
}
