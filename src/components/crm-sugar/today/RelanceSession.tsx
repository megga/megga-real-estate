// MEGGA CRM — Relances IA · SESSION (port fidèle de `relance-session.jsx`)
// ----------------------------------------------------------------------------
// L'overlay s'ouvre depuis la tuile « Relances » (cockpit) ET l'icône téléphone
// du rail (« Relances du jour »). Un lead à la fois, l'IA propose un message À
// LA DEMANDE (canal email), et le geste central = COPIER (l'agent colle dans sa
// vraie boîte). « Ouvrir dans ma messagerie » (mailto) et « Envoyer depuis
// MEGGA » sont proposés en second. Fin → retour dashboard.
//
// Différence d'intégration (vigilance #4 du handoff : robustesse autorisée si le
// rendu reste indiscernable) : rendu via createPortal(document.body) en
// position:fixed plutôt que position:absolute — pour couvrir le viewport quel
// que soit le point de montage (cockpit relatif OU rail). Visuellement identique.

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { TK } from './tk'
import { RXIcon, Av } from './kit'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Json } from '@/types/database'
import { uuidOrNull } from './focusAudit'
import { useRelanceLeads } from '@/hooks/useRelanceLeads'

// La couleur reste un token de présentation ; le libellé de température est une
// clé i18n stable (code → clé), traduite au point d'usage.
const RS_TEMP: Record<string, { labelKey: string; color: string }> = {
  chaud: { labelKey: 'today.relance.temp.hot', color: '#E08A45' },
  tiede: { labelKey: 'today.relance.temp.warm', color: '#F2B855' },
  froid: { labelKey: 'today.relance.temp.cold', color: '#6F8CFF' },
}

// Logo MEGGA (mark quatre-pétales)
function RSLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }} aria-label="MEGGA">
      <path d="M0 5.23136C0 2.34216 2.34216 0 5.23136 0H14.8285V4.36576C14.8285 10.1442 10.1442 14.8285 4.36576 14.8285H0V5.23136Z" fill="#424BFB" />
      <path d="M0 17.1719H4.36576C10.1442 17.1719 14.8285 21.8562 14.8285 27.6346V32.0004H5.23136C2.34216 32.0004 0 29.6582 0 26.769V17.1719Z" fill="#424BFB" />
      <path d="M17.1719 0H26.769C29.6582 0 32.0004 2.34216 32.0004 5.23136V14.8285H27.6346C21.8562 14.8285 17.1719 10.1442 17.1719 4.36576V0Z" fill="#424BFB" />
      <path d="M17.1719 27.6346C17.1719 21.8562 21.8562 17.1719 27.6346 17.1719H32.0004V26.769C32.0004 29.6582 29.6582 32.0004 26.769 32.0004H17.1719V27.6346Z" fill="#424BFB" />
    </svg>
  )
}

interface RSLead {
  id?: string
  initials: string
  av: string
  name: string
  temp: string
  age?: string
  email: string | null
  why: string
  // subject/draft : présents uniquement sur les leads de démo (fallback). Pour
  // les vrais leads, le brouillon est généré par DeepSeek à la demande.
  subject?: string
  draft?: string
}

const SEED_LEADS: RSLead[] = [
  { initials: 'PV', av: '#9b7cf0', name: 'Pierre Vionnet', temp: 'froid', age: '12 j',
    email: 'pierre.vionnet@email.ch',
    why: '3 nouveaux biens correspondent à sa recherche (Carouge, 3.5p).',
    subject: '3 biens pour votre recherche à Carouge',
    draft: "Bonjour Pierre,\n\nDepuis notre dernier échange, trois biens correspondant à vos critères sont arrivés sur le marché à Carouge — dont un 3.5 pièces avec balcon que je pense tout à fait dans votre cible.\n\nSouhaitez-vous que je vous organise une visite cette semaine ? Je peux m'adapter à vos disponibilités.\n\nBien à vous,\nGregory Lenoir — MEGGA" },
  { initials: 'SM', av: '#8B5CF6', name: 'Sophie Marchand', temp: 'chaud', age: '4 j',
    email: 'sophie.marchand@email.ch',
    why: "A rouvert l'annonce de Carouge 4 fois cette semaine.",
    subject: 'Toujours intéressée par le 3.5p de Carouge ?',
    draft: "Bonjour Sophie,\n\nJ'ai vu que le 3.5 pièces de Carouge retenait votre attention. C'est un bien qui part vite — il a déjà plusieurs demandes de visite.\n\nVoulez-vous que je vous réserve un créneau avant le week-end pour le voir tranquillement ?\n\nBien à vous,\nGregory Lenoir — MEGGA" },
  { initials: 'DR', av: '#2370ff', name: 'David Rey', temp: 'tiede', age: '8 j',
    email: 'david.rey@email.ch',
    why: "Le critère « balcon sud » qu'il voulait est désormais disponible.",
    subject: 'Un balcon sud, comme vous le cherchiez',
    draft: "Bonjour David,\n\nVous m'aviez parlé de l'importance d'un balcon orienté sud. Un bien qui coche exactement ce critère vient de se libérer, et je crois qu'il pourrait vraiment vous plaire.\n\nDispo pour une visite cette semaine ? Je vous envoie le dossier complet si vous le souhaitez.\n\nBien à vous,\nGregory Lenoir — MEGGA" },
  { initials: 'LF', av: '#E0617A', name: 'Léa Fontaine', temp: 'chaud', age: '3 j',
    email: 'lea.fontaine@email.ch',
    why: 'A demandé une estimation la semaine dernière.',
    subject: 'Votre estimation est prête',
    draft: "Bonjour Léa,\n\nMerci pour votre demande d'estimation. J'ai finalisé l'analyse de votre bien et j'ai quelques pistes concrètes à vous partager pour valoriser au mieux la vente.\n\nAuriez-vous 20 minutes cette semaine pour en discuter, par téléphone ou autour d'un café ?\n\nBien à vous,\nGregory Lenoir — MEGGA" },
  { initials: 'TB', av: '#74d184', name: 'Thomas Berger', temp: 'froid', age: '15 j',
    email: 'thomas.berger@email.ch',
    why: 'Profil investisseur — 2 biens au rendement visé sont arrivés.',
    subject: '2 opportunités au rendement que vous visiez',
    draft: "Bonjour Thomas,\n\nDeux biens correspondant à votre stratégie d'investissement viennent d'arriver, avec un rendement brut dans la fourchette que vous m'aviez indiquée.\n\nJe peux vous transmettre les chiffres détaillés (loyers, charges, rendement net). Souhaitez-vous que je vous les envoie ?\n\nBien à vous,\nGregory Lenoir — MEGGA" },
]

// petit glyphe « copier » (deux rectangles) — atome simple
function RSCopyIcon({ size = 17, sw = 2 }: { size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  )
}

type RSVariant = 'primary' | 'ok' | 'outline' | 'ghost' | 'ghostDanger'

// ─── bouton générique ────────────────────────────────────────────────────
function RSBtn({ children, variant = 'ghost', icon, onClick, full = false }: { children: ReactNode; variant?: RSVariant; icon?: ReactNode; onClick?: () => void; full?: boolean }) {
  const [h, setH] = useState(false)
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    width: full ? '100%' : 'auto', height: 48, padding: '0 22px', borderRadius: 999, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 15, fontWeight: 800, letterSpacing: -0.1, whiteSpace: 'nowrap',
    transition: 'all .16s ease', transform: h ? 'translateY(-1px)' : 'none', border: '0',
  }
  const styles: Record<RSVariant, React.CSSProperties> = {
    primary: { background: h ? '#5B63FF' : '#424BFB', color: '#fff', boxShadow: h ? 'none' : '0 8px 20px -8px rgba(66,75,251,.45)' },
    ok: { background: '#16643F', color: '#fff', boxShadow: '0 8px 20px -8px rgba(0,0,0,.5)' },
    outline: { background: h ? TK.cardHi : TK.card, color: TK.ink, border: `1px solid ${h ? TK.borderHi : TK.border}` },
    ghost: { background: 'transparent', color: TK.sub, border: '1px solid transparent', height: 42, fontSize: 14, ...(h ? { color: TK.inkDim, background: TK.card } : {}) },
    ghostDanger: { background: 'transparent', color: TK.sub, border: '1px solid transparent', height: 42, fontSize: 14, ...(h ? { color: '#F26B65', background: 'rgba(242,107,101,0.10)' } : {}) },
  }
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ ...base, ...styles[variant], ...(variant.indexOf('ghost') === 0 ? { padding: '0 14px' } : {}) }}>
      {icon}{children}
    </button>
  )
}

// ─── carte brouillon IA (texte librement modifiable) ───────────────────────
function RSDraftCard({ lead, subject, draft, onSubject, onDraft, onRegen }: { lead: RSLead; subject: string; draft: string; onSubject: (v: string) => void; onDraft: (v: string) => void; onRegen: () => void }) {
  const { t } = useTranslation('dashboard')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [focus, setFocus] = useState(false)
  const grow = (el: HTMLTextAreaElement | null) => { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  useEffect(() => { grow(taRef.current) }, [draft])
  return (
    <div style={{ border: `1px solid ${focus ? TK.borderHi : TK.cardBorder}`, borderRadius: 18, background: TK.card, overflow: 'hidden',
      transition: 'border-color .16s ease', animation: 'rsRise .4s cubic-bezier(.2,.8,.2,1) both' }}>
      {/* méta destinataire — À en haut, Objet en dessous (logique e-mail) */}
      <div style={{ display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${TK.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${TK.border}` }}>
          <span style={{ width: 42, flexShrink: 0, fontSize: 12.5, color: TK.sub, fontWeight: 700 }}>{t('today.relance.draft.to')}</span>
          <span style={{ fontSize: 13, color: lead.email ? TK.inkDim : TK.faint, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{lead.email || t('today.relance.draft.emailMissing')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px' }}>
          <span style={{ width: 42, flexShrink: 0, fontSize: 12.5, color: TK.sub, fontWeight: 700 }}>{t('today.relance.draft.subject')}</span>
          <input value={subject} onChange={(e) => onSubject(e.target.value)} spellCheck={false}
            style={{ flex: 1, minWidth: 120, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit',
              fontSize: 13, color: TK.ink, fontWeight: 700, padding: '4px 6px', borderRadius: 7,
              transition: 'background .16s ease' }}
            onFocus={(e) => { e.target.style.background = TK.cardHi }}
            onBlur={(e) => { e.target.style.background = 'transparent' }} />
        </div>
      </div>
      {/* corps — textarea librement éditable */}
      <textarea ref={taRef} value={draft} onChange={(e) => { onDraft(e.target.value); grow(e.target) }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} spellCheck={true}
        style={{ display: 'block', width: '100%', border: 0, outline: 'none', resize: 'none', overflow: 'hidden',
          boxSizing: 'border-box', padding: '16px 18px', background: 'transparent', fontFamily: 'inherit',
          fontSize: 14.5, color: TK.inkDim, lineHeight: 1.62 }} />
      {/* barre d'actions du brouillon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 13px' }}>
        <button onClick={onRegen} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, background: 'transparent',
          color: TK.sub, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>
          <RXIcon name="spark" size={13} sw={2} /> {t('today.relance.draft.regenerate')}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: TK.faint, fontWeight: 700 }}>
          <RXIcon name="edit" size={12} sw={2} /> {t('today.relance.draft.editable')}
        </span>
      </div>
    </div>
  )
}

// Keyframes auto-injectées une fois (idempotent) — l'overlay anime opacity 0→1.
function ensureKeyframes() {
  if (typeof document === 'undefined' || document.getElementById('rs-keyframes')) return
  const s = document.createElement('style')
  s.id = 'rs-keyframes'
  s.textContent = `
    @keyframes rsFade { from{opacity:0;} to{opacity:1;} }
    @keyframes rsPop  { from{opacity:0; transform:scale(.94) translateY(10px);} to{opacity:1; transform:scale(1) translateY(0);} }
    @keyframes rsRise { from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);} }
    @keyframes rsShimmer { from{background-position:200% 0;} to{background-position:-200% 0;} }
  `
  document.head.appendChild(s)
}

// ─── Adaptateurs données réelles → lead de session ──────────────────────
const initialsOf = (first: string, last: string) =>
  ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '?'

// score 0-100 (useRelanceLeads : hot→85 / warm→65 / cold→35) → température.
const tempFromScore = (score: number): string => (score >= 80 ? 'chaud' : score >= 50 ? 'tiede' : 'froid')

const PALETTE = ['#5b6cff', '#8B5CF6', '#2370ff', '#E0617A', '#74d184', '#39B7C9', '#E08A45', '#9b7cf0']

// Type minimal du traducteur i18next (injection §5A — fonction pure non-composant).
type TFunc = (key: string, params?: Record<string, unknown>) => string

// Sépare un « Objet : … » d'en-tête du corps du message rédigé par l'IA.
function parseDraft(text: string, lead: RSLead, t: TFunc): { subject: string; body: string } {
  const trimmed = (text || '').trim()
  const nl = trimmed.indexOf('\n')
  const firstLine = (nl === -1 ? trimmed : trimmed.slice(0, nl)).trim()
  const m = firstLine.match(/^objet\s*:?\s*(.+)$/i)
  if (m) {
    return { subject: m[1].trim(), body: trimmed.slice(nl + 1).replace(/^\s+/, '') }
  }
  return { subject: t('today.relance.draft.fallbackSubject', { name: lead.name.split(' ')[0] }), body: trimmed }
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION OVERLAY
// ═══════════════════════════════════════════════════════════════════════════
export function RelanceSession({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const [asked, setAsked] = useState(false) // l'IA a-t-elle été sollicitée
  const [gen, setGen] = useState(false) // génération en cours
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false) // envoi MEGGA en cours
  const [sent, setSent] = useState(false) // envoyé depuis MEGGA
  const [done, setDone] = useState(false)
  const [subject, setSubject] = useState('') // objet éditable
  const [draft, setDraft] = useState('') // corps éditable
  const [counts, setCounts] = useState({ sent: 0, skipped: 0, discarded: 0 })
  const [undo, setUndo] = useState<{ index: number; name: string } | null>(null) // filet de sécurité « Pas intéressé »
  const [genError, setGenError] = useState(false) // échec de génération IA (sans repli démo)
  const [sendError, setSendError] = useState(false) // échec d'envoi MEGGA
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { t } = useTranslation('dashboard')
  const { user, profile } = useAuth()
  const { leads: realLeads, isLoading, isEmpty } = useRelanceLeads()
  const agentName = profile?.full_name?.trim() || t('today.relance.agentFallback')

  // Vrais leads dormants → leads de session, UNIQUEMENT une fois la requête
  // résolue avec au moins 1 résultat. Tant qu'elle charge (ou si l'agence n'a
  // aucun lead dormant / session non authentifiée) on garde le seed de démo —
  // ainsi `leads` n'est jamais vide (pas de `lead` undefined au render).
  // `demoMode` (confirmé vide) affiche une bannière honnête.
  const live = !isLoading && !isEmpty
  const demoMode = !isLoading && isEmpty
  const leads: RSLead[] = live
    ? realLeads.map((l, idx) => ({
        id: l.id,
        initials: initialsOf(l.first, l.last),
        av: l.avatarBg || PALETTE[idx % PALETTE.length],
        name: `${l.first} ${l.last}`.trim(),
        temp: tempFromScore(l.score),
        email: l.email,
        why: l.reason,
      }))
    : SEED_LEADS
  const lead = leads[i] || leads[0]

  useEffect(() => { ensureKeyframes() }, [])

  // Brouillon rédigé par DeepSeek (edge function ai-copilot · action draft_email),
  // à la demande. Human-in-the-loop : l'agent relit, édite, copie/envoie.
  // Repli sur le brouillon de démo du seed si la génération échoue (lead seed).
  const generate = async () => {
    setGenError(false)
    setGen(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-copilot', {
        body: {
          action: 'draft_email',
          message: `Rédige une relance email courtoise et personnalisée pour ${lead.name}. Objectif : reprendre contact après une période sans nouvelle, sans pression commerciale. Commence ta réponse par une ligne « Objet : … », puis une ligne vide, puis le corps de l'email (vouvoiement, formules suisses, signature « ${agentName} — MEGGA »).`,
          context: { contact: lead.name, raison_relance: lead.why, email: lead.email },
          language: 'fr',
        },
      })
      if (error) throw error
      const result = (data as { result?: string } | null)?.result
      if (!result) throw new Error('réponse IA vide')
      const parsed = parseDraft(result, lead, t)
      setSubject(parsed.subject)
      setDraft(parsed.body)
      setAsked(true)
    } catch {
      if (lead.draft) {
        setSubject(lead.subject || t('today.relance.draft.fallbackSubject', { name: lead.name.split(' ')[0] }))
        setDraft(lead.draft)
        setAsked(true)
      } else {
        setGenError(true)
      }
    } finally {
      setGen(false)
    }
  }
  const ask = () => { void generate() }
  const regen = () => { setCopied(false); setSent(false); setSending(false); setAsked(false); void generate() }

  const reset = () => { setAsked(false); setGen(false); setGenError(false); setSendError(false); setCopied(false); setSending(false); setSent(false); setSubject(''); setDraft('') }
  // outcome : "sent" (relancé) · "skipped" (passé, representé plus tard) · "discarded" (pas intéressé, sorti de la boucle)
  const advance = (outcome: 'sent' | 'skipped' | 'discarded') => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndo(null)
    setCounts((c) => ({ ...c, [outcome]: c[outcome] + 1 }))
    if (i >= leads.length - 1) { setDone(true); return }
    setI(i + 1); reset()
  }
  const next = () => advance((copied || sent) ? 'sent' : 'skipped')
  const skip = () => advance('skipped')

  // « Pas intéressé » : action définitive, mais avec un undo de 5 s (filet de sécurité).
  const notInterested = () => {
    const from = i, wasLast = i >= leads.length - 1
    setCounts((c) => ({ ...c, discarded: c.discarded + 1 }))
    setUndo({ index: from, name: lead.name.split(' ')[0] })
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 5000)
    if (wasLast) setDone(true)
    else { setI(from + 1); reset() }
  }
  const undoDiscard = () => {
    if (!undo) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setCounts((c) => ({ ...c, discarded: Math.max(0, c.discarded - 1) }))
    setDone(false); setI(undo.index); reset(); setUndo(null)
  }
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])

  // Envoi direct via la boîte connectée MEGGA : trace la relance dans la fiche.
  // Envoi réel via la boîte connectée MEGGA (edge send-relance-email · Resend).
  // GARDE-FOU : en mode démo (leads fictifs) on SIMULE — rien n'est envoyé à de
  // vrais destinataires. Human-in-the-loop : c'est l'agent qui déclenche.
  const sendMEGGA = async () => {
    if (sending || sent) return
    setSendError(false)
    setSending(true)
    // GARDE-FOU robuste : on n'envoie POUR DE VRAI que sur de vrais leads chargés
    // (`live`). Sinon (leads seed / requête non résolue / pas d'email) on SIMULE —
    // jamais d'envoi à un destinataire fictif. (demoMode seul est insuffisant : si
    // la requête ne se résout pas, isEmpty reste false alors que les leads sont seed.)
    if (!live || !lead.email) {
      setTimeout(() => { setSending(false); setSent(true) }, 800)
      return
    }
    try {
      const { error } = await supabase.functions.invoke('send-relance-email', {
        body: { to: lead.email, subject, body: draft, leadId: lead.id, agentName },
      })
      if (error) throw error
      setSent(true)
      // Audit HITL de l'envoi RÉEL (jamais en simulation démo, garde-fou ci-dessus) :
      // consigne la relance dans la timeline contact. lead.id non garanti uuid → metadata.
      const agencyId = profile?.agency_id
      const actorId = profile?.id ?? user?.id // actor_id FK → profiles(id) (convention Atelier)
      if (agencyId && actorId) {
        const leadUuid = uuidOrNull(lead.id)
        void supabase.from('activity_events').insert({
          agency_id: agencyId,
          actor_id: actorId,
          actor_kind: 'user',
          action: 'relance_sent',
          entity_type: 'contact',
          entity_id: leadUuid,
          category: 'contact',
          severity: 'info',
          object_label: lead.name,
          metadata: { source: 'relance_session', channel: 'email', lead_id: lead.id ?? null, subject } as Json,
        }).then(({ error: logErr }) => { if (logErr) console.error('[relance] activity_events insert failed', logErr) })
      }
    } catch {
      setSendError(true)
    } finally {
      setSending(false)
    }
  }

  const copy = () => {
    try { if (navigator.clipboard) navigator.clipboard.writeText(draft) } catch { /* clipboard indispo */ }
    setCopied(true)
  }
  const mailto = `mailto:${lead.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft)}`

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      // ne pas capter les raccourcis pendant l'édition d'un champ texte
      const t = e.target as HTMLElement | null
      const tag = t && t.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || (t && t.isContentEditable)) return
      if (done) return
      else if (e.key.toLowerCase() === 'a' && !asked && !gen) ask()
      else if (e.key.toLowerCase() === 'c' && asked) copy()
      else if (e.key === 'Enter' || e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center',
      background: 'rgba(8,9,12,.66)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)',
      animation: 'rsFade .25s ease both', padding: 24, boxSizing: 'border-box' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{ position: 'relative', width: 'min(760px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: TK.frame, border: `1px solid ${TK.borderHi}`, borderRadius: 28, boxShadow: TK.shadowLg,
        overflow: 'hidden', transformOrigin: 'top right', animation: 'rsPop .42s cubic-bezier(.2,.85,.25,1) both',
        fontFamily: 'Manrope, system-ui, sans-serif', color: TK.ink }}>

        {/* HEAD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: `1px solid ${TK.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
            <RSLogo size={28} />
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{t('today.relance.header.title')}</div>
          </div>
          <div style={{ flex: 1 }} />
          {!done && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              {/* mini-barre de progression colorée par température (cohérence widget) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {leads.map((l, k) => {
                  const c = RS_TEMP[l.temp].color
                  const cur = k === i, past = k < i
                  return (
                    <span key={k} title={`${l.name} · ${t(RS_TEMP[l.temp].labelKey)}`} style={{
                      width: cur ? 22 : 11, height: 7, borderRadius: 999, background: c,
                      opacity: past ? 0.92 : cur ? 1 : 0.26,
                      boxShadow: cur ? `0 0 0 3px ${c}26` : 'none',
                      transition: 'width .3s cubic-bezier(.76,0,.24,1), opacity .3s ease, box-shadow .3s ease' }} />
                  )
                })}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: TK.sub, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {i + 1}<span style={{ color: TK.faint }}> / {leads.length}</span>
              </span>
            </div>
          )}
          <button onClick={onClose} title={t('today.relance.header.closeTitle')}
            style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
              borderRadius: 999, border: `1px solid ${TK.border}`, background: TK.card, color: TK.sub, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 15, flexShrink: 0 }}>
            ✕
          </button>
        </div>

        {done ? (
          /* ── ÉCRAN DE FIN ── */
          <div style={{ padding: '56px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            animation: 'rsRise .4s cubic-bezier(.2,.8,.2,1) both' }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: '#16643F', color: '#fff', display: 'grid', placeItems: 'center' }}>
              <RXIcon name="check" size={30} sw={2.4} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{t('today.relance.done.title')}</div>
            <div style={{ fontSize: 15, color: TK.sub, fontWeight: 600, maxWidth: 400, lineHeight: 1.5 }}>
              <b style={{ color: TK.inkDim }}>{counts.sent}</b> {t('today.relance.done.contacted', { count: counts.sent })}
              {counts.discarded > 0 && <> · <b style={{ color: TK.inkDim }}>{counts.discarded}</b> {t('today.relance.done.discarded', { count: counts.discarded })}</>}
              {counts.skipped > 0 && <> · <b style={{ color: TK.inkDim }}>{counts.skipped}</b> {t('today.relance.done.postponed', { count: counts.skipped })}</>}.
              <br />{t('today.relance.done.explainer')}
            </div>
            <div style={{ marginTop: 8 }}><RSBtn variant="primary" onClick={onClose}>{t('today.relance.done.backToDashboard')}</RSBtn></div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Mode démo — aucun lead réel : honnêteté, rien n'est envoyé à de vrais destinataires */}
            {demoMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 12,
                background: 'rgba(242,184,85,0.10)', border: '1px solid rgba(242,184,85,0.28)' }}>
                <RXIcon name="spark" size={14} color="#F2B855" sw={2.2} />
                <span style={{ fontSize: 12, fontWeight: 700, color: TK.inkDim }}>{t('today.relance.demoBanner')}</span>
              </div>
            )}
            {/* LEAD */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Av initials={lead.initials} av={lead.av} size={48} ring />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.4 }}>{lead.name}</span>
                </div>
                {/* pourquoi ce lead maintenant — renforce la confiance dans la suggestion IA */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 5 }}>
                  <span style={{ color: TK.primary, flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: '1.4em' }}><RXIcon name="spark" size={13} sw={2.2} /></span>
                  <span style={{ fontSize: 13, color: TK.sub, fontWeight: 600, lineHeight: 1.4 }}>{lead.why}</span>
                </div>
              </div>
            </div>

            {/* ZONE MESSAGE */}
            {!asked && !gen && !genError && (
              <div style={{ border: `1.5px dashed ${TK.borderHi}`, borderRadius: 18, padding: '34px 24px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: TK.card }}>
                <div style={{ fontSize: 15.5, color: TK.inkDim, fontWeight: 700, lineHeight: 1.4, maxWidth: 360 }}>
                  {t('today.relance.empty.prompt')}<br />{t('today.relance.empty.help')}
                </div>
                <RSBtn variant="primary" onClick={ask}>{t('today.relance.empty.cta')}</RSBtn>
              </div>
            )}

            {/* Échec de génération — message honnête, pas de faux brouillon */}
            {genError && !gen && (
              <div style={{ border: `1.5px dashed rgba(242,107,101,0.4)`, borderRadius: 18, padding: '30px 24px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: 'rgba(242,107,101,0.06)' }}>
                <div style={{ fontSize: 15, color: TK.inkDim, fontWeight: 700, lineHeight: 1.4, maxWidth: 380 }}>
                  {t('today.relance.genError.title')}<br />{t('today.relance.genError.help')}
                </div>
                <RSBtn variant="primary" onClick={ask}>{t('today.relance.genError.retry')}</RSBtn>
              </div>
            )}

            {gen && (
              <div style={{ border: `1px solid ${TK.cardBorder}`, borderRadius: 18, padding: '22px', background: TK.card,
                display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: TK.primary }}>
                  <RXIcon name="spark" size={15} sw={2.2} />
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em' }}>{t('today.relance.generating')}</span>
                </div>
                {[92, 86, 94, 60].map((w, k) => (
                  <div key={k} style={{ height: 11, width: `${w}%`, borderRadius: 6, background: `linear-gradient(90deg, ${TK.cardHi}, ${TK.card}, ${TK.cardHi})`,
                    backgroundSize: '200% 100%', animation: 'rsShimmer 1.1s linear infinite', animationDelay: `${k * 0.08}s` }} />
                ))}
              </div>
            )}

            {asked && !gen && (
              <>
                <RSDraftCard lead={lead} subject={subject} draft={draft}
                  onSubject={(v) => { setSubject(v); setCopied(false) }}
                  onDraft={(v) => { setDraft(v); setCopied(false) }}
                  onRegen={regen} />

                {/* ACTIONS — copier = geste central ; envoi MEGGA = chemin intégré */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sent ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14,
                      background: 'rgba(22,100,63,0.16)', border: '1px solid rgba(52,199,150,0.32)', animation: 'rsFade .25s ease both' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 999, background: '#16643F', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <RXIcon name="check" size={18} sw={2.4} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: TK.ink }}>{t('today.relance.sent.title')}</div>
                        <div style={{ fontSize: 12.5, color: TK.sub, fontWeight: 600 }}>{t('today.relance.sent.tracked', { name: lead.name.split(' ')[0] })}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 11, alignItems: 'center', flexWrap: 'wrap' }}>
                      {copied
                        ? <RSBtn variant="ok" icon={<RXIcon name="check" size={17} sw={2.4} />}>{t('today.relance.actions.copied')}</RSBtn>
                        : <RSBtn variant="primary" onClick={copy} icon={<RSCopyIcon />}>{t('today.relance.actions.copy')}</RSBtn>}
                      <a href={mailto} style={{ textDecoration: 'none' }}>
                        <RSBtn variant="outline" icon={<RXIcon name="mail" size={16} sw={1.9} />}>{t('today.relance.actions.openInMailbox')}</RSBtn>
                      </a>
                      <div style={{ flex: 1 }} />
                      <RSBtn variant="ghost" onClick={sendMEGGA}>{sending ? t('today.relance.actions.sending') : t('today.relance.actions.sendFromMegga')}</RSBtn>
                    </div>
                  )}
                  {sendError && (
                    <div style={{ fontSize: 12.5, color: '#F26B65', fontWeight: 700 }}>{t('today.relance.sendError')}</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* FOOTER NAV */}
        {!done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 20px', borderTop: `1px solid ${TK.border}` }}>
            <RSBtn variant="ghost" onClick={skip}>{t('today.relance.nav.later')}</RSBtn>
            <RSBtn variant="ghostDanger" onClick={notInterested}>{t('today.relance.nav.notInterested')}</RSBtn>
            <div style={{ flex: 1 }} />
            {(copied || sent)
              ? <RSBtn variant="primary" onClick={next}>{t('today.relance.nav.next')}</RSBtn>
              : <RSBtn variant="outline" onClick={next}>{t('today.relance.nav.next')}</RSBtn>}
          </div>
        )}

        {/* TOAST UNDO — filet de sécurité après « Pas intéressé » */}
        {undo && (
          <div style={{ position: 'absolute', left: '50%', bottom: 84, transform: 'translateX(-50%)', zIndex: 8,
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 9px 9px 16px', borderRadius: 999,
            background: TK.frameHi || '#1b1d24', border: `1px solid ${TK.borderHi}`, boxShadow: TK.shadowLg,
            whiteSpace: 'nowrap', animation: 'rsRise .3s cubic-bezier(.2,.8,.2,1) both' }}>
            <span style={{ fontSize: 13, color: TK.inkDim, fontWeight: 700 }}>{t('today.relance.undo.discarded', { name: undo.name })}</span>
            <button onClick={undoDiscard} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px',
              borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
              background: '#F2F2F6', color: '#0A0A0F' }}>
              {t('today.relance.undo.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
