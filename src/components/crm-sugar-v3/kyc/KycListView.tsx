// MEGGA CRM Sugar v3 — Vue liste KYC (par défaut)
// Port du handoff Claude Design juin 2026 (crm-screen-kyc-sugar.jsx §KycListView).
//
// Politique KYC NON-BLOQUANTE (CLAUDE.md, handoff §1 — PRIORITÉ conformité) :
//  - chapô = rappel doux, jamais « bloque le pipeline »
//  - PAS d'onglet « Bloquants pipeline » ni de filtre `blocking`
//  - thème dynamique clair ↔ sombre (useKycPalette)

import { useTranslation } from 'react-i18next'
import { useKycPalette } from './kycPalette'
import { KycBlackPill, KycGhostPill, KycStatCard } from './kycPrimitives'
import { SgIcon } from '../icons'
import { KycDossierRow } from './KycDossierRow'
import { useKycDossiers, type KycDossierRow as KycDossierRowData } from '@/hooks/useKycDossier'
import type { KycDossierStatus } from '@/types/kyc'

export type FilterKey = 'all' | 'pending' | 'none' | 'verified' | 'risk'

interface Props {
  onOpen: (id: string) => void
  onNewDossier: () => void
  filter: FilterKey
  setFilter: (f: FilterKey) => void
}

export function KycListView({ onOpen, onNewDossier, filter, setFilter }: Props) {
  const { t } = useTranslation('kyc')
  const sp = useKycPalette()
  const { data: dossiers = [], isLoading, isError, error, refetch } = useKycDossiers()

  const stats = {
    verified: dossiers.filter((d) => d.dossier_status === 'verified').length,
    pending: dossiers.filter((d) => d.dossier_status === 'pending').length,
    none: dossiers.filter((d) => d.dossier_status === 'none').length,
    risk: dossiers.filter(
      (d) => d.risk_level === 'high' || d.risk_level === 'medium',
    ).length,
    stale: dossiers.filter((d) => d.dossier_status === 'stale').length,
    high: dossiers.filter((d) => d.risk_level === 'high').length,
  }

  const filtered = dossiers.filter((d: KycDossierRowData) => {
    if (filter === 'all') return true
    if (filter === 'verified') return d.dossier_status === 'verified'
    if (filter === 'pending') return d.dossier_status === 'pending'
    if (filter === 'none') return (d.dossier_status as KycDossierStatus) === 'none'
    if (filter === 'risk') return d.risk_level === 'high'
    return true
  })

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* HEADER */}
      <div
        className="sg-row-stack"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 32,
          alignItems: 'flex-end',
          marginBottom: 36,
          animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div>
          <h1
            className="sg-h1"
            style={{
              margin: '0 0 12px',
              fontSize: 40,
              fontWeight: 700,
              color: sp.ink,
              letterSpacing: -0.8,
              lineHeight: 1.05,
            }}
          >
            {t('list.heading')}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: sp.inkSoft,
              fontWeight: 500,
              lineHeight: 1.55,
              maxWidth: 580,
            }}
          >
            {t('list.intro')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <KycGhostPill
            icon={<SgIcon name="download" size={14} stroke={sp.inkSoft} />}
          >
            {t('list.export')}
          </KycGhostPill>
          <KycBlackPill
            size="lg"
            onClick={onNewDossier}
            icon={<SgIcon name="plus" size={16} stroke={sp.onAccent} sw={2} />}
          >
            {t('list.newDossier')}
          </KycBlackPill>
        </div>
      </div>

      {/* STATS BENTO — 4 cards (handoff §8 : sans pastilles) */}
      <div
        className="sg-grid-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 36,
          animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <KycStatCard
          label={t('list.stats.verifiedLabel')}
          value={stats.verified}
          sub={t('list.stats.verifiedSub')}
        />
        <KycStatCard
          label={t('list.stats.pendingLabel')}
          value={stats.pending}
          sub={t('list.stats.pendingSub')}
        />
        <KycStatCard
          label={t('list.stats.noneLabel')}
          value={stats.none}
          sub={t('list.stats.noneSub')}
        />
        <KycStatCard
          label={t('list.stats.riskLabel')}
          value={stats.risk}
          sub={t('list.stats.riskSub')}
        />
      </div>

      {/* FILTRES — sans « Bloquants pipeline » (KYC non-bloquant) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          flexWrap: 'wrap',
          animation: 'sgFadeUp .6s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <KycGhostPill active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('list.filters.all', { count: dossiers.length })}
        </KycGhostPill>
        <KycGhostPill active={filter === 'pending'} onClick={() => setFilter('pending')}>
          {t('list.filters.pending', { count: stats.pending })}
        </KycGhostPill>
        <KycGhostPill active={filter === 'none'} onClick={() => setFilter('none')}>
          {t('list.filters.none', { count: stats.none })}
        </KycGhostPill>
        <KycGhostPill active={filter === 'verified'} onClick={() => setFilter('verified')}>
          {t('list.filters.verified', { count: stats.verified })}
        </KycGhostPill>
        <KycGhostPill active={filter === 'risk'} onClick={() => setFilter('risk')}>
          {t('list.filters.highRisk', { count: stats.high })}
        </KycGhostPill>
      </div>

      {/* LISTE */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animation: 'sgFadeUp .65s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {isError && !isLoading && (
          <div
            role="alert"
            style={{
              padding: '20px 24px',
              background: sp.card,
              borderRadius: 22,
              border: `1px solid ${sp.cardBorder}`,
              boxShadow: sp.shadow,
              color: sp.err,
              fontSize: 13.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <SgIcon name="alert" size={18} stroke={sp.err} sw={2} />
            <div style={{ flex: 1, minWidth: 200 }}>
              {t('list.errorTitle')}
              <div style={{ fontSize: 12, fontWeight: 500, color: sp.muted, marginTop: 4 }}>
                {(error as Error)?.message || t('list.errorFallback')}
              </div>
            </div>
            <KycGhostPill
              onClick={() => refetch()}
              icon={<SgIcon name="refresh" size={13} stroke={sp.inkSoft} />}
            >
              {t('list.retry')}
            </KycGhostPill>
          </div>
        )}
        {isLoading && (
          <div
            style={{
              padding: '60px 32px',
              textAlign: 'center',
              background: sp.card,
              borderRadius: 22,
              border: `1px solid ${sp.cardBorder}`,
              boxShadow: sp.shadow,
              color: sp.muted,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {t('list.loading')}
          </div>
        )}
        {!isLoading &&
          filtered.map((d) => (
            <KycDossierRow key={d.id} dossier={d} onOpen={() => onOpen(d.id)} />
          ))}
        {!isLoading && filtered.length === 0 && (
          <div
            style={{
              padding: '60px 32px',
              textAlign: 'center',
              background: sp.card,
              borderRadius: 22,
              border: `1px solid ${sp.cardBorder}`,
              boxShadow: sp.shadow,
              color: sp.muted,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {t('list.emptyFilter')}
          </div>
        )}
      </div>

      {/* Compteur stale en bas si présent (cas spec stale — re-screener) */}
      {stats.stale > 0 && (
        <div
          style={{
            marginTop: 18,
            padding: '14px 20px',
            background: sp.warnSoft,
            borderRadius: 14,
            color: sp.warn,
            fontSize: 12.5,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <SgIcon name="alert" size={14} stroke={sp.warn} sw={2} />
          {t('list.staleCount', { count: stats.stale })}
        </div>
      )}
    </div>
  )
}
