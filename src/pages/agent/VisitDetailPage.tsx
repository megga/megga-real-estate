// MEGGA CRM — Fiche Visite (desktop)
// Port pixel-près de crm-screen-visite-sugar.jsx (handoff Sprint 2).
//
// Layout :
//   - Header (retour calendrier + ref + actions)
//   - Hero (titre + visiteur + adresse + date)
//   - Grid : panneau bon + rapport (gauche) | iPhone compagnon (droite)
//
// Sync Realtime : tout update push du mobile arrive ici via useVisitRealtime.
// Route : /dashboard/visits/:id

import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dossierPalette, DOSSIER_KEYFRAMES } from '@/components/crm-dossiers/tokens'
import { useCrmDark } from '@/lib/crmDark'
import { CrmIcon } from '@/components/crm-dossiers/icons'
import {
  CrmBlackPill,
  CrmGhostPill,
} from '@/components/crm-dossiers/primitives'
import {
  VdEyebrow,
  VdCard,
  VdBonPanel,
  VdRapportPanel,
} from '@/components/crm-dossiers/visite-detail/VdShared'
import {
  useVisitDetail,
  useVisitRealtime,
  useSignVisitBon,
} from '@/hooks/useVisitDetail'
import { supabase } from '@/lib/supabase'

function vdDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function VisitDetailPage() {
  const { t } = useTranslation('calendar')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: visit, isLoading, isError, error } = useVisitDetail(id)
  const { mutate: signBon } = useSignVisitBon()
  useVisitRealtime(id)
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: S.bgGradient,
          display: 'grid',
          placeItems: 'center',
          color: S.muted,
          fontFamily: S.font,
        }}
      >
        {t('visitDetail.loading')}
      </div>
    )
  }
  if (isError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: S.bgGradient,
          display: 'grid',
          placeItems: 'center',
          color: S.errDarker,
          fontFamily: S.font,
          padding: 40,
          textAlign: 'center',
        }}
      >
        {t('visitDetail.loadError', {
          message: error?.message ?? t('visitDetail.unknownError'),
        })}
      </div>
    )
  }
  if (!visit) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: S.bgGradient,
          display: 'grid',
          placeItems: 'center',
          color: S.muted,
          fontFamily: S.font,
        }}
      >
        {t('visitDetail.notFound')}
      </div>
    )
  }

  const isDone = visit.kind === 'done'

  return (
    <div
      data-screen-label="Fiche Visite (Sugar v3)"
      style={{
        width: '100%',
        minHeight: '100vh',
        background: S.bgGradient,
        color: S.ink,
        fontFamily: S.font,
      }}
    >
      <style>{DOSSIER_KEYFRAMES}</style>
      <style>{`
        @keyframes vdPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <main style={{ padding: '28px 40px 80px', minWidth: 0 }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 32,
            flexWrap: 'wrap',
          }}
        >
          <CrmGhostPill
            icon={<CrmIcon name="arrowL" size={15} stroke={S.inkSoft} />}
            onClick={() => navigate('/dashboard/calendar')}
          >
            {t('visitDetail.backToCalendar')}
          </CrmGhostPill>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'nowrap',
              fontSize: 'var(--crm-text-sm)',
              color: S.muted,
              letterSpacing: 0.3,
            }}
          >
            {visit.id.slice(0, 8).toUpperCase()}
          </span>
          <div style={{ flex: 1 }} />
          {/* "Modifier" icon button removed — no inline-edit page exists.
              Drag-drop on the calendar handles reschedule today. Inline
              edition is a separate chip. */}
          <CrmBlackPill
            icon={
              <CrmIcon
                name={isDone ? 'check' : 'pen'}
                size={14}
                stroke="#fff"
                sw={2}
              />
            }
            onClick={async () => {
              // Real lifecycle transition based on current status:
              //   planned   → confirmed   (agent confirms attendance)
              //   confirmed → done        (agent reports visit happened)
              //   done      → no action (display-only label)
              if (isDone) return
              const nextStatus = visit.status === 'confirmed' ? 'done' : 'confirmed'
              const { error: updErr } = await supabase
                .from('visits')
                .update({
                  status: nextStatus,
                  ...(nextStatus === 'done' ? { completed_at: new Date().toISOString() } : {}),
                })
                .eq('id', visit.id)
              if (updErr) {
                 
                window.alert(t('visitDetail.statusUpdateError', { message: updErr.message }))
              }
            }}
          >
            {isDone
              ? t('visitDetail.cta.visitDone')
              : visit.status === 'confirmed'
                ? t('visitDetail.cta.markDone')
                : t('visitDetail.cta.confirm')}
          </CrmBlackPill>
        </header>

        {/* Hero */}
        <VdCard padding={32} style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 24,
            }}
          >
            <div style={{ flex: 1, minWidth: 280 }}>
              <VdEyebrow>
                {t('visitDetail.eyebrow.prefix')} ·{' '}
                {isDone
                  ? t('visitDetail.eyebrow.done')
                  : t('visitDetail.eyebrow.planned')}
              </VdEyebrow>
              <h1
                style={{
                  margin: '12px 0 10px',
                  fontSize: 'var(--crm-text-8xl)',
                  fontWeight: 600,
                  color: S.ink,
                  letterSpacing: -0.8,
                  lineHeight: 1.15,
                }}
              >
                {visit.property?.title ?? t('visitDetail.propertyFallback')}
                <span style={{ color: S.muted, fontWeight: 500 }}>
                  {' '}
                  {t('visitDetail.withContact', {
                    name: visit.contact
                      ? `${visit.contact.first_name} ${visit.contact.last_name}`
                      : '—',
                  })}
                </span>
              </h1>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  color: S.muted,
                  fontSize: 'var(--crm-text-lg)',
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <CrmIcon name="cal" size={14} stroke={S.muted} />
                  {vdDateLong(visit.scheduled_at)}
                </span>
                <span>·</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <CrmIcon name="clock" size={14} stroke={S.muted} />
                  {new Date(visit.scheduled_at).toLocaleTimeString('fr-CH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({visit.duration_minutes} min)
                </span>
                {visit.property?.address && (
                  <>
                    <span>·</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                      }}
                    >
                      <CrmIcon name="pin" size={14} stroke={S.muted} />
                      {visit.property.address}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </VdCard>

        {/* Grid panels + mobile */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 360px',
            gap: 28,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              minWidth: 0,
            }}
          >
            <VdBonPanel
              visit={visit}
              onSign={() => {
                if (!visit.bon) return
                signBon({ visitId: visit.id, bon: visit.bon })
              }}
            />
            <VdRapportPanel visit={visit} />
          </div>
          {/* VdMobileCompanion preview removed — the component held mostly
              non-functional UI (sentiment cards, mic, photo, signature
              with no persistence). Real on-site visit capture is a
              separate sprint. */}
        </div>
      </main>
    </div>
  )
}
