// MEGGA CRM Sugar v2 — Matching IA (Tier 3 part 2.3)
// 1:1 port from the Claude Design bundle (`crm-screen-matching-sugar.jsx`).

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import { CRM_MATCHES } from '@/components/crm-sugar/mockData'
import {
  SugarTopNav, SugarIconRail, SugarFrame, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { SugarKpiTile } from '@/components/crm-sugar/pipeline/PipelineFilters'
import { MBuyerCard, type ScheduledVisit } from '@/components/crm-sugar/matching/MBuyerCard'
import { MTopOppRow } from '@/components/crm-sugar/matching/MTopOppRow'
import {
  MMatchingDrawer, type MatchingAction,
} from '@/components/crm-sugar/matching/MMatchingDrawer'
import {
  MSendDossierModal, type SendChannel,
} from '@/components/crm-sugar/matching/MSendDossierModal'
import {
  MScheduleVisitModal, type ScheduleConfirmPayload,
} from '@/components/crm-sugar/matching/MScheduleVisitModal'
import {
  buildMatchGroups, getBuyerType, getCities, type MatchGroup,
} from '@/components/crm-sugar/matching/helpers'

const DARK_TONE: DarkTone = 'meggaAi'

export default function MatchingSugarV2Page() {
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)
  const groups = useMemo(() => buildMatchGroups(), [])

  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [relancing, setRelancing] = useState(false)
  const [lastSync, setLastSync] = useState('il y a 2h')
  const [sendingFor, setSendingFor] = useState<MatchGroup | null>(null)
  const [sentMatchIds, setSentMatchIds] = useState<Set<string>>(new Set())
  const [schedulingFor, setSchedulingFor] = useState<MatchGroup | null>(null)
  const [scheduledVisits, setScheduledVisits] = useState<ScheduledVisit[]>([])

  const handleScheduled = ({
    buyer, bien, day, slot, duration, notes,
  }: ScheduleConfirmPayload) => {
    setScheduledVisits(prev => [
      ...prev,
      { buyerId: buyer.id, bienId: bien.id, dayIso: day.iso, slot, duration, notes },
    ])
    setSchedulingFor(null)
    setOpenId(null)
    const dayLabel = `${day.label} ${day.day} ${day.month}`
    setToast(`Visite planifiée — ${dayLabel} à ${slot} · ${bien.title}`)
    setTimeout(() => setToast(null), 3500)
  }

  const handleSent = (matchIds: string[], channel: SendChannel) => {
    setSentMatchIds(prev => {
      const next = new Set(prev)
      matchIds.forEach(id => next.add(id))
      return next
    })
    setSendingFor(null)
    setOpenId(null)
    const channelLabel =
      channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'email'
    setToast(
      `Dossier envoyé par ${channelLabel} — ${matchIds.length} bien${
        matchIds.length > 1 ? 's' : ''
      }`,
    )
    setTimeout(() => setToast(null), 3000)
  }

  const handleRelance = () => {
    if (relancing) return
    setRelancing(true)
    setToast(null)
    setTimeout(() => {
      setRelancing(false)
      setLastSync("à l'instant")
      setToast('Matching relancé — 7 matchs mis à jour')
      setTimeout(() => setToast(null), 3000)
    }, 2400)
  }

  const openGroup = openId ? groups.find(g => g.buyer.id === openId) : null

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(
      g =>
        `${g.buyer.firstName} ${g.buyer.lastName}`.toLowerCase().includes(q) ||
        getBuyerType(g.buyer).toLowerCase().includes(q) ||
        getCities(g.buyer).toLowerCase().includes(q),
    )
  }, [groups, search])

  const handleAction = (action: MatchingAction, group: MatchGroup) => {
    if (action === 'send') setSendingFor(group)
    if (action === 'schedule') setSchedulingFor(group)
  }

  const total = CRM_MATCHES.length
  const toSend = CRM_MATCHES.filter(m => m.status === 'to-send').length
  const hot = CRM_MATCHES.filter(m => m.score >= 90).length
  const engaged = CRM_MATCHES.filter(m => ['viewed', 'liked'].includes(m.status)).length

  const topOpps = [...CRM_MATCHES].sort((a, b) => b.score - a.score).slice(0, 5)

  const onCmd = () => {
    /* placeholder */
  }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':
        navigate('/dashboard'); break
      case 'pipeline':
        navigate('/dashboard/pipeline'); break
      case 'matching':
        break
      case 'contacts':
        navigate('/dashboard/contacts'); break
      case 'biens':
        navigate('/dashboard/listings'); break
      case 'biens-new':
        navigate('/dashboard/listings/new'); break
      case 'calendar':
        navigate('/dashboard/calendar'); break
      case 'docs':
        navigate('/dashboard/documents'); break
      case 'kyc':
        navigate('/dashboard/kyc'); break
      case 'reseau':
        navigate('/dashboard/reseau'); break
      case 'auto':
        navigate('/dashboard/automation'); break
      case 'chat':
        navigate('/dashboard/messages'); break
      case 'dashboard':
        navigate('/dashboard/analytics'); break
      case 'settings':
        navigate('/dashboard/settings'); break
      default:
    }
  }

  return (
    <div
      style={{
        background: sp.pageBg,
        minHeight: '100vh',
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        @keyframes sugar-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <SugarTopNav
        active="matching"
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex' }}>
        <SugarIconRail
          active="matching"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />
        <main
          style={{ flex: 1, padding: '32px 40px 80px 0', minWidth: 0 }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 38,
                fontWeight: 800,
                letterSpacing: -1.2,
                color: sp.ink,
                lineHeight: 1,
              }}
            >
              Matching
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: sp.sub,
                  fontWeight: 500,
                }}
              >
                Croisement automatique acheteurs × biens
              </span>
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleRelance}
              disabled={relancing}
              style={{
                height: 44,
                padding: '0 22px',
                borderRadius: 999,
                border: 0,
                background: relancing ? sp.sub : sp.ink,
                color: sp.pageBg,
                fontWeight: 700,
                fontSize: 14,
                fontFamily: 'inherit',
                cursor: relancing ? 'not-allowed' : 'pointer',
                boxShadow: relancing ? 'none' : sp.focusShadow,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: relancing ? 0.7 : 1,
                transition: 'opacity .2s, background .2s',
              }}
            >
              {relancing ? (
                <svg
                  width={13}
                  height={13}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={sp.pageBg}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  style={{ animation: 'sugar-spin 800ms linear infinite' }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width={13} height={13} viewBox="0 0 24 24" fill={sp.pageBg}>
                  <path d="m12 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
                </svg>
              )}
              {relancing ? 'Analyse en cours…' : 'Relancer le matching'}
            </button>
          </div>

          {/* KPIs */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
            <SugarKpiTile
              sp={sp}
              dark={dark}
              label="Matchs actifs"
              value={total}
              sub={`${groups.length} acheteurs couverts`}
            />
            <SugarKpiTile
              sp={sp}
              dark={dark}
              label="À envoyer"
              value={toSend}
              sub="Actions prioritaires"
              accent="#0041D9"
            />
            <SugarKpiTile
              sp={sp}
              dark={dark}
              label="Score ≥ 90%"
              value={hot}
              sub="Excellent fit"
              accent="#0041D9"
            />
            <SugarKpiTile
              sp={sp}
              dark={dark}
              label="Vus / Aimés"
              value={engaged}
              sub="Engagement acheteur"
              accent="#0041D9"
            />
          </div>

          {/* Layout 2 colonnes */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.6fr 1fr',
              gap: 18,
              alignItems: 'flex-start',
            }}
          >
            <SugarFrame
              sp={sp}
              index={0}
              title="Acheteurs à activer"
              badge={
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: sp.sub,
                    background: sp.cardSubBg,
                    padding: '3px 9px',
                    borderRadius: 99,
                    border: `1px solid ${sp.cardBorder}`,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {groups.length}
                </span>
              }
            >
              {/* Search live */}
              <div style={{ marginBottom: 14, position: 'relative' }}>
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={sp.sub}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un acheteur…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    height: 36,
                    paddingLeft: 34,
                    paddingRight: 12,
                    borderRadius: 10,
                    border: `1px solid ${sp.cardBorder}`,
                    background: sp.cardSubBg,
                    color: sp.ink,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                }}
              >
                {filteredGroups.length > 0 ? (
                  filteredGroups.map(g => (
                    <MBuyerCard
                      key={g.buyer.id}
                      group={g}
                      sp={sp}
                      dark={dark}
                      sentMatchIds={sentMatchIds}
                      scheduledVisits={scheduledVisits}
                      onClick={() => setOpenId(g.buyer.id)}
                    />
                  ))
                ) : (
                  <div
                    style={{
                      gridColumn: '1/-1',
                      padding: 32,
                      textAlign: 'center',
                      color: sp.sub,
                      fontSize: 13,
                      fontStyle: 'italic',
                    }}
                  >
                    Aucun acheteur trouvé
                  </div>
                )}
              </div>
            </SugarFrame>

            <SugarFrame
              sp={sp}
              index={1}
              title="Top opportunités"
              actions={
                <span
                  style={{
                    fontSize: 11.5,
                    color: sp.sub,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Mise à jour {lastSync}
                </span>
              }
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {topOpps.map((m, i) => (
                  <MTopOppRow
                    key={i}
                    match={m}
                    sp={sp}
                    dark={dark}
                    onClick={() => setOpenId(m.contactId)}
                  />
                ))}
              </div>

              {/* AI footer note */}
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: `1px solid ${sp.cardBorder}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    background: 'linear-gradient(135deg, #0041D9, #6366F1)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="#fff">
                    <path d="m12 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#0041D9',
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                      marginBottom: 3,
                    }}
                  >
                    MEGGA AI
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: sp.soft,
                      lineHeight: 1.55,
                    }}
                  >
                    {hot} match{hot > 1 ? 's' : ''} excellent
                    {hot > 1 ? 's' : ''} en attente. Marie Bertrand n'a pas
                    encore reçu son dossier — relance prioritaire.
                  </div>
                </div>
              </div>
            </SugarFrame>
          </div>
        </main>
      </div>

      {openGroup && (
        <MMatchingDrawer
          group={openGroup}
          sp={sp}
          dark={dark}
          sentMatchIds={sentMatchIds}
          scheduledVisits={scheduledVisits}
          onClose={() => setOpenId(null)}
          onAction={handleAction}
        />
      )}

      {sendingFor && (
        <MSendDossierModal
          group={sendingFor}
          sp={sp}
          dark={dark}
          onClose={() => setSendingFor(null)}
          onSend={handleSent}
        />
      )}

      {schedulingFor && (
        <MScheduleVisitModal
          group={schedulingFor}
          sp={sp}
          dark={dark}
          onClose={() => setSchedulingFor(null)}
          onConfirm={handleScheduled}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: dark ? sp.frameBg : '#0E1410',
            color: dark ? sp.ink : '#fff',
            padding: '12px 22px',
            borderRadius: 16,
            fontSize: 13.5,
            fontWeight: 600,
            boxShadow: '0 8px 32px rgba(0,0,0,.28)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 300,
            border: `1px solid ${sp.cardBorder}`,
            backdropFilter: 'blur(16px)',
          }}
        >
          <span style={{ color: '#0E9F6E', fontSize: 16 }}>✓</span> {toast}
        </div>
      )}
    </div>
  )
}
