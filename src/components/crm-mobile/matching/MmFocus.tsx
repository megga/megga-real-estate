/** VUE 2 du matching mobile — écran focus acheteur plein écran. Voir `MmFocus`. */
import { useTranslation } from 'react-i18next'
import { useMobileTokens } from '../useMobileTokens'
import MmKyc from './MmKyc'
import MmVerifiedBadge from './MmVerifiedBadge'
import MmEditField from './MmEditField'
import MmMatchCard from './MmMatchCard'
import { mmBudgetLabel, type FocusVM, type PoolMatchVM } from './vm'

interface MmFocusProps {
  focus: FocusVM
  sent: Set<string>
  scheduled: Set<string>
  onBack: () => void
  onRequestSend: (m: PoolMatchVM) => void
  onRequestSchedule: (m: PoolMatchVM) => void
}

/**
 * VUE 2 — Focus acheteur plein écran : identité + KYC (rappel doux), critères de
 * recherche (lecture seule v1), puis biens correspondants avec gestes par bien.
 */
export default function MmFocus({ focus, sent, scheduled, onBack, onRequestSend, onRequestSchedule }: MmFocusProps) {
  const { tk } = useMobileTokens()
  const { t } = useTranslation('matching')
  const { buyer, pool } = focus
  const initials = `${(buyer.first || ' ')[0]}${(buyer.last || ' ')[0]}`.toUpperCase()
  const budget = mmBudgetLabel(buyer.budgetMin, buyer.budgetMax)

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: tk.canvas, color: tk.ink }}>
      <header
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
          paddingLeft: 'var(--crm-space-2xl)',
          paddingRight: 'var(--crm-space-3xl)',
          paddingBottom: 'var(--crm-space-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--crm-space-lg)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label={t('mobile.back')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${tk.cardBorder}`,
            background: tk.card,
            boxShadow: tk.shadowSm,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tk.ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </header>

      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '8px 18px 30px',
        }}
      >
        {/* identité acheteur */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 'var(--crm-radius-pill)',
              display: 'grid',
              placeItems: 'center',
              background: buyer.av,
              color: '#fff',
              fontSize: 'var(--crm-text-2xl)',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {initials}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }}>
              <span
                style={{
                  fontSize: 'var(--crm-text-4xl)',
                  fontWeight: 800,
                  letterSpacing: -0.5,
                  color: tk.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {buyer.first} {buyer.last}
              </span>
              {buyer.kyc === 'verified' ? <MmVerifiedBadge size={17} /> : null}
            </div>
            <div style={{ marginTop: 4 }}>
              <MmKyc kyc={buyer.kyc} />
            </div>
          </div>
        </div>

        {/* critères de recherche (lecture seule) */}
        <div style={{ marginTop: 22 }}>
          <h3
            style={{
              margin: '0 0 11px',
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 800,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: tk.muted,
            }}
          >
            {t('atelier.searchProfile')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-md)' }}>
            {budget ? <MmEditField label={t('atelier.budget')} value={budget} span2 /> : null}
            {buyer.zones.length ? (
              <MmEditField label={t('atelier.targetZones')} value={buyer.zones.join(' · ')} span2 />
            ) : null}
            {buyer.surfaceMin != null ? (
              <MmEditField label={t('atelier.minSurface')} value={String(buyer.surfaceMin)} suffix={t('mobile.surfaceSuffix')} />
            ) : null}
            {buyer.roomsMin != null ? (
              <MmEditField label={t('atelier.specRooms')} value={String(buyer.roomsMin)} suffix={t('mobile.roomsSuffix')} />
            ) : null}
            {buyer.type ? <MmEditField label={t('atelier.type')} value={buyer.type} span2 /> : null}
          </div>
        </div>

        {/* biens correspondants */}
        <div
          style={{
            marginTop: 24,
            marginBottom: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 800, letterSpacing: -0.4, color: tk.ink }}>
            {t('atelier.matchedListings')}
          </h3>
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>
            {pool.length}
          </span>
        </div>

        {pool.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: tk.muted, fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>
            {t('panel.emptyTitle')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
            {pool.map((m) => (
              <MmMatchCard
                key={m.matchId}
                m={m}
                sent={sent.has(m.matchId) || m.alreadySent}
                scheduled={scheduled.has(m.matchId)}
                canSchedule={m.kind === 'property'}
                onSend={() => onRequestSend(m)}
                onSchedule={() => onRequestSchedule(m)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
