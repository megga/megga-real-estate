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
import { useTranslation } from 'react-i18next'
import { crmSugarPalette, CRM_STAGES, sgVoileEncre, type SugarPalette } from '@/components/crm-sugar/tokens'
import { useContacts } from '@/hooks/useContacts'
import { useBiensSugar } from '@/hooks/useBiensSugar'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { crmBienById, crmContactById } from '@/components/crm-sugar/mockData'
import { formatCHF } from '@/lib/utils'
import { useConversationHistory } from '@/hooks/useConversationHistory'
import { filterConversationsByTitle, type ConversationSummary } from '@/lib/conversation-history'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'

// ─── Données utilitaires (proto) ─────────────────────────────────────────────
const SCOPES = [
  { id: 'all', labelKey: 'search.command.scope.all' },
  { id: 'contacts', labelKey: 'search.command.scope.contacts' },
  { id: 'biens', labelKey: 'search.command.scope.biens' },
  { id: 'deals', labelKey: 'search.command.scope.deals' },
  { id: 'docs', labelKey: 'search.command.scope.docs' },
] as const
type ScopeId = (typeof SCOPES)[number]['id']

// Clés i18n (common:search.command.aiPrompts.*) — résolues à l'affichage via tr().
const AI_PROMPTS = ['buyersReady', 'staleListings', 'exclusiveMandate'] as const

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
      <mark style={{ background: 'transparent', color: sp.ink, fontWeight: 600, padding: 0 }}>
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
        width: 56, height: 56, borderRadius: 'var(--crm-radius-lg)', flexShrink: 0,
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
    ? { background: sgVoileEncre(dark, dark ? 0.06 : 0.04) }
    : { background: 'transparent' }
}

const ROW_BASE: CSSProperties = {
  width: '100%', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
  border: 0, borderRadius: 'var(--crm-radius-xl)', cursor: 'pointer', textAlign: 'left',
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
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
          padding: 'var(--crm-space-lg) var(--crm-space-2xl) var(--crm-space-sm)', color: accent || sp.sub,
          fontSize: 'var(--crm-text-sm)', fontWeight: 500,
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{title}</span>
        {typeof count === 'number' && (
          <span
            style={{
              background: accent ? accent + '18' : sp.cardSubBg, color: accent || sp.sub,
              padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', fontSize: 'var(--crm-text-xs)', fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        )}
        {badge && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', marginLeft: 'auto',
              padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
              background: 'linear-gradient(135deg, rgba(0,65,217,0.10) 0%, rgba(139,92,246,0.10) 100%)',
              border: '1px solid rgba(139,92,246,0.18)',
              fontSize: 'var(--crm-text-xs)', fontWeight: 500,
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

// ─── Temps relatif localisé (il y a 2 h / 2 hours ago) ───────────────────────
function relTime(iso: string, lang: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  const rtf = new Intl.RelativeTimeFormat(lang || 'fr', { numeric: 'auto' })
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute')
  const h = Math.round(min / 60)
  if (Math.abs(h) < 24) return rtf.format(-h, 'hour')
  return rtf.format(-Math.round(h / 24), 'day')
}

// ─── Ligne de conversation copilote (titre + temps relatif) ──────────────────
function MeggaConvoRow({ convo, q, sp, dark, lang, active, onHover, onSelect }: {
  convo: ConversationSummary; q: string; sp: SugarPalette; dark: boolean; lang: string
  active: boolean; onHover: () => void; onSelect: () => void
}) {
  return (
    <button onMouseEnter={onHover} onClick={onSelect} style={{ ...ROW_BASE, padding: 'var(--crm-space-xl) var(--crm-space-2xl)', gap: 'var(--crm-space-2xl)', color: sp.ink, ...activeRowStyle(active, dark) }}>
      <div style={{ width: 16, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <IconSpark stroke={active ? sp.ink : sp.sub} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Hi text={convo.title} q={q} sp={sp} />
        </div>
      </div>
      <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontWeight: 500, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {relTime(convo.lastMessageAt, lang)}
      </span>
    </button>
  )
}

// ─── Item plat pour la navigation clavier ─────────────────────────────────────
type FlatItem =
  | { kind: 'megga-convo'; id: string }
  | { kind: 'ai' }
  | { kind: 'ai-query' }
  | { kind: 'contact'; id: string }
  | { kind: 'bien'; id: string }
  | { kind: 'deal'; id: string }
  | { kind: 'admin' }

// Raccourci super-admin : la console n'apparaît QUE sur une requête explicite
// (et QUE pour un super-admin confirmé par la DB). Aucune trace le reste du
// temps — la recherche reste le port 1:1 du handoff pour tout le monde.
const ADMIN_KEYWORDS = ['admin', 'console', 'plateforme', 'platform']

interface Props {
  open: boolean
  onClose: () => void
}

export default function CrmSugarSearch({ open, onClose }: Props) {
  const navigate = useNavigate()
  // Collision : la variable `t` ci-dessous = tokens de thème. Le traducteur = `tr`.
  const { t: tr, i18n } = useTranslation('common')

  // Thème : même source que les pages Sugar (localStorage), lu à l'ouverture.
  const dark = useMemo<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }, [])
  const sp = crmSugarPalette(dark)
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
  // Conversations copilote persistées (chantier B). Vide tant que le writer n'est
  // pas activé (flag OFF) → les sections ci-dessous ne s'affichent simplement pas.
  const { data: conversations } = useConversationHistory(30)
  const convList = useMemo(() => conversations ?? [], [conversations])
  const { allowed: isSuperAdmin } = useSuperAdminGate()

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
      const title = bien?.title || (contact ? `${contact.firstName} ${contact.lastName}` : tr('search.command.deal.untitled'))
      const stageLabel = CRM_STAGES[d.stage]?.label ?? d.stage
      return { id: d.id, title, stageLabel }
    })
    const list = withLabel.filter(d => `${d.title} ${d.stageLabel}`.toLowerCase().includes(ql))
    return list.slice(0, scope === 'deals' ? 20 : 3)
  }, [deals, ql, scope, tr])

  // État vide = conversations récentes (à reprendre) ; sur requête = filtre titre.
  const meggaRecent = useMemo(() => convList.slice(0, 5), [convList])
  const meggaResults = useMemo(() => filterConversationsByTitle(convList, q, 5), [convList, q])

  const showEmpty = !q.trim()
  const showAdmin = isSuperAdmin && ql.length >= 2 && ADMIN_KEYWORDS.some(k => k.startsWith(ql))
  const adminCount = showAdmin ? 1 : 0
  const totalResults = adminCount + meggaResults.length + contactResults.length + bienResults.length + dealResults.length

  // ── Liste plate (ordre = sections affichées) ──
  const flatItems = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = []
    if (showEmpty) {
      meggaRecent.forEach(c => out.push({ kind: 'megga-convo', id: c.id }))
      AI_PROMPTS.forEach(() => out.push({ kind: 'ai' }))
    } else {
      if (showAdmin) out.push({ kind: 'admin' })
      meggaResults.forEach(c => out.push({ kind: 'megga-convo', id: c.id }))
      contactResults.forEach(c => out.push({ kind: 'contact', id: c.id }))
      bienResults.forEach(b => out.push({ kind: 'bien', id: b.id }))
      dealResults.forEach(d => out.push({ kind: 'deal', id: d.id }))
      out.push({ kind: 'ai-query' })
    }
    return out
  }, [showEmpty, showAdmin, meggaRecent, meggaResults, contactResults, bienResults, dealResults])

  const goJulien = useCallback(() => {
    onClose()
    navigate('/dashboard/julien')
  }, [navigate, onClose])

  // Reprendre une conversation copilote : ouvre la page Julien avec son id.
  const resumeConversation = useCallback((id: string) => {
    onClose()
    navigate(`/dashboard/julien?c=${id}`)
  }, [navigate, onClose])

  const runItem = useCallback((item: FlatItem | undefined) => {
    if (!item) return
    switch (item.kind) {
      case 'megga-convo': resumeConversation(item.id); break
      case 'ai':
      case 'ai-query': goJulien(); break
      case 'contact': onClose(); navigate(`/dashboard/contacts/${item.id}`); break
      case 'bien': onClose(); navigate(`/dashboard/listings/${item.id}`); break
      case 'deal': onClose(); navigate(`/dashboard/transactions/${item.id}`); break
      case 'admin': onClose(); navigate(ADMIN_CONSOLE_PATH); break
    }
  }, [goJulien, resumeConversation, navigate, onClose])

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
  // Voile de fond : en SOMBRE c'est le canvas MEGGA X voilé, en CLAIR un gris
  // pâle assumé — ce n'est pas une encre, donc pas `sgVoileEncre`.
  const overlayColor = dark ? `rgba(3,3,3,0.55)` : 'rgba(238,240,242,0.55)'
  const panelBg = dark ? 'rgba(24,25,28,0.80)' : 'rgba(255,255,255,0.78)'
  const panelBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)'
  const panelShadow = dark
    ? '0 30px 80px -20px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset'
    : '0 30px 80px -20px rgba(30,32,38,0.30), 0 1px 0 rgba(255,255,255,0.6) inset'

  // Offsets de la liste plate (ordre des sections rendues).
  const offEmptyConvos = 0
  const offEmptyPrompts = meggaRecent.length
  const offAdmin = 0
  const offConvos = adminCount
  const offContacts = adminCount + meggaResults.length
  const offBiens = adminCount + meggaResults.length + contactResults.length
  const offDeals = adminCount + meggaResults.length + contactResults.length + bienResults.length

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
          borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: panelShadow,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'sugarSearchIn 280ms cubic-bezier(.2,.9,.25,1.1)',
        }}
      >
        {/* Champ épuré — aucune icône */}
        <div style={{ padding: '26px 28px 18px', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)' }}>
          <input
            ref={inputRef}
            className="sugarSearchField"
            value={q}
            onChange={e => { setQ(e.target.value); setActiveIdx(0) }}
            placeholder={tr('search.command.placeholder')}
            autoFocus
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none',
              color: sp.ink, fontSize: 'var(--crm-text-5xl)', fontWeight: 500,
              fontFamily: 'inherit', letterSpacing: -0.5, caretColor: sp.ink,
              ['--ph-color' as string]: sp.sub,
            }}
          />
          {q && (
            <button
              onClick={() => { setQ(''); setActiveIdx(0); inputRef.current?.focus() }}
              onMouseEnter={e => (e.currentTarget.style.color = sp.ink)}
              onMouseLeave={e => (e.currentTarget.style.color = sp.sub)}
              title={tr('search.clearSearch')}
              style={{
                flexShrink: 0, border: 0, background: 'transparent', cursor: 'pointer',
                color: sp.sub, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600,
                letterSpacing: -0.1, padding: 'var(--crm-space-xs) var(--crm-space-2xs)', transition: 'color .15s ease',
              }}
            >
              {tr('search.command.clear')}
            </button>
          )}
        </div>

        {/* Pills de portée — sans hint clavier */}
        <div style={{ padding: '0 28px 16px', display: 'flex', gap: 'var(--crm-space-sm)', alignItems: 'center', borderBottom: `1px solid ${sp.cardBorder}` }}>
          {SCOPES.map(s => {
            const isActive = scope === s.id
            return (
              <button
                key={s.id}
                onClick={() => { setScope(s.id); setActiveIdx(0) }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = sp.cardSubBg }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                style={{
                  padding: 'var(--crm-space-sm) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
                  background: isActive ? sp.accent : 'transparent',
                  color: isActive ? sp.accentInk : sp.sub,
                  fontSize: 'var(--crm-text-lg)', fontWeight: isActive ? 600 : 500,
                  fontFamily: 'inherit', letterSpacing: -0.1,
                  transition: 'background .15s ease, color .15s ease',
                }}
              >
                {tr(s.labelKey)}
              </button>
            )
          })}
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--crm-space-lg) var(--crm-space-xl) var(--crm-space-sm)', scrollbarWidth: 'thin' }}>
          {/* ── État vide ── */}
          {showEmpty && (
            <>
              {meggaRecent.length > 0 && (
                <Section title={tr('search.command.section.resumeMegga')} count={meggaRecent.length} sp={sp}>
                  {meggaRecent.map((c, i) => (
                    <MeggaConvoRow
                      key={c.id} convo={c} q="" sp={sp} dark={dark} lang={i18n.language}
                      active={activeIdx === offEmptyConvos + i}
                      onHover={() => setActiveIdx(offEmptyConvos + i)}
                      onSelect={() => resumeConversation(c.id)}
                    />
                  ))}
                </Section>
              )}

              <Section title={tr('search.command.section.askMegga')} sp={sp}>
                {AI_PROMPTS.map((p, i) => {
                  const idx = offEmptyPrompts + i
                  const isActive = activeIdx === idx
                  return (
                    <button key={p} onClick={goJulien} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                      <div style={{ width: 16, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                        <IconSpark stroke={isActive ? sp.ink : sp.sub} />
                      </div>
                      <div style={{ flex: 1, fontSize: 'var(--crm-text-lg)', color: sp.ink, fontWeight: 500 }}>{tr(`search.command.aiPrompts.${p}`)}</div>
                    </button>
                  )
                })}
              </Section>
            </>
          )}

          {/* ── Aucun résultat ── */}
          {!showEmpty && totalResults === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: sp.sub }}>
              <div style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-2xl)', margin: '0 auto 14px', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`, display: 'grid', placeItems: 'center' }}>
                <IconSearch stroke={sp.sub} />
              </div>
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>{tr('search.command.empty.title', { query: q })}</div>
              <div style={{ fontSize: 'var(--crm-text-lg)', marginTop: 6 }}>{tr('search.command.empty.body')}</div>
              <button
                onClick={goJulien}
                style={{
                  marginTop: 18, padding: 'var(--crm-space-md) var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                  background: 'linear-gradient(135deg, #0041D9 0%, #8B5CF6 100%)', color: '#fff',
                  fontSize: 'var(--crm-text-lg)', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', boxShadow: '0 8px 20px -8px rgba(60,80,200,0.5)',
                }}
              >
                <IconSpark size={14} stroke="#fff" />
                {tr('search.command.askMeggaQuery', { query: q })}
              </button>
            </div>
          )}

          {/* ── Console admin (super-admin, sur requête explicite) ── */}
          {!showEmpty && showAdmin && (
            <Section title={tr('search.command.section.platform')} sp={sp}>
              <button
                onClick={() => { onClose(); navigate(ADMIN_CONSOLE_PATH) }}
                onMouseEnter={() => setActiveIdx(offAdmin)}
                style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(activeIdx === offAdmin, dark) }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-lg)', flexShrink: 0, background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`, display: 'grid', placeItems: 'center' }}>
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={sp.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" />
                    <path d="M7 7.5h.01M7 16.5h.01" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, lineHeight: 1.2 }}>
                    {tr('profile.adminConsole')}
                  </div>
                </div>
                <IconArrowR stroke={activeIdx === offAdmin ? accentBlue : sp.sub} />
              </button>
            </Section>
          )}

          {/* ── Conversations Megga (sur requête) ── */}
          {!showEmpty && meggaResults.length > 0 && (
            <Section title={tr('search.command.section.meggaConvos')} count={meggaResults.length} sp={sp}>
              {meggaResults.map((c, i) => (
                <MeggaConvoRow
                  key={c.id} convo={c} q={q} sp={sp} dark={dark} lang={i18n.language}
                  active={activeIdx === offConvos + i}
                  onHover={() => setActiveIdx(offConvos + i)}
                  onSelect={() => resumeConversation(c.id)}
                />
              ))}
            </Section>
          )}

          {/* ── Contacts ── */}
          {!showEmpty && contactResults.length > 0 && (
            <Section title={tr('nav.contacts')} count={contactResults.length} sp={sp}>
              {contactResults.map((c, i) => {
                const idx = offContacts + i
                const isActive = activeIdx === idx
                const score = c.ai_seriousness_score
                const initials = `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase()
                return (
                  <button key={c.id} onClick={() => { onClose(); navigate(`/dashboard/contacts/${c.id}`) }} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                    <div style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: '#0041D9', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, lineHeight: 1.2 }}>
                        <Hi text={`${c.first_name} ${c.last_name}`} q={q} sp={sp} />
                      </div>
                    </div>
                    {typeof score === 'number' && (
                      <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: score >= 80 ? '#0E9F6E' : score >= 60 ? '#0041D9' : sp.sub, padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}` }}>
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
            <Section title={tr('search.command.section.biens')} count={bienResults.length} sp={sp}>
              {bienResults.map((b, i) => {
                const idx = offBiens + i
                const isActive = activeIdx === idx
                const price = b.transaction === 'location' ? b.rent ?? b.price : b.price
                return (
                  <button key={b.id} onClick={() => { onClose(); navigate(`/dashboard/listings/${b.id}`) }} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                    <BienThumb id={b.id} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Hi text={b.title} q={q} sp={sp} />
                      </div>
                      <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, marginTop: 3, display: 'flex', gap: 'var(--crm-space-md)', alignItems: 'center' }}>
                        <span>{b.addr || b.canton || '—'}</span>
                        {b.rooms ? <><span style={{ width: 3, height: 3, borderRadius: 'var(--crm-radius-pill)', background: sp.sub, opacity: 0.5 }} /><span>{tr('search.command.roomsShort', { count: b.rooms })}</span></> : null}
                        {b.area ? <span>· {b.area} m²</span> : null}
                      </div>
                    </div>
                    {price ? (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCHF(price)}{b.transaction === 'location' ? tr('search.perMonth') : ''}
                        </div>
                        <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, fontWeight: 500 }}>{b.transaction}</div>
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </Section>
          )}

          {/* ── Deals ── */}
          {!showEmpty && dealResults.length > 0 && (
            <Section title={tr('search.command.section.deals')} count={dealResults.length} sp={sp}>
              {dealResults.map((d, i) => {
                const idx = offDeals + i
                const isActive = activeIdx === idx
                return (
                  <button key={d.id} onClick={() => { onClose(); navigate(`/dashboard/transactions/${d.id}`) }} onMouseEnter={() => setActiveIdx(idx)} style={{ ...ROW_BASE, color: sp.ink, ...activeRowStyle(isActive, dark) }}>
                    <div style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-md)', flexShrink: 0, background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`, display: 'grid', placeItems: 'center' }}>
                      <IconPipeline stroke={sp.ink} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>
                        <Hi text={d.title} q={q} sp={sp} />
                      </div>
                      <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, marginTop: 2 }}>{d.stageLabel}</div>
                    </div>
                    <IconArrowR stroke={isActive ? accentBlue : sp.sub} />
                  </button>
                )
              })}
            </Section>
          )}

          {/* ── CTA « Demander à Megga » (toujours présent dès qu'on tape) ── */}
          {!showEmpty && (
            <div style={{ padding: 'var(--crm-space-sm) var(--crm-space-2xl) var(--crm-space-xl)' }}>
              <button
                onClick={goJulien}
                style={{
                  width: '100%', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-xl)', cursor: 'pointer',
                  background: dark
                    ? 'linear-gradient(135deg, rgba(0,65,217,0.25) 0%, rgba(139,92,246,0.25) 100%)'
                    : 'linear-gradient(135deg, rgba(0,65,217,0.08) 0%, rgba(139,92,246,0.08) 100%)',
                  border: `1px solid ${dark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.18)'}`,
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 'var(--crm-radius-md)', flexShrink: 0, background: 'linear-gradient(135deg, #0041D9 0%, #8B5CF6 100%)', display: 'grid', placeItems: 'center' }}>
                  <IconSpark size={14} stroke="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{tr('search.command.askMeggaQuery', { query: q })}</div>
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
