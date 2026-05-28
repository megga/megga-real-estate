// MEGGA CRM Sugar v2 — Matching · Inbox split + édition inline + Supabase
// Cf. handoff-matching-refonte/HANDOFF_MATCHING_REFONTE_CLAUDE_CODE.md.
//
// Pattern mail-client : queue compacte 340 px à gauche + panneau focus
// persistant à droite (plus de drawer). Sous-nav segmentée à 5 onglets
// (Tous · À envoyer · Engagé · Sans retour · Archivés). Raccourci clavier E
// pour envoyer le dossier. Dark mode "Contacts-flat" : surfaces solides
// #1A1C22 / #14171E, plus de glass.
//
// SOURCE DE DONNÉES : Supabase via `useMatchingSugar` (adapter qui maps
// matches/contacts/kyc_cases → CrmContact/CrmMatch/CrmBien). En dev sans auth,
// le hook retourne `groups: []` (RLS agency-scoped) — la page affiche un état
// vide pédagogique.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogAudit } from '@/hooks/useAuditLog'
import { useMatchingSugar } from '@/hooks/useMatchingSugar'
import type { SearchCriteria } from '@/types/contact'
import { crmBienById } from '@/components/crm-sugar/mockData'
import {
  CRM_TOKENS,
  crmInitials,
  crmSugarPalette,
  type DarkTone,
  type SugarPalette,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import {
  MSendDossierModal,
  type SendChannel,
} from '@/components/crm-sugar/matching/MSendDossierModal'
import {
  MScheduleVisitModal,
  type ScheduleConfirmPayload,
} from '@/components/crm-sugar/matching/MScheduleVisitModal'
import {
  getBuyerType,
  getCities,
  matchKey,
  mColor,
  matchingDarkSp,
  tabOfGroup,
  type MatchGroup,
  type MatchingTab,
} from '@/components/crm-sugar/matching/helpers'
import { FocusPanel } from '@/components/crm-sugar/matching/MatchingFocusPanel'

const DARK_TONE: DarkTone = 'meggaAi'
const DRAFTS_LS_KEY = 'megga.matching.drafts.v1'
const LAST_SYNC_LS_KEY = 'megga.matching.lastSync.v1'

// ─── Sous-nav segmentée — pilule 5 onglets ───────────────────────────────
interface TabOption {
  id: MatchingTab
  label: string
  count: number
}

interface MTabsProps {
  value: MatchingTab
  onChange: (v: MatchingTab) => void
  options: TabOption[]
  sp: SugarPalette
}

function MTabs({ value, onChange, options, sp }: MTabsProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 999,
        background: sp.cardSubBg,
        boxShadow: `inset 0 0 0 1px ${sp.cardBorder}`,
      }}
    >
      {options.map(o => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 16px',
              borderRadius: 999,
              border: 0,
              background: active ? sp.ink : 'transparent',
              color: active ? sp.pageBg : sp.soft,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: active ? 700 : 600,
              cursor: 'pointer',
              letterSpacing: -0.1,
              boxShadow: active ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
              transition: 'all .18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
            {o.count != null && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '1.5px 7px',
                  borderRadius: 999,
                  lineHeight: 1.2,
                  background: active
                    ? 'rgba(255,255,255,0.18)'
                    : 'rgba(11,12,14,0.06)',
                  color: active ? sp.pageBg : sp.soft,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Mini-row gauche (1 acheteur par ligne, très compact) ────────────────
interface MMiniRowProps {
  group: MatchGroup
  active: boolean
  onClick: () => void
  sp: SugarPalette
}

function MMiniRow({ group, active, onClick, sp }: MMiniRowProps) {
  const { buyer, topScore } = group
  const col = mColor(topScore)
  const tab = tabOfGroup(group)
  const dotColor =
    tab === 'engaged' ? '#10B981' :
    tab === 'no-reply' ? '#F59E0B' :
    tab === 'archived' ? sp.sub : sp.ink
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        borderRadius: 14,
        background: active ? sp.cardBg : 'transparent',
        border: 0,
        fontFamily: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: active
          ? `0 0 0 2px ${sp.ink} inset, 0 4px 12px rgba(15,23,42,0.04)`
          : 'none',
        transition: 'all .15s ease',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = sp.cardSubBg
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: buyer.avatarBg || '#0041D9',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}
      >
        {crmInitials(`${buyer.firstName} ${buyer.lastName}`)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 13.5, fontWeight: 700, color: sp.ink,
              letterSpacing: -0.1, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
            }}
          >
            {buyer.firstName} {buyer.lastName}
          </span>
          <span
            style={{
              fontSize: 14, fontWeight: 800, color: col,
              fontVariantNumeric: 'tabular-nums', flexShrink: 0, letterSpacing: -0.4,
            }}
          >
            {topScore || '—'}
          </span>
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11.5, color: sp.sub, fontWeight: 500,
          }}
        >
          <span
            style={{ width: 5, height: 5, borderRadius: 999, flexShrink: 0, background: dotColor }}
          />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getBuyerType(buyer)}{getCities(buyer) ? ` · ${getCities(buyer)}` : ''}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Helpers commit critères : parse string draft → SearchCriteria patch ──
function parseCritPatch(key: string, value: string): Partial<SearchCriteria> | null {
  const v = value.trim()
  if (!v || v === '—') return null
  switch (key) {
    case 'budget': {
      const n = parseInt(v.replace(/\D/g, ''), 10)
      if (!Number.isFinite(n) || n <= 0) return null
      return { budget_max: n }
    }
    case 'types': {
      const first = v.split(',')[0].trim().toLowerCase()
      if (!first) return null
      return { type: first }
    }
    case 'rooms': {
      const n = parseInt(v.replace(/\D/g, ''), 10)
      if (!Number.isFinite(n) || n <= 0) return null
      return { rooms_min: n }
    }
    case 'surface': {
      const n = parseInt(v.replace(/\D/g, ''), 10)
      if (!Number.isFinite(n) || n <= 0) return null
      return { surface_min: n }
    }
    case 'quartiers': {
      const zones = v.split(',').map(s => s.trim()).filter(Boolean)
      if (zones.length === 0) return null
      return { zones }
    }
    default:
      return null
  }
}

// ─── Last-sync helper : relatif lisible ──────────────────────────────────
function formatRelativeSync(iso: string | null): string {
  if (!iso) return 'jamais'
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return `il y a ${d} j`
}

// ─── Écran principal — Matching Inbox split + critères inline ────────────
export default function MatchingSugarV2Page() {
  const navigate = useNavigate()
  const logAudit = useLogAudit()
  const { groups, isLoading, sendMatch, scheduleVisit, runMatching, isRunning, updateCriteria } =
    useMatchingSugar()

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
  const spBase = crmSugarPalette(t, dark, DARK_TONE)
  const sp = dark ? matchingDarkSp(spBase) : spBase

  // ── State ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<MatchingTab>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)

  // Drafts : Map<buyerId, Map<fieldKey, value>>, hydratés depuis localStorage
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem(DRAFTS_LS_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(DRAFTS_LS_KEY, JSON.stringify(drafts))
    } catch { /* quota plein, ignore */ }
  }, [drafts])

  // Modals + flux
  const [toast, setToast] = useState<string | null>(null)
  const [sendingFor, setSendingFor] = useState<MatchGroup | null>(null)
  const [schedulingFor, setSchedulingFor] = useState<MatchGroup | null>(null)
  // Local mirror : pastilles "Envoyé" / "Visite planifiée" optimistes pendant
  // que la mutation propage et que la query react-query revalide.
  const [sentMatchIds, setSentMatchIds] = useState<Set<string>>(() => new Set())
  const [scheduledVisits, setScheduledVisits] = useState<
    Array<{ buyerId: string; bienId: string; dayIso: string; slot: string; duration: number; notes: string }>
  >([])

  // Last sync : timestamp ISO en localStorage, formaté relatif
  const [lastSyncIso, setLastSyncIso] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(LAST_SYNC_LS_KEY)
  })
  const lastSync = formatRelativeSync(lastSyncIso)

  // ── Filtrage par onglet + recherche ──────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<MatchingTab, number> = {
      all: 0, 'to-send': 0, engaged: 0, 'no-reply': 0, archived: 0,
    }
    groups.forEach(g => {
      const tg = tabOfGroup(g)
      if (tg !== 'archived') c.all += 1
      c[tg] = (c[tg] || 0) + 1
    })
    return c
  }, [groups])

  const filteredGroups = useMemo(() => {
    let list = groups
    if (tab === 'all') list = list.filter(g => tabOfGroup(g) !== 'archived')
    else list = list.filter(g => tabOfGroup(g) === tab)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        g =>
          `${g.buyer.firstName} ${g.buyer.lastName}`.toLowerCase().includes(q) ||
          getBuyerType(g.buyer).toLowerCase().includes(q) ||
          getCities(g.buyer).toLowerCase().includes(q),
      )
    }
    return list
  }, [groups, tab, search])

  // Sélection : auto-sélectionne le premier visible quand la liste change
  useEffect(() => {
    if (filteredGroups.length === 0) return
    if (!selectedId || !filteredGroups.find(g => g.buyer.id === selectedId)) {
      setSelectedId(filteredGroups[0].buyer.id)
      setEditingField(null)
    }
  }, [filteredGroups, selectedId])

  const selected =
    filteredGroups.find(g => g.buyer.id === selectedId) || filteredGroups[0]

  // ── Helpers critères éditables ───────────────────────────────────────
  const bDraft = selected ? drafts[selected.buyer.id] || {} : {}
  const critVal = (key: string, fallback: string) =>
    bDraft[key] !== undefined ? bDraft[key] : fallback
  const setCrit = (key: string, v: string) => {
    if (!selected) return
    const prev = bDraft[key]
    setDrafts(d => ({
      ...d,
      [selected.buyer.id]: { ...(d[selected.buyer.id] || {}), [key]: v },
    }))
    if (prev === v) return
    // AuditEvent nLPD
    logAudit.mutate({
      category: 'contact',
      severity: 'info',
      action: 'Critère matching modifié',
      entityType: 'contact',
      entityId: selected.buyer.id,
      objectLabel: `${selected.buyer.firstName} ${selected.buyer.lastName}`,
      metadata: { field: key, from: prev ?? null, to: v },
    })
    // Persist Supabase si parseable
    const patch = parseCritPatch(key, v)
    if (patch) {
      updateCriteria(selected.buyer.id, patch).catch(err => {
        console.error('updateCriteria failed', err)
        setToast('Critère non sauvegardé — réessayez')
        setTimeout(() => setToast(null), 3000)
      })
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────
  const handleRelance = () => {
    if (isRunning) return
    setToast(null)
    runMatching()
    // AuditEvent
    logAudit.mutate({
      category: 'ai',
      severity: 'info',
      action: 'Relance matching IA',
      entityType: 'matching',
      entityId: null,
      objectLabel: null,
      metadata: { trigger: 'manual' },
    })
    const now = new Date().toISOString()
    setLastSyncIso(now)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_SYNC_LS_KEY, now)
    }
    setToast('Matching relancé — analyse en cours…')
    setTimeout(() => setToast(null), 3000)
  }

  const handleSent = (matchIds: string[], channel: SendChannel) => {
    const buyer = sendingFor?.buyer
    const group = sendingFor
    setSendingFor(null)

    // Pastilles optimistes en se basant sur matchKey (id || contactId-bienId)
    if (group) {
      const keys = new Set<string>()
      for (const id of matchIds) {
        const m = group.matches.find(mm => mm.id === id)
        if (m) keys.add(matchKey(m))
        else keys.add(id) // fallback : id direct si mock
      }
      setSentMatchIds(prev => {
        const next = new Set(prev)
        keys.forEach(k => next.add(k))
        return next
      })
    }

    // Marks the match as 'sent' in DB — but NO email/SMS is actually
    // dispatched from here (useSendMatchToClient was wired with a wrong
    // payload shape for send-property-email and never worked). Until the
    // real dispatcher lands (separate chip), the audit + toast are
    // explicit that it's a manual status flip, not a system send.
    const dbChannel = channel === 'sms' ? 'whatsapp' : channel
    for (const id of matchIds) {
      sendMatch(id, dbChannel as 'email' | 'whatsapp' | 'both')
    }

    const channelLabel =
      channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'email'
    setToast(
      `Marqué comme envoyé par ${channelLabel} — ${matchIds.length} bien${
        matchIds.length > 1 ? 's' : ''
      }. Pensez à envoyer le dossier réel via votre client mail/messagerie.`,
    )
    setTimeout(() => setToast(null), 4500)

    if (buyer) {
      logAudit.mutate({
        category: 'ai',
        severity: 'info',
        // Honest action name — see PR #438 for the same `-marked-` pattern.
        action: 'Dossier matching marqué envoyé',
        entityType: 'contact',
        entityId: buyer.id,
        objectLabel: `${buyer.firstName} ${buyer.lastName}`,
        metadata: { channel, matchIds, count: matchIds.length, system_dispatch: false },
      })
    }
  }

  const handleScheduled = ({
    buyer, bien, day, slot, duration, notes,
  }: ScheduleConfirmPayload) => {
    setScheduledVisits(prev => [
      ...prev,
      { buyerId: buyer.id, bienId: bien.id, dayIso: day.iso, slot, duration, notes },
    ])
    setSchedulingFor(null)
    const dayLabel = `${day.label} ${day.day} ${day.month}`
    const bienLabel = bien.title || `${bien.type} ${bien.canton || ''}`
    setToast(`Visite planifiée — ${dayLabel} à ${slot} · ${bienLabel}`)
    setTimeout(() => setToast(null), 3500)

    // Mutation Supabase : INSERT INTO visits
    // Compose scheduled_at depuis day.iso (YYYY-MM-DD) + slot (HH:MM)
    const scheduledAt = new Date(`${day.iso}T${slot}:00`).toISOString()
    scheduleVisit({
      contactId: buyer.id,
      propertyId: bien.id,
      scheduledAt,
      durationMin: duration,
      notes: notes.trim() || undefined,
    }).catch(err => {
      console.error('scheduleVisit failed', err)
      setToast('Visite non sauvegardée — réessayez')
      setTimeout(() => setToast(null), 3500)
    })

    logAudit.mutate({
      category: 'deal',
      severity: 'info',
      action: 'Visite planifiée',
      entityType: 'bien',
      entityId: bien.id,
      objectLabel: bienLabel,
      metadata: {
        contactId: buyer.id,
        contactName: `${buyer.firstName} ${buyer.lastName}`,
        scheduledAt, duration, hasNotes: notes.length > 0,
      },
    })
  }

  // ── Raccourci clavier E (envoyer) ────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'e' && selected && !sendingFor && !schedulingFor) {
        e.preventDefault()
        setSendingFor(selected)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, sendingFor, schedulingFor])

  // ── Navigation ───────────────────────────────────────────────────────
  const onCmd = () => { /* placeholder */ }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':     navigate('/dashboard'); break
      case 'pipeline':  navigate('/dashboard/pipeline'); break
      case 'matching':  break
      case 'contacts':  navigate('/dashboard/contacts'); break
      case 'biens':     navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar':  navigate('/dashboard/calendar'); break
      case 'docs':      navigate('/dashboard/documents'); break
      case 'kyc':       navigate('/dashboard/kyc'); break
      case 'reseau':    navigate('/dashboard/network'); break
      case 'ai':
      case 'julien':    navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings':  navigate('/dashboard/settings'); break
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
        @keyframes sugar-overlay-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sugar-bento-in {
          from { opacity: 0; transform: translateY(10px) scale(.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sugar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sugar-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <SugarTopNav active="matching" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex' }}>
        <SugarIconRail
          active="matching" onNavigate={onNavigate} onCmd={onCmd}
          dark={dark} setDark={setDark} sp={sp}
        />

        <main
          style={{
            flex: 1, padding: '28px 40px 32px 0', minWidth: 0,
            height: 'calc(100vh - 64px)',
            display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 18, flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  margin: 0, fontSize: 32, fontWeight: 700,
                  color: sp.ink, letterSpacing: -0.7, lineHeight: 1,
                }}
              >
                {isLoading
                  ? 'Chargement…'
                  : `${counts.all} acheteur${counts.all > 1 ? 's' : ''} à suivre`}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: sp.sub, fontWeight: 500 }}>
                Mis à jour {lastSync}
              </span>
              <button
                onClick={handleRelance}
                disabled={isRunning}
                style={{
                  height: 42, padding: '0 20px', borderRadius: 999, border: 0,
                  background: isRunning ? sp.sub : sp.ink,
                  color: sp.pageBg, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  boxShadow: isRunning ? 'none' : '0 6px 16px rgba(11,12,14,0.18)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: isRunning ? 0.7 : 1,
                  transition: 'opacity .2s, background .2s',
                }}
              >
                {isRunning ? (
                  <svg
                    width={13} height={13} viewBox="0 0 24 24" fill="none"
                    stroke={sp.pageBg} strokeWidth={2.5} strokeLinecap="round"
                    style={{ animation: 'sugar-spin 800ms linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width={13} height={13} viewBox="0 0 24 24" fill={sp.pageBg}>
                    <path d="m12 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
                  </svg>
                )}
                {isRunning ? 'Analyse en cours…' : 'Relancer le matching'}
              </button>
            </div>
          </div>

          {/* Sous-nav segmentée */}
          <div style={{ display: 'flex', marginBottom: 18, flexShrink: 0 }}>
            <MTabs
              value={tab}
              onChange={v => { setTab(v); setEditingField(null) }}
              sp={sp}
              options={[
                { id: 'all',      label: 'Tous',         count: counts.all },
                { id: 'to-send',  label: 'À envoyer',    count: counts['to-send'] },
                { id: 'engaged',  label: 'Engagé',       count: counts.engaged },
                { id: 'no-reply', label: 'Sans retour',  count: counts['no-reply'] },
                { id: 'archived', label: 'Archivés',     count: counts.archived },
              ]}
            />
          </div>

          {/* Layout 2 panneaux */}
          <div
            style={{
              flex: 1, display: 'grid',
              gridTemplateColumns: '340px 1fr',
              gap: 18, minHeight: 0,
            }}
          >
            {/* ── GAUCHE — Queue ── */}
            <div
              style={{
                background: sp.frameBg, borderRadius: 24,
                border: `1px solid ${sp.frameBorder}`,
                boxShadow: sp.shadow, padding: 12,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  height: 40, padding: '0 14px', borderRadius: 999,
                  background: sp.cardSubBg, marginBottom: 10, flexShrink: 0,
                }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                  stroke={sp.sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{
                    flex: 1, border: 0, background: 'transparent', outline: 'none',
                    fontFamily: 'inherit', fontSize: 13, color: sp.ink,
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1, overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                {isLoading ? (
                  <div style={{
                    padding: 32, textAlign: 'center', fontSize: 12.5,
                    color: sp.sub, fontStyle: 'italic',
                  }}>Chargement des acheteurs…</div>
                ) : filteredGroups.length > 0 ? (
                  filteredGroups.map(g => (
                    <MMiniRow
                      key={g.buyer.id}
                      group={g}
                      active={g.buyer.id === selectedId}
                      onClick={() => { setSelectedId(g.buyer.id); setEditingField(null) }}
                      sp={sp}
                    />
                  ))
                ) : (
                  <div style={{
                    padding: 32, textAlign: 'center', fontSize: 12.5,
                    color: sp.sub, fontStyle: 'italic',
                  }}>
                    {groups.length === 0
                      ? 'Aucun match — relancez le matching pour générer des suggestions.'
                      : 'Aucun acheteur dans cette catégorie.'}
                  </div>
                )}
              </div>
            </div>

            {/* ── DROITE — Focus ── */}
            {selected ? (
              <FocusPanel
                key={selected.buyer.id}
                group={selected}
                sp={sp}
                dark={dark}
                editingField={editingField}
                setEditingField={setEditingField}
                critVal={critVal}
                setCrit={setCrit}
                sentMatchIds={sentMatchIds}
                scheduledVisits={scheduledVisits}
                onSend={() => setSendingFor(selected)}
                onSchedule={() => setSchedulingFor(selected)}
                onStartKyc={buyer => {
                  logAudit.mutate({
                    category: 'kyc',
                    severity: 'info',
                    action: 'KYC démarré depuis Matching',
                    entityType: 'contact',
                    entityId: buyer.id,
                    objectLabel: `${buyer.firstName} ${buyer.lastName}`,
                    metadata: {
                      kycStatus: buyer.kyc?.status ?? 'none',
                      origin: 'matching-banner',
                    },
                  })
                  navigate('/dashboard/kyc')
                }}
                onOpenBien={bienId => {
                  const b = crmBienById(bienId)
                  logAudit.mutate({
                    category: 'bien',
                    severity: 'info',
                    action: 'Fiche bien ouverte depuis Matching',
                    entityType: 'bien',
                    entityId: bienId,
                    objectLabel: b?.title ?? null,
                    metadata: {
                      contactId: selected?.buyer.id ?? null,
                      origin: 'matching-focus',
                    },
                  })
                  navigate(`/dashboard/listings/${bienId}`)
                }}
              />
            ) : (
              <div
                style={{
                  background: sp.frameBg, borderRadius: 24,
                  border: `1px solid ${sp.frameBorder}`,
                  boxShadow: sp.shadow,
                  display: 'grid', placeItems: 'center',
                  color: sp.sub, fontSize: 13, fontStyle: 'italic',
                  textAlign: 'center', padding: 32,
                }}
              >
                {isLoading
                  ? 'Chargement…'
                  : groups.length === 0
                  ? 'Aucun match pour le moment. Cliquez « Relancer le matching » pour lancer l\'analyse IA sur vos acheteurs actifs.'
                  : 'Sélectionnez un acheteur à gauche pour voir ses biens.'}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
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

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: sp.ink, color: sp.pageBg,
            padding: '12px 22px', borderRadius: 16,
            fontSize: 13.5, fontWeight: 600,
            boxShadow: '0 8px 32px rgba(0,0,0,.28)',
            display: 'flex', alignItems: 'center', gap: 10, zIndex: 1500,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
