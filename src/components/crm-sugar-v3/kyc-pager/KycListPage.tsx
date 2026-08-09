// MEGGA CRM — KYC Pager · Page 0 « Dossiers KYC »
// Port fidèle de `KypListPage` (kyc-pager-proto.jsx), branché sur la donnée
// LIVE `useKycDossiers()` (0 mock). Table filtrable + tri none→pending→verified,
// risque élevé remonté. Ligne cliquable → ouvre la fiche.

import { useMemo, useState } from 'react'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { useKycDossiers, type KycDossierRow } from '@/hooks/useKycDossier'
import type { KycDossierStatus } from '@/types/kyc'
import { KYP_FONT, type KypSurf } from './kypTokens'
import { KypAvatar, KypCta, KypStatusPill } from './kypAtoms'

type FilterKey = 'all' | 'none' | 'pending' | 'verified'

/** Libellé « Dernier événement » dérivé honnêtement des champs dossier. */
function lastEventLabel(d: KycDossierRow): string {
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  switch (d.dossier_status) {
    case 'verified':
      return `Vérifié le ${fmt(d.validated_at)}`
    case 'failed':
      return 'Correspondance à examiner'
    case 'stale':
      return `À re-screener${d.expires_at ? ` — échéance ${fmt(d.expires_at)}` : ''}`
    case 'pending':
      return d.last_screening_at ? `Screené le ${fmt(d.last_screening_at)}` : 'Vérifications en cours'
    case 'none':
    default:
      return 'Aucune démarche engagée'
  }
}

/** Ordre de tri : à démarrer d'abord, vérifiés en dernier ; risque élevé remonté. */
const STATUS_RANK: Record<KycDossierStatus, number> = {
  none: 0,
  failed: 1,
  stale: 1,
  pending: 1,
  verified: 2,
}

interface Props {
  sp: SugarPalette
  surf: KypSurf
  onNewDossier: () => void
  onOpen: (dossierId: string) => void
}

export function KycListPage({ sp, surf, onNewDossier, onOpen }: Props) {
  const { data, isLoading, isError } = useKycDossiers()
  const [f, setF] = useState<FilterKey>('all')

  const dossiers = useMemo(() => (data ?? []).filter((d) => d.contact), [data])

  const counts = useMemo(
    () => ({
      all: dossiers.length,
      none: dossiers.filter((d) => d.dossier_status === 'none').length,
      pending: dossiers.filter((d) => ['pending', 'failed', 'stale'].includes(d.dossier_status)).length,
      verified: dossiers.filter((d) => d.dossier_status === 'verified').length,
    }),
    [dossiers],
  )

  const tabs: { id: FilterKey; label: string; n: number }[] = [
    { id: 'all', label: 'Tous', n: counts.all },
    { id: 'none', label: 'À démarrer', n: counts.none },
    { id: 'pending', label: 'En cours', n: counts.pending },
    { id: 'verified', label: 'Vérifiés', n: counts.verified },
  ]

  const rows = useMemo(() => {
    const match = (d: KycDossierRow) => {
      if (f === 'all') return true
      if (f === 'pending') return ['pending', 'failed', 'stale'].includes(d.dossier_status)
      return d.dossier_status === f
    }
    return dossiers
      .filter(match)
      .slice()
      .sort(
        (a, b) =>
          (STATUS_RANK[a.dossier_status] ?? 1) - (STATUS_RANK[b.dossier_status] ?? 1) ||
          (a.risk_level === 'high' ? -1 : 1),
      )
  }, [dossiers, f])

  const cols = '1.6fr 1fr 1.5fr 1fr 34px'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '28px 56px 26px 36px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--crm-space-4xl)',
        overflow: 'hidden',
        background: sp.pageBg,
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--crm-space-3xl)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-7xl)', fontWeight: 800, letterSpacing: -1, color: sp.ink, lineHeight: 1 }}>KYC</h1>
        <div style={{ flex: 1 }} />
        <KypCta sp={sp} h={40} onClick={onNewDossier}>
          Nouveau dossier
        </KypCta>
      </div>

      {/* Onglets-filtres */}
      <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
        {tabs.map((tb) => {
          const on = tb.id === f
          return (
            <button
              key={tb.id}
              onClick={() => setF(tb.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--crm-space-sm)',
                height: 36,
                padding: '0 var(--crm-space-2xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: on ? sp.focusBg : surf.card,
                color: on ? sp.focusInk : sp.soft,
                fontFamily: KYP_FONT,
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: on ? 'none' : sp.shadowSm,
              }}
            >
              {tb.label}
              <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{tb.n}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: surf.card,
          borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: sp.shadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: cols,
            gap: 'var(--crm-space-xl)',
            padding: 'var(--crm-space-xl) var(--crm-space-6xl)',
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: sp.sub,
            borderBottom: `1px solid ${surf.hairline}`,
          }}
        >
          <div>Contact</div>
          <div>Statut</div>
          <div>Dernier événement</div>
          <div>Échéance</div>
          <div />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {isLoading && (
            <div style={{ padding: '40px 22px', fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500 }}>Chargement des dossiers…</div>
          )}
          {isError && !isLoading && (
            <div style={{ padding: '40px 22px', fontSize: 'var(--crm-text-lg)', color: surf.destructive, fontWeight: 600 }}>
              Impossible de charger les dossiers KYC.
            </div>
          )}
          {!isLoading && !isError && rows.length === 0 && (
            <div style={{ padding: '40px 22px', fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500 }}>
              Aucun dossier dans cette vue.
            </div>
          )}
          {rows.map((d, i) => (
            <div
              key={d.id}
              onClick={() => onOpen(d.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: cols,
                gap: 'var(--crm-space-xl)',
                alignItems: 'center',
                padding: 'var(--crm-space-lg) var(--crm-space-6xl)',
                borderBottom: i < rows.length - 1 ? `1px solid ${surf.hairline}` : '0',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', minWidth: 0 }}>
                <KypAvatar firstName={d.contact!.first_name} lastName={d.contact!.last_name} size={34} ring={surf.card} />
                <div
                  style={{
                    fontSize: 'var(--crm-text-xl)',
                    fontWeight: 700,
                    color: sp.ink,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.contact!.first_name} {d.contact!.last_name}
                </div>
              </div>
              <div>
                <KypStatusPill status={d.dossier_status} />
              </div>
              <div
                style={{
                  fontSize: 'var(--crm-text-md)',
                  color: sp.soft,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {lastEventLabel(d)}
              </div>
              <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {d.expires_at
                  ? new Date(d.expires_at).toLocaleDateString('fr-CH', { month: 'short', year: 'numeric' })
                  : '—'}
              </div>
              <div style={{ color: surf.ghost, fontSize: 'var(--crm-text-3xl)', textAlign: 'center' }}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
