// MEGGA CRM Sugar v3 — Vue liste KYC (par défaut)
// Port du handoff Claude Design juin 2026 (crm-screen-kyc-sugar.jsx §KycListView).
//
// Politique KYC NON-BLOQUANTE (CLAUDE.md, handoff §1 — PRIORITÉ conformité) :
//  - chapô = rappel doux, jamais « bloque le pipeline »
//  - PAS d'onglet « Bloquants pipeline » ni de filtre `blocking`
//  - thème dynamique clair ↔ sombre (useKycPalette)

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
            Dossiers KYC.
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
            Toute transaction immobilière en Suisse exige une vérification documentée
            de l'identité, du domicile et de l'origine des fonds. Le KYC reste
            recommandé avant la signature — un rappel doux, jamais bloquant.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <KycGhostPill
            icon={<SgIcon name="download" size={14} stroke={sp.inkSoft} />}
          >
            Exporter
          </KycGhostPill>
          <KycBlackPill
            size="lg"
            onClick={onNewDossier}
            icon={<SgIcon name="plus" size={16} stroke={sp.onAccent} sw={2} />}
          >
            Nouveau dossier
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
        <KycStatCard label="Vérifiés" value={stats.verified} sub="Transactions autorisées" />
        <KycStatCard
          label="En cours"
          value={stats.pending}
          sub="Pièces manquantes ou screening en attente"
        />
        <KycStatCard label="À démarrer" value={stats.none} sub="Aucun document collecté" />
        <KycStatCard
          label="Vigilance"
          value={stats.risk}
          sub="Risque modéré ou élevé identifié"
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
          Tous · {dossiers.length}
        </KycGhostPill>
        <KycGhostPill active={filter === 'pending'} onClick={() => setFilter('pending')}>
          En cours · {stats.pending}
        </KycGhostPill>
        <KycGhostPill active={filter === 'none'} onClick={() => setFilter('none')}>
          À démarrer · {stats.none}
        </KycGhostPill>
        <KycGhostPill active={filter === 'verified'} onClick={() => setFilter('verified')}>
          Vérifiés · {stats.verified}
        </KycGhostPill>
        <KycGhostPill active={filter === 'risk'} onClick={() => setFilter('risk')}>
          Risque élevé · {stats.high}
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
              Impossible de charger les dossiers KYC.
              <div style={{ fontSize: 12, fontWeight: 500, color: sp.muted, marginTop: 4 }}>
                {(error as Error)?.message || 'Erreur réseau ou base de données.'}
              </div>
            </div>
            <KycGhostPill
              onClick={() => refetch()}
              icon={<SgIcon name="refresh" size={13} stroke={sp.inkSoft} />}
            >
              Réessayer
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
            Chargement des dossiers…
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
            Aucun dossier ne correspond à ce filtre.
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
          {stats.stale} dossier{stats.stale > 1 ? 's' : ''} à re-screener (échéance dépassée).
        </div>
      )}
    </div>
  )
}
