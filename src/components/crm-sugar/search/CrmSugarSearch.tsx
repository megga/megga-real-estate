// MEGGA CRM Sugar — Recherche immersive (overlay plein écran ⌘/Ctrl+K).
// Port fidèle 1:1 du handoff Claude Design « Barre de recherche immersive Megga »
// (crm-search-immersive.jsx, état « après »). Le seul écart est le retrait du
// vocal (demande explicite ; le proto avait déjà retiré le déclencheur micro).
//
// Câblage prod : window.CRM_CONTACTS/BIENS/DEALS → hooks Supabase réels ;
// window.CRMIcon → SVG inline ; police Manrope (CRM) au lieu d'Inter Tight.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, CRM_STAGES, type SugarPalette,
} from '@/components/crm-sugar/tokens'
import { useContacts } from '@/hooks/useContacts'
import { useBiensSugar } from '@/hooks/useBiensSugar'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { crmBienById, crmContactById } from '@/components/crm-sugar/mockData'
import { formatCHF } from '@/lib/utils'

// ─── Données utilitaires (proto) ─────────────────────────────────────────────
const RECENTS: { q: string }[] = [
  { q: 'Marie Bertrand' },
  { q: '3.5 pièces Rive droite' },
  { q: 'acheteurs Cologny > 3M' },
  { q: 'biens en attente de signature' },
]

const SCOPES = [
  { id: 'all', label: 'Tout' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'biens', label: 'Biens' },
  { id: 'deals', label: 'Deals' },
  { id: 'docs', label: 'Documents' },
] as const
type ScopeId = (typeof SCOPES)[number]['id']

const AI_PROMPTS = [
  'Acheteurs prêts à signer cette semaine',
  'Biens stagnants depuis +30 jours',
  'Rédiger un mandat exclusif',
]

// ─── Historique sémantique des conversations Megga (mock — proto) ────────────
interface MeggaConvo {
  id: string
  title: string
  snippet: string
  time: string
  timeRaw: number
  pinned: boolean
  entities: { type: string; label: string }[]
  messages: number
}

const MEGGA_HISTORY: MeggaConvo[] = [
  { id: 'j-001', title: 'Stratégie pour signer Bertrand sur le 6P Cologny', snippet: 'On peut argumenter sur la rareté des 6P avec vue lac < 9M. Trois comparables en 18 mois.', time: 'il y a 2 h', timeRaw: 2 * 3600, pinned: true, entities: [{ type: 'contact', label: 'M. Bertrand' }, { type: 'bien', label: 'Villa Cologny' }], messages: 14 },
  { id: 'j-002', title: 'Acheteurs sérieux pour le 4P Champel', snippet: 'Filtré sur capacité > 3.5M et délai < 60j : 4 candidats, dont Loreau (déjà visité 2x).', time: 'il y a 5 h', timeRaw: 5 * 3600, pinned: false, entities: [{ type: 'bien', label: '4P Champel' }], messages: 9 },
  { id: 'j-003', title: 'Analyse marché Carouge T1 2026', snippet: 'Prix médian +3.8% YoY. Stock en baisse de 12%. Opportunité côté Acacias.', time: 'hier', timeRaw: 28 * 3600, pinned: false, entities: [{ type: 'zone', label: 'Carouge' }], messages: 22 },
  { id: 'j-004', title: 'Relance pipeline — deals stagnants', snippet: '5 deals dormants > 30j. Prio 1 : Müller (offre verbale jamais formalisée).', time: 'hier', timeRaw: 30 * 3600, pinned: false, entities: [{ type: 'deal', label: '5 deals' }], messages: 7 },
  { id: 'j-005', title: 'Rédaction mandat exclusif Catherine Loreau', snippet: "Brouillon prêt. Clause d'exclusivité 6 mois, commission 3.5%, hors démarchage personnel.", time: 'il y a 2 j', timeRaw: 2 * 86400, pinned: true, entities: [{ type: 'contact', label: 'C. Loreau' }], messages: 11 },
  { id: 'j-006', title: 'Comparables vendus Vandœuvres 2025', snippet: "8 transactions cette année. Médiane CHF 14'500/m². Pic à 18'200/m² pour les vues panoramiques.", time: 'il y a 3 j', timeRaw: 3 * 86400, pinned: false, entities: [{ type: 'zone', label: 'Vandœuvres' }], messages: 16 },
  { id: 'j-007', title: 'Préparation visite Müller — argumentaire', snippet: 'Points forts : rénovation 2023, taxe foncière basse. Points sensibles : nuisance route à anticiper.', time: 'il y a 4 j', timeRaw: 4 * 86400, pinned: false, entities: [{ type: 'contact', label: 'Müller' }, { type: 'bien', label: '3P Plainpalais' }], messages: 6 },
  { id: 'j-008', title: 'Évaluation duplex Eaux-Vives', snippet: 'Estimation entre 4.2M et 4.6M selon état finitions. Recommande visite expert avant publication.', time: 'il y a 5 j', timeRaw: 5 * 86400, pinned: false, entities: [{ type: 'bien', label: 'Duplex Eaux-Vives' }], messages: 12 },
  { id: 'j-009', title: 'Profil financier acheteurs Cologny > 5M', snippet: '12 contacts qualifiés. 4 avec accord bancaire pré-validé. Top 3 : Schmid, Rey, Vianney.', time: 'la semaine dernière', timeRaw: 7 * 86400, pinned: false, entities: [{ type: 'zone', label: 'Cologny' }], messages: 19 },
  { id: 'j-010', title: 'Synthèse rendez-vous notaire — affaire Dubois', snippet: 'Acte signé 15 mai. Conditions suspensives levées. Commission encaissée le 22.', time: 'il y a 12 j', timeRaw: 12 * 86400, pinned: false, entities: [{ type: 'contact', label: 'Dubois' }], messages: 8 },
]

function searchMegga(q: string): MeggaConvo[] {
  if (!q.trim()) return []
  const ql = q.toLowerCase()
  return MEGGA_HISTORY.filter(h => {
    const hay = `${h.title} ${h.snippet} ${h.entities.map(e => e.label).join(' ')}`.toLowerCase()
    return hay.includes(ql)
  }).slice(0, 4)
}

// ─── Icônes inline (stroke linéaire — remplacent window.CRMIcon) ─────────────
function IconSpark({ size = 15, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />
    </svg>
  )
}
function IconArrowR({ size = 14, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
function IconSearch({ size = 22, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
    </svg>
  )
}
function IconPipeline({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 10h8M8 14h5" />
    </svg>
  )
}

// ─── Highlight de la correspondance ──────────────────────────────────────────
function Hi({ text, q, sp }: { text: string; q: string; sp: SugarPalette }) {
  if (!q || !text) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: 'transparent', color: sp.ink, fontWeight: 700, padding: 0 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  )
}

// ─── Vignette placeholder pour un bien (proto) ───────────────────────────────
function BienThumb({ id }: { id: string }) {
  const hue = ((id.charCodeAt(2) || 0) * 7) % 360
  return (
    <div
      style={{
        width: 56, height: 56, borderRadius: 12, flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue} 30% 78%), hsl(${(hue + 40) % 360} 25% 65%))`,
        position: 'relative', overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
      }}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
        <path d="M10 32 L28 16 L46 32 L46 46 L10 46 Z" fill="white" />
        <rect x="22" y="36" width="12" height="10" fill={`hsl(${hue} 30% 50%)`} />
      </svg>
    </div>
  )
}

function activeRowStyle(active: boolean, dark: boolean): CSSProperties {
  return active
    ? { background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(11,12,14,0.04)' }
    : { background: 'transparent' }
}

const ROW_BASE: CSSProperties = {
  width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
  border: 0, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
  fontFamily: 'inherit', transition: 'background .14s ease',
}

// ─── Section title (avec accent + badge sémantique) ──────────────────────────
function Section({ title, count, children, sp, accent, badge }: {
  title: string; count?: number; children: ReactNode; sp: SugarPalette; accent?: string; badge?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px 6px', color: accent || sp.sub,
          fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase',
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{title}</span>
        {typeof count === 'number' && (
          <span
            style={{
              background: accent ? accent + '18' : sp.cardSubBg, color: accent || sp.sub,
              padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        )}
        {badge && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
              padding: '1px 7px', borderRadius: 999,
              background: 'linear-gradient(135deg, rgba(0,65,217,0.10) 0%, rgba(139,92,246,0.10) 100%)',
              border: '1px solid rgba(139,92,246,0.18)',
              fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              color: accent || sp.sub,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
            </svg>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Ligne de conversation Megga ─────────────────────────────────────────────
function MeggaConvoRow({ convo, q, sp, dark, active, onHover, onSelect }: {
  convo: MeggaConvo; q: string; sp: SugarPalette; dark: boolean; active: boolean; onHover: () => void; onSelect: () => void
}) {
  const meta = convo.entities.map(e => e.label).join('  ·  ')
  return (
    <button onMouseEnter={onHover} onClick={onSelect} style={{ ...ROW_BASE, padding: '12px 14px', gap: 14, color: sp.ink, ...activeRowStyle(active, dark) }}>
      <div style={{ width: 16, flexShrink: 0, display: 'grid', placeItems: 'center', position: 'relative' }}>
        <IconSpark stroke={active ? sp.ink : sp.sub} />
        {convo.pinned && (
          <span style={{ position: 'absolute', top: -1, right: 0, width: 5, height: 5, borderRadius: 999, background: sp.ink }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: sp.ink, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Hi text={convo.title} q={q} sp={sp} />
        </div>
        {meta && (
          <div style={{ fontSize: 12, color: sp.sub, marginTop: 2, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: sp.sub, fontWeight: 500, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{convo.time}</span>
    </button>
  )
}

// ─── Item plat pour la navigation clavier ─────────────────────────────────────
type FlatItem =
  | { kind: 'megga-convo' }
  | { kind: 'recent'; q: string }
  | { kind: 'ai' }
  | { kind: 'ai-query' }
  | { kind: 'contact'; id: string }
  | { kind: 'bien'; id: string }
  | { kind: 'deal'; id: string }

interface Props {
  open: boolean
  onClose: () => void
}

export default function CrmSugarSearch({ open, onClose }: Props) {
  const navigate = useNavigate()

  // Thème : même source que les pages Sugar (localStorage), lu à l'ouverture.
  const dark = useMemo<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }, [])
  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, 'meggaAi')
  const accentBlue = dark ? '#A5C0FF' : '#0041D9'

  const [q, setQ] = useState('')
  const [scope, setScope] = useState<ScopeId>('all')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce de la requête pour la recherche contacts (server-side).
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q), 200)
    return () => window.clearTimeout(id)
  }, [q])

  // ── Données réelles ──
  const { contacts } = useContacts(debouncedQ.trim().length >= 2 ? { search: debouncedQ.trim() } : undefined)
  const { biens } = useBiensSugar()
  const { deals } = usePipelineSugar()

  const ql = q.trim().toLowerCase()

  const contactResults = useMemo(() => {
    if (ql.length < 2 || (scope !== 'all' && scope !== 'contacts')) return []
    return contacts.slice(0, scope === 'contacts' ? 20 : 4)
  }, [contacts, ql, scope])

  const bienResults = useMemo(() => {
    if (!ql || (scope !== 'all' && scope !== 'biens')) return []
    const list = biens.filter(b => `${b.title} ${b.ref} ${b.addr} ${b.canton} ${b.type}`.toLowerCase().includes(ql))
    return list.slice(0, scope === 'biens' ? 20 : 4)
  }, [biens, ql, scope])

  const dealResults = useMemo(() => {
    if (!ql || (scope !== 'all' && scope !== 'deals')) return []
    const withLabel = deals.map(d => {
      const bien = d.bienId ? crmBienById(d.bienId) : undefined
      const contact = crmContactById(d.contactId)
      const title = bien?.title || (contact ? `${contact.firstName} ${contact.lastName}` : 'Transaction')
      const stageLabel = CRM_STAGES[d.stage]?.label ?? d.stage
      return { id: d.id, title, stageLabel }
    })
    const list = withLabel.filter(d => `${d.title} ${d.stageLabel}`.toLowerCase().includes(ql))
    return list.slice(0, scope === 'deals' ? 20 : 3)
  }, [deals, ql, scope])

  const meggaResults = useMemo(() => searchMegga(q), [q])
  const meggaRecent = useMemo(
    () => [...MEGGA_HISTORY].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.timeRaw - b.timeRaw)).slice(0, 4),
    [],
  )

  const showEmpty = !q.trim()
  const totalResults = meggaResults.length + contactResults.length + bienResults.length + dealResults.length

  // ── Liste plate (ordre = sections affichées) ──
  const flatItems = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = []
    if (showEmpty) {
      meggaRecent.forEach(() => out.push({ kind: 'megga-convo' }))
      RECENTS.forEach(r => out.push({ kind: 'recent', q: r.q }))
      AI_PROMPTS.forEach(() => out.push({ kind: 'ai' }))
    } else {
      meggaResults.forEach(() => out.push({ kind: 'megga-convo' }))
      contactResults.forEach(c => out.push({ kind: 'contact', id: c.id }))
      bienResults.forEach(b => out.push({ kind: 'bien', id: b.id }))
      dealResults.forEach(d => out.push({ kind: 'deal', id: d.id }))
      out.push({ kind: 'ai-query' })
    }
    return out
  }, [showEmpty, meggaRecent, meggaResults, contactResults, bienResults, dealResults])

  const goJulien = useCallback(() => {
    onClose()
    navigate('/dashboard/julien')
  }, [navigate, onClose])

  const runItem = useCallback((item: FlatItem | undefined) => {
    if (!item) return
    switch (item.kind) {
      case 'recent': setQ(item.q); setActiveIdx(0); break
      case 'megga-convo':
      case 'ai':
      case 'ai-query': goJulien(); break
      case 'contact': onClose(); navigate(`/dashboard/contacts/${item.id}`); break
      case 'bien': onClose(); navigate(`/dashboard/listings/${item.id}`); break
      case 'deal': onClose(); navigate(`/dashboard/transactions/${item.id}`); break
    }
  }, [goJulien, navigate, onClose])

  // Focus auto à l'ouverture.
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [])

  // Raccourcis clavier (⌘K géré par le host).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'Tab') {
        e.preventDefault()
        const i = SCOPES.findIndex(s => s.id === scope)
        const len = SCOPES.length
        setScope(SCOPES[(i + (e.shiftKey ? len - 1 : 1)) % len].id); setActiveIdx(0)
      } else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(flatItems.length - 1, i + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)) }
      else if (e.key === 'Enter') { e.preventDefault(); runItem(flatItems[activeIdx]) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, scope, flatItems, activeIdx, onClose, runItem])

  useEffect(() => {
    if (activeIdx >= flatItems.length) setActiveIdx(Math.max(0, flatItems.length - 1))
  }, [flatItems.length, activeIdx])

  if (!open) return null

  // Couleurs adaptées light / dark (§7 — neutralisé, zéro bleu sur la chrome).
  const overlayColor = dark ? 'rgba(11,12,14,0.55)' : 'rgba(238,240,242,0.55)'
  const panelBg = dark ? 'rgba(24,25,28,0.80)' : 'rgba(255,255,255,0.78)'
  const panelBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)'
  const panelShadow = dark
    ? '0 30px 80px -20px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset'
    : '0 30px 80px -20px rgba(30,32,38,0.30), 0 1px 0 rgba(255,255,255,0.6) inset'

  const offEmptyConvos = 0
  const offEmptyRecents = meggaRecent.length
  const offEmptyPrompts = meggaRecent.length + RECENTS.length
  const offContacts = meggaResults.length
  const offBiens = meggaResults.length + contactResults.length
  const offDeals = meggaResults.length + contactResults.length + bienResults.length

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: overlayColor,
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        display: 'grid', placeItems: 'start center', paddingTop: '11vh',
        fontFamily: '"Manrope", system-ui, sans-serif',
      }}
    >
      <style>{`
        @keyframes sugarSearchIn {
          from { transform: translateY(-12px) scale(.97); opacity: 0; }
          to   { transform: translateY(0)     scale(1);   opacity: 1; }
        }
        @keyframes sugarSearchHaloPulse {
          0%, 100% { opacity: .35; transform: scale(1); }
          50%      { opacity: .55; transform: scale(1.03); }
        }
        .sugarSearchField::placeholder { color: var(--ph-color); opacity: 1; }
      `}</style>

      {/* Halo neutre (zéro bleu) */}
      <div
        style={{
          position: 'absolute', top: '8vh', width: 720, height: 360,
          background: dark
            ? 'radial-gradient(closest-side, rgba(255,255,255,0.05), transparent 70%)'
            : 'radial-gradient(closest-side, rgba(255,255,255,0.55), transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
          animation: 'sugarSearchHaloPulse 4s ease-in-out infinite',
        }}
      />

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxWidth: '92vw', maxHeight: '78vh',
          background: panelBg,
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: `1px solid ${panelBorder}`,
          borderRadius: 24,
          boxShadow: panelShadow,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'sugarSearchIn 280ms cubic-bezier(.2,.9,.25,1.1)',
        }}
      >
        {/* Champ épuré — aucune icône */}
        <div style={{ padding: '26px 28px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            ref={inputRef}
            className="sugarSearchField"
            value={q}
            onChange={e => { setQ(e.target.value); setActiveIdx(0) }}
            placeholder="Rechercher ou demander à Megga…"
            autoFocus
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none',
              color: sp.ink, fontSize: 23, fontWeight: 500,
              fontFamily: 'inherit', letterSpacing: -0.5, caretColor: sp.ink,
              ['--ph-color' as string]: sp.sub,
            }}
          />
          {q && (
            <button
              onClick={() => { setQ(''); setActiveIdx(0); inputRef.current?.focus() }}
              onMouseEnter={e => (e.currentTarget.style.color = sp.ink)}
              onMouseLeave={e => (e.currentTarget.style.color = sp.sub)}
              title="Effacer la recherche"
              style={{
                flexShrink: 0, border: 0, background: 'transparent', cursor: 'pointer',
                color: sp.sub, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                letterSpacing: -0.1, padding: '4px 2px', transition: 'color .15s ease',
              }}
            >
              Effacer
            </button>
          )}
        </div>

        {/* Pills de portée — sans hint clavier */}
        <div style={{ padding: '0 28px 16px', display: 'flex', gap: 6, alignItems: 'center', borderBottom: `1px solid ${sp.cardBorder}` }}>
          {SCOPES.map(s => {
            const isActive = scope === s.id
            return (
              <button
                key={s.id}
                onClick={() => { setScope(s.id); setActiveIdx(0) }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = sp.cardSubBg }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                style={{
                  padding: '7px 16px', borderRadius: 999, border: 0, cursor: 'pointer',
                  background: isActive ? sp.ink : 'transparent',
                  color: isActive ? sp.pageBg : sp.sub,
                  fontSize: 13, fontWeight: isActive ? 700 : 600,
                  fontFamily: 'inherit', letterSpacing: -0.1,
                  transition: 'background .15s ease, color .15s ease',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 6px', scrollbarWidth: 'thin' }}>
          {/* ── État vide ── */}
          {showEmpty && (
            <>
              <Section title="Reprendre avec Megga" count={meggaRecent.length} sp={sp}>
                {meggaRecent.map((j, i) => (
                  <MeggaConvoRow
                    key={j.id} convo={j} q={q} sp={sp} dark={dark}
                    active={activeIdx === offEmptyConvos + i}
                    onHover={() => setActiveIdx(offEmptyConvos + i)}
                    onSelect={goJulien}
                  />
                ))}
              </Section>

              <Section title="Récents" sp={sp}>
                {RECENTS.map((r, i) => {
                  const idx = offEmptyRecents + i
                  const isActive = activeIdx === idx
                  return (
                    <button key={r.q} onClick={() => { setQ(r.q); setActiveIdx(0) }} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                      <div style={{ width: 16, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sp.sub} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, fontSize: 13.5, color: sp.ink, fontWeight: 500 }}>{r.q}</div>
                    </button>
                  )
                })}
              </Section>

              <Section title="Demander à Megga" sp={sp}>
                {AI_PROMPTS.map((p, i) => {
                  const idx = offEmptyPrompts + i
                  const isActive = activeIdx === idx
                  return (
                    <button key={p} onClick={goJulien} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                      <div style={{ width: 16, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                        <IconSpark stroke={isActive ? sp.ink : sp.sub} />
                      </div>
                      <div style={{ flex: 1, fontSize: 13.5, color: sp.ink, fontWeight: 500 }}>{p}</div>
                    </button>
                  )
                })}
              </Section>
            </>
          )}

          {/* ── Aucun résultat ── */}
          {!showEmpty && totalResults === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: sp.sub }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`, display: 'grid', placeItems: 'center' }}>
                <IconSearch stroke={sp.sub} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: sp.ink }}>Aucun résultat pour « {q} »</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Demandez plutôt à Megga — il connaît tout votre CRM.</div>
              <button
                onClick={goJulien}
                style={{
                  marginTop: 18, padding: '9px 18px', borderRadius: 999, border: 0,
                  background: 'linear-gradient(135deg, #0041D9 0%, #8B5CF6 100%)', color: '#fff',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 20px -8px rgba(60,80,200,0.5)',
                }}
              >
                <IconSpark size={14} stroke="#fff" />
                Demander à Megga : « {q} »
              </button>
            </div>
          )}

          {/* ── Conversations Megga (sémantique) ── */}
          {!showEmpty && meggaResults.length > 0 && (
            <Section title="Conversations Megga" count={meggaResults.length} sp={sp} accent={accentBlue} badge="sémantique">
              {meggaResults.map((j, i) => (
                <MeggaConvoRow
                  key={j.id} convo={j} q={q} sp={sp} dark={dark}
                  active={activeIdx === offEmptyConvos + i}
                  onHover={() => setActiveIdx(offEmptyConvos + i)}
                  onSelect={goJulien}
                />
              ))}
            </Section>
          )}

          {/* ── Contacts ── */}
          {!showEmpty && contactResults.length > 0 && (
            <Section title="Contacts" count={contactResults.length} sp={sp}>
              {contactResults.map((c, i) => {
                const idx = offContacts + i
                const isActive = activeIdx === idx
                const score = c.ai_seriousness_score
                const initials = `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase()
                return (
                  <button key={c.id} onClick={() => { onClose(); navigate(`/dashboard/contacts/${c.id}`) }} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                    <div style={{ width: 38, height: 38, borderRadius: 999, flexShrink: 0, background: '#0041D9', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: sp.ink, lineHeight: 1.2 }}>
                        <Hi text={`${c.first_name} ${c.last_name}`} q={q} sp={sp} />
                      </div>
                    </div>
                    {typeof score === 'number' && (
                      <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700, color: score >= 80 ? '#0E9F6E' : score >= 60 ? '#0041D9' : sp.sub, padding: '3px 8px', borderRadius: 999, background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}` }}>
                        {score}
                      </div>
                    )}
                    <IconArrowR stroke={isActive ? accentBlue : sp.sub} />
                  </button>
                )
              })}
            </Section>
          )}

          {/* ── Biens ── */}
          {!showEmpty && bienResults.length > 0 && (
            <Section title="Biens" count={bienResults.length} sp={sp}>
              {bienResults.map((b, i) => {
                const idx = offBiens + i
                const isActive = activeIdx === idx
                const price = b.transaction === 'location' ? b.rent ?? b.price : b.price
                return (
                  <button key={b.id} onClick={() => { onClose(); navigate(`/dashboard/listings/${b.id}`) }} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                    <BienThumb id={b.id} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: sp.ink, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Hi text={b.title} q={q} sp={sp} />
                      </div>
                      <div style={{ fontSize: 12, color: sp.sub, marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{b.addr || b.canton || '—'}</span>
                        {b.rooms ? <><span style={{ width: 3, height: 3, borderRadius: 999, background: sp.sub, opacity: 0.5 }} /><span>{b.rooms} p.</span></> : null}
                        {b.area ? <span>· {b.area} m²</span> : null}
                      </div>
                    </div>
                    {price ? (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCHF(price)}{b.transaction === 'location' ? '/mois' : ''}
                        </div>
                        <div style={{ fontSize: 10.5, color: sp.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{b.transaction}</div>
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </Section>
          )}

          {/* ── Deals ── */}
          {!showEmpty && dealResults.length > 0 && (
            <Section title="Deals" count={dealResults.length} sp={sp}>
              {dealResults.map((d, i) => {
                const idx = offDeals + i
                const isActive = activeIdx === idx
                return (
                  <button key={d.id} onClick={() => { onClose(); navigate(`/dashboard/transactions/${d.id}`) }} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`, display: 'grid', placeItems: 'center' }}>
                      <IconPipeline stroke={sp.ink} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: sp.ink }}>
                        <Hi text={d.title} q={q} sp={sp} />
                      </div>
                      <div style={{ fontSize: 12, color: sp.sub, marginTop: 2 }}>{d.stageLabel}</div>
                    </div>
                    <IconArrowR stroke={isActive ? accentBlue : sp.sub} />
                  </button>
                )
              })}
            </Section>
          )}

          {/* ── CTA « Demander à Megga » (toujours présent dès qu'on tape) ── */}
          {!showEmpty && (
            <div style={{ padding: '6px 14px 12px' }}>
              <button
                onClick={goJulien}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
                  background: dark
                    ? 'linear-gradient(135deg, rgba(0,65,217,0.25) 0%, rgba(139,92,246,0.25) 100%)'
                    : 'linear-gradient(135deg, rgba(0,65,217,0.08) 0%, rgba(139,92,246,0.08) 100%)',
                  border: `1px solid ${dark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.18)'}`,
                  display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #0041D9 0%, #8B5CF6 100%)', display: 'grid', placeItems: 'center' }}>
                  <IconSpark size={14} stroke="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink }}>Demander à Megga : « {q} »</div>
                </div>
                <IconArrowR stroke={sp.sub} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
