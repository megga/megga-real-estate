// MEGGA CRM Sugar v2 — Julien IA (interface chat style Claude.ai)
// Port from `crm-julien.jsx` du bundle (proto v2 : drawer historique glassy +
// capsule contexte dossier).
//
// Différences avec le proto :
// - useCopilot (hook existant) câble la vraie Edge Function `ai-copilot` avec
//   streaming token-by-token natif → on retire la simulation streaming locale.
// - useAuth().profile remplace window.CRM_AGENT pour le prénom et l'avatar.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { useAuth } from '@/hooks/useAuth'
import { useCopilot } from '@/hooks/useCopilot'
import { useConversationMessages } from '@/hooks/useConversationHistory'

const DARK_TONE: DarkTone = 'meggaAi'

// ─── Suggestions ────────────────────────────────────────────────────────

interface Suggestion {
  id: string
  icon: JIconName
  label: string
  prompt: string
}

// ─── Salutations selon l'heure ──────────────────────────────────────────

function getGreeting(firstName: string, tr: TFunction): string {
  const h = new Date().getHours()
  if (h < 5) return tr('julien.greeting.lateNight', { name: firstName })
  if (h < 12) return tr('julien.greeting.morning', { name: firstName })
  if (h < 14) return tr('julien.greeting.midday', { name: firstName })
  if (h < 18) return tr('julien.greeting.afternoon', { name: firstName })
  if (h < 22) return tr('julien.greeting.evening', { name: firstName })
  return tr('julien.greeting.night', { name: firstName })
}

function getSubgreeting(tr: TFunction): string {
  const h = new Date().getHours()
  const d = new Date().getDay()
  if (h < 9) return tr('julien.subgreeting.earlyMorning')
  if (h < 12) return tr('julien.subgreeting.morning')
  if (h < 14) return tr('julien.subgreeting.midday')
  if (h < 17) return tr('julien.subgreeting.afternoon')
  if (h < 19) return tr('julien.subgreeting.endOfDay')
  if (d === 5 || d === 6) return tr('julien.subgreeting.weekend')
  return tr('julien.subgreeting.default')
}

// ─── Suggestions dynamiques selon heure + écran précédent ───────────────

type PrevScreen = 'today' | 'pipeline' | 'biens' | 'contacts' | 'matching' | 'calendar' | 'docs' | null

function getDynamicSuggestions(prevScreen: PrevScreen, tr: TFunction): Suggestion[] {
  const h = new Date().getHours()
  const day = new Date().getDay()
  if (prevScreen === 'pipeline') return [
    { id: 'px1', icon: 'chart', label: tr('julien.suggestions.pipeline.analyze.label'), prompt: tr('julien.suggestions.pipeline.analyze.prompt') },
    { id: 'px2', icon: 'draft', label: tr('julien.suggestions.pipeline.followUp.label'), prompt: tr('julien.suggestions.pipeline.followUp.prompt') },
    { id: 'px3', icon: 'checklist', label: tr('julien.suggestions.pipeline.nextActions.label'), prompt: tr('julien.suggestions.pipeline.nextActions.prompt') },
  ]
  if (prevScreen === 'biens') return [
    { id: 'bx1', icon: 'draft', label: tr('julien.suggestions.biens.premiumListing.label'), prompt: tr('julien.suggestions.biens.premiumListing.prompt') },
    { id: 'bx2', icon: 'chart', label: tr('julien.suggestions.biens.comparableEstimate.label'), prompt: tr('julien.suggestions.biens.comparableEstimate.prompt') },
    { id: 'bx3', icon: 'folder', label: tr('julien.suggestions.biens.ownerPitch.label'), prompt: tr('julien.suggestions.biens.ownerPitch.prompt') },
  ]
  if (prevScreen === 'contacts') return [
    { id: 'cx1', icon: 'draft', label: tr('julien.suggestions.contacts.checkInEmail.label'), prompt: tr('julien.suggestions.contacts.checkInEmail.prompt') },
    { id: 'cx2', icon: 'folder', label: tr('julien.suggestions.contacts.prepareCall.label'), prompt: tr('julien.suggestions.contacts.prepareCall.prompt') },
    { id: 'cx3', icon: 'checklist', label: tr('julien.suggestions.contacts.followUpPlan.label'), prompt: tr('julien.suggestions.contacts.followUpPlan.prompt') },
  ]
  if (prevScreen === 'matching') return [
    { id: 'mx1', icon: 'draft', label: tr('julien.suggestions.matching.email.label'), prompt: tr('julien.suggestions.matching.email.prompt') },
    { id: 'mx2', icon: 'folder', label: tr('julien.suggestions.matching.refineCriteria.label'), prompt: tr('julien.suggestions.matching.refineCriteria.prompt') },
    { id: 'mx3', icon: 'chart', label: tr('julien.suggestions.matching.relevance.label'), prompt: tr('julien.suggestions.matching.relevance.prompt') },
  ]
  if (prevScreen === 'calendar') return [
    { id: 'kx1', icon: 'checklist', label: tr('julien.suggestions.calendar.prepareToday.label'), prompt: tr('julien.suggestions.calendar.prepareToday.prompt') },
    { id: 'kx2', icon: 'draft', label: tr('julien.suggestions.calendar.confirmVisits.label'), prompt: tr('julien.suggestions.calendar.confirmVisits.prompt') },
    { id: 'kx3', icon: 'folder', label: tr('julien.suggestions.calendar.visitRecap.label'), prompt: tr('julien.suggestions.calendar.visitRecap.prompt') },
  ]
  if (prevScreen === 'docs') return [
    { id: 'dx1', icon: 'checklist', label: tr('julien.suggestions.docs.checklist.label'), prompt: tr('julien.suggestions.docs.checklist.prompt') },
    { id: 'dx2', icon: 'draft', label: tr('julien.suggestions.docs.clause.label'), prompt: tr('julien.suggestions.docs.clause.prompt') },
    { id: 'dx3', icon: 'folder', label: tr('julien.suggestions.docs.mandateTemplate.label'), prompt: tr('julien.suggestions.docs.mandateTemplate.prompt') },
  ]
  if (prevScreen === 'today') return [
    { id: 'tx1', icon: 'folder', label: tr('julien.suggestions.today.summary.label'), prompt: tr('julien.suggestions.today.summary.prompt') },
    { id: 'tx2', icon: 'checklist', label: tr('julien.suggestions.today.priorities.label'), prompt: tr('julien.suggestions.today.priorities.prompt') },
    { id: 'tx3', icon: 'chart', label: tr('julien.suggestions.today.weekOutlook.label'), prompt: tr('julien.suggestions.today.weekOutlook.prompt') },
  ]
  if (h < 10) return [
    { id: 'hx1', icon: 'checklist', label: tr('julien.suggestions.earlyMorning.appointments.label'), prompt: tr('julien.suggestions.earlyMorning.appointments.prompt') },
    { id: 'hx2', icon: 'folder', label: tr('julien.suggestions.earlyMorning.priorities.label'), prompt: tr('julien.suggestions.earlyMorning.priorities.prompt') },
    { id: 'hx3', icon: 'draft', label: tr('julien.suggestions.earlyMorning.emails.label'), prompt: tr('julien.suggestions.earlyMorning.emails.prompt') },
  ]
  if (h < 14) return [
    { id: 'hx4', icon: 'folder', label: tr('julien.suggestions.midday.progress.label'), prompt: tr('julien.suggestions.midday.progress.prompt') },
    { id: 'hx5', icon: 'draft', label: tr('julien.suggestions.midday.visitFollowUp.label'), prompt: tr('julien.suggestions.midday.visitFollowUp.prompt') },
    { id: 'hx6', icon: 'chart', label: tr('julien.suggestions.midday.genevaMarket.label'), prompt: tr('julien.suggestions.midday.genevaMarket.prompt') },
  ]
  if (h < 18) return [
    { id: 'hx7', icon: 'draft', label: tr('julien.suggestions.afternoon.visitFollowUp.label'), prompt: tr('julien.suggestions.afternoon.visitFollowUp.prompt') },
    { id: 'hx8', icon: 'folder', label: tr('julien.suggestions.afternoon.summary.label'), prompt: tr('julien.suggestions.afternoon.summary.prompt') },
    { id: 'hx9', icon: 'checklist', label: tr('julien.suggestions.afternoon.remaining.label'), prompt: tr('julien.suggestions.afternoon.remaining.prompt') },
  ]
  if (day === 5) return [
    { id: 'hxa', icon: 'folder', label: tr('julien.suggestions.friday.weekReview.label'), prompt: tr('julien.suggestions.friday.weekReview.prompt') },
    { id: 'hxb', icon: 'checklist', label: tr('julien.suggestions.friday.prepareMonday.label'), prompt: tr('julien.suggestions.friday.prepareMonday.prompt') },
    { id: 'hxc', icon: 'draft', label: tr('julien.suggestions.friday.endOfWeekEmails.label'), prompt: tr('julien.suggestions.friday.endOfWeekEmails.prompt') },
  ]
  return [
    { id: 'hxd', icon: 'folder', label: tr('julien.suggestions.evening.dayReview.label'), prompt: tr('julien.suggestions.evening.dayReview.prompt') },
    { id: 'hxe', icon: 'checklist', label: tr('julien.suggestions.evening.prepareTomorrow.label'), prompt: tr('julien.suggestions.evening.prepareTomorrow.prompt') },
    { id: 'hxf', icon: 'draft', label: tr('julien.suggestions.evening.endOfDayEmail.label'), prompt: tr('julien.suggestions.evening.endOfDayEmail.prompt') },
  ]
}

// ─── Historique conversations + contextes dossiers ────────────────────
// Retirés cette PR : pas de table ai_copilot_conversations en prod, et le
// ContextPicker dropdown surfacait 3 dossiers hardcodés (Champel/Martinez/
// Carouge) sans lien aux transactions réelles. Chip séparée pour la
// persistance + le ContextPicker câblé à transactions/contacts.

// ─── Tokens Julien (modèle dark/light propre, distinct de SP) ────────────

interface JulienTokens {
  bg: string
  surface: string
  surfaceB: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  border: string
  borderHov: string
  black: string
  selInk: string
  shadow: string
  drawerBg: string
}

function tok(dark: boolean): JulienTokens {
  return dark ? {
    bg: '#0A0A0B',
    surface: 'rgba(255,255,255,0.04)',
    surfaceB: 'rgba(255,255,255,0.06)',
    ink: '#F2F0EC',
    inkSoft: '#9C9A95',
    muted: '#6B6964',
    ghost: '#3A3936',
    border: 'rgba(255,255,255,0.08)',
    borderHov: 'rgba(255,255,255,0.2)',
    black: '#F2F0EC',
    selInk: '#0A0A0B',
    shadow: '0 24px 80px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4)',
    drawerBg: 'rgba(12,12,14,0.92)',
  } : {
    bg: '#F4F5F7',
    surface: '#FFFFFF',
    surfaceB: '#F7F8FA',
    ink: '#0B0C0E',
    inkSoft: '#3A3D44',
    muted: '#7A8088',
    ghost: '#B5BAC2',
    border: '#E4E6EC',
    borderHov: '#0B0C0E',
    black: '#0B0C0E',
    selInk: '#FFFFFF',
    shadow: '0 8px 32px rgba(15,23,42,0.08)',
    drawerBg: 'rgba(245,246,248,0.96)',
  }
}

// ─── Icon factory (subset utilisé par Julien) ────────────────────────────

type JIconName =
  | 'folder' | 'draft' | 'chart' | 'pen' | 'checklist' | 'translate' | 'send'
  | 'stop' | 'copy' | 'sparkle' | 'attach' | 'mic' | 'plus' | 'clock' | 'x'
  | 'mail' | 'folderAdd' | 'task' | 'check' | 'contacts' | 'bien' | 'newchat'
  | 'chevL'

const JICON_PATHS: Record<JIconName, ReactNode> = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  draft: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>,
  pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  checklist: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  translate: <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1m15 20-5-10-5 10M14 18h6" />,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  stop: <rect x="3" y="3" width="18" height="18" rx="2" />,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
  sparkle: <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />,
  attach: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  mic: <><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  folderAdd: <><path d="M3 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M12 11v5M9.5 13.5h5" /></>,
  task: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 15l2 2 4-4" /></>,
  check: <path d="m5 12 5 5 9-11" />,
  contacts: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5" /></>,
  bien: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  newchat: <path d="M12 5v14M5 12h14" />,
  chevL: <path d="m15 18-6-6 6-6" />,
}

interface JIconProps { name: JIconName; size?: number; color?: string; sw?: number }

function JIcon({ name, size = 18, color = 'currentColor', sw = 1.6 }: JIconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    >
      {JICON_PATHS[name] || null}
    </svg>
  )
}

// ─── Détection email (heuristique FR) ────────────────────────────────────

interface ParsedEmail { to: string; subject: string; body: string }

function parseEmail(text: string, tr: TFunction): ParsedEmail | null {
  if (!text || text.length < 60) return null
  const t = text.trim()
  const greet = /(^|\n)\s*(Bonjour|Madame|Monsieur|Cher|Chère|Chers|Bonsoir)\b/i
  const sign = /(Cordialement|Bien cordialement|Bien à vous|Sincères salutations|Excellente journée|Belle journée|À très vite|À bientôt)\b/i
  const hasGreet = greet.test(t)
  const hasSign = sign.test(t)
  const subjectMatch = t.match(/(?:^|\n)\s*(?:Objet|Sujet)\s*[:：]\s*(.+?)(?:\n|$)/i)
  const toMatch = t.match(/(?:^|\n)\s*(?:À|A|Destinataire|Pour)\s*[:：]\s*(.+?)(?:\n|$)/i)
  if (!hasGreet || !hasSign) {
    if (!subjectMatch) return null
  }
  let body = t
  if (subjectMatch) body = body.replace(subjectMatch[0], '')
  if (toMatch) body = body.replace(toMatch[0], '')
  body = body.replace(/^\s*\n+/, '').trim()
  let subject = subjectMatch ? subjectMatch[1].trim() : ''
  if (!subject) {
    const firstLine = body.split('\n')[0]?.trim() || ''
    if (firstLine.length < 80 && !greet.test(firstLine) && /^[A-ZÉÈÀ]/.test(firstLine)) {
      subject = firstLine
      body = body.split('\n').slice(1).join('\n').replace(/^\s*\n+/, '')
    }
  }
  return { to: toMatch ? toMatch[1].trim() : '', subject: subject || tr('julien.email.noSubject'), body: body || t }
}

// ─── Page principale ─────────────────────────────────────────────────────

export default function JulienSugarV2Page() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  // Conversation à reprendre (?c=<id>) depuis la palette de commande (chantier B).
  const [searchParams] = useSearchParams()
  const resumeId = searchParams.get('c')

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)
  const s = tok(dark)

  const [prevScreen] = useState<PrevScreen>(() => {
    const ref = document.referrer
    if (ref.includes('/dashboard/pipeline')) return 'pipeline'
    if (ref.includes('/dashboard/listings')) return 'biens'
    if (ref.includes('/dashboard/contacts')) return 'contacts'
    if (ref.includes('/dashboard/matching')) return 'matching'
    if (ref.includes('/dashboard/calendar')) return 'calendar'
    if (ref.includes('/dashboard') && !ref.includes('/dashboard/')) return 'today'
    return null
  })

  const onCmd = () => {}
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/network'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      case 'ai':
      case 'julien': break
      default:
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: dark
          ? 'radial-gradient(ellipse 100% 70% at 50% 0%, #15141A 0%, #0A0A0B 50%, #050506 100%)'
          : 'radial-gradient(ellipse 120% 90% at 50% 110%, #C8D5E0 0%, #DDE2E9 40%, #EAEDF3 100%)',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: s.ink,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Orb de fond — uniquement en mode sombre, discret */}
      {dark && (
        <div
          style={{
            position: 'absolute', pointerEvents: 'none',
            width: 700, height: 700, borderRadius: '50%',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -30%)',
            background: 'radial-gradient(circle, rgba(255,235,200,0.04) 0%, transparent 65%)',
            filter: 'blur(40px)',
          }}
        />
      )}

      <style>{`
        @keyframes jpulse  { 0%,60%,100%{opacity:.2;transform:scale(.85)} 30%{opacity:1;transform:scale(1)} }
        @keyframes jbar    { from{transform:scaleY(0.4)} to{transform:scaleY(1)} }
        @keyframes capsule-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes item-in    { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes jcaret  { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes gg-spin    { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes gg-breathe { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.08);opacity:1} }
        @keyframes gg-halo    { 0%,100%{transform:scale(.9);opacity:.6} 50%{transform:scale(1.15);opacity:1} }
        @keyframes gg-shimmer { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes gg-fade-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes hist-in    { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      <SugarTopNav
        active={'julien' as SugarScreenId}
        t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
          <SugarIconRail
            active="ai"
            onNavigate={onNavigate} onCmd={onCmd}
            dark={dark} setDark={setDark} sp={sp}
          />
        </div>

        <main
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            height: 'calc(100vh - 88px)',
            transition: 'margin-left .32s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          <JulienConversation
            s={s} dark={dark} prevScreen={prevScreen}
            firstName={(profile?.full_name?.split(' ')[0]) || 'Grégory'}
            resumeId={resumeId}
          />
        </main>
      </div>
    </div>
  )
}

// ─── Conversation : page vide (greeting) ou messages ─────────────────────

interface JulienMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  streaming?: boolean
}

interface JulienConversationProps {
  s: JulienTokens
  dark: boolean
  prevScreen: PrevScreen
  firstName: string
  resumeId: string | null
}

function JulienConversation({ s, dark, prevScreen, firstName, resumeId }: JulienConversationProps) {
  const { t: tr } = useTranslation('messages')
  const [messages, setMessages] = useState<JulienMessage[]>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const { sendMessageStream, isLoading, resumeConversation } = useCopilot()

  // Reprise d'une conversation persistée (chantier B · phase 4) : on charge ses
  // messages et on seed le copilote (une seule fois par id chargé). Vide tant que
  // le writer n'est pas activé → la page reste sur son état d'accueil habituel.
  const { data: resumed } = useConversationMessages(resumeId)
  const seededRef = useRef<string | null>(null)
  useEffect(() => {
    if (resumed && seededRef.current !== resumed.id) {
      seededRef.current = resumed.id
      setMessages(resumed.messages.map((m, i) => ({ id: i + 1, role: m.role, content: m.content })))
      resumeConversation(resumed.id, resumed.messages)
    }
  }, [resumed, resumeConversation])

  useEffect(() => {
    if (bottomRef.current && bottomRef.current.parentElement) {
      bottomRef.current.parentElement.scrollTop = bottomRef.current.offsetTop
    }
  }, [messages])

  const sendMessage = async (text: string) => {
    if (isLoading) return
    const uid = Date.now()
    const lid = uid + 1
    setMessages(prev => [
      ...prev,
      { id: uid, role: 'user', content: text },
      { id: lid, role: 'assistant', content: '', loading: true, streaming: false },
    ])

    setMessages(prev => prev.map(m =>
      m.id === lid ? { ...m, loading: false, streaming: true, content: '' } : m,
    ))

    try {
      let acc = ''
      await sendMessageStream(
        text,
        undefined,
        chunk => {
          acc += chunk
          setMessages(prev => prev.map(m =>
            m.id === lid ? { ...m, content: acc } : m,
          ))
        },
      )
      setMessages(prev => prev.map(m =>
        m.id === lid ? { ...m, streaming: false } : m,
      ))
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === lid ? { ...m, content: tr('julien.error.failed'), loading: false, streaming: false } : m,
      ))
    }
  }

  const isEmpty = messages.length === 0
  const greeting = useMemo(() => getGreeting(firstName, tr), [firstName, tr])
  const subgreeting = useMemo(() => getSubgreeting(tr), [tr])
  const dynamicSuggestions = useMemo(() => getDynamicSuggestions(prevScreen, tr), [prevScreen, tr])

  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: isEmpty ? 'center' : 'flex-start',
        width: '100%', overflow: 'hidden',
      }}
    >
      {isEmpty ? (
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 28, width: '100%', padding: '0 24px 40px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <h1
              style={{
                margin: 0, fontSize: 48, fontWeight: 800,
                color: s.ink, letterSpacing: '-1.2px', textAlign: 'center', lineHeight: 1.1,
              }}
            >
              {greeting}
            </h1>
            <div style={{ fontSize: 16, color: s.inkSoft, fontWeight: 500, textAlign: 'center' }}>
              {subgreeting}
            </div>
          </div>

          <PromptBar
            onSend={sendMessage} loading={isLoading} dark={dark} s={s}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 580 }}>
            {dynamicSuggestions.map((sug, i) => (
              <button
                key={sug.id}
                onClick={() => sendMessage(sug.prompt)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 16px', borderRadius: 999,
                  background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(16px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                  border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.8)',
                  boxShadow: dark ? '0 4px 16px rgba(0,0,0,.25)' : '0 4px 20px rgba(15,23,42,0.07)',
                  color: s.inkSoft, fontSize: 13, fontWeight: 600,
                  fontFamily: '"Inter Tight", system-ui, sans-serif', cursor: 'pointer',
                  transition: 'all .18s',
                  animation: `capsule-in .35s ease ${i * 0.06}s both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = s.borderHov; e.currentTarget.style.color = s.ink }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = s.border; e.currentTarget.style.color = s.inkSoft }}
              >
                <JIcon name={sug.icon} size={14} color="currentColor" />
                {sug.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, width: '100%', maxWidth: 580, overflowY: 'auto', padding: '24px 0 8px' }}>
          {messages.map(msg => <Bubble key={msg.id} msg={msg} s={s} dark={dark} />)}
          <div ref={bottomRef} style={{ height: 1 }} />
        </div>
      )}

      {!isEmpty && (
        <div style={{ width: '100%', padding: '12px 24px 24px', display: 'flex', justifyContent: 'center' }}>
          <PromptBar
            onSend={sendMessage} loading={isLoading} dark={dark} s={s}
          />
        </div>
      )}
    </div>
  )
}

// ─── Message bubble (user vs assistant) ──────────────────────────────────

interface BubbleProps { msg: JulienMessage; s: JulienTokens; dark: boolean }

function Bubble({ msg, s, dark }: BubbleProps) {
  const { t: tr } = useTranslation('messages')
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  const email = (!msg.streaming && !msg.loading && msg.content) ? parseEmail(msg.content, tr) : null

  const copyEmail = () => {
    if (!email) return
    const formatted = [
      email.to ? `${tr('julien.email.toLabel')} : ${email.to}` : '',
      `${tr('julien.email.subjectLabel')} : ${email.subject}`,
      '',
      email.body,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(formatted).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div
          style={{
            maxWidth: '72%', padding: '13px 18px',
            borderRadius: '20px 20px 4px 20px',
            background: dark ? 'rgba(255,255,255,0.08)' : s.surface,
            border: '1px solid ' + s.border,
            fontSize: 15, lineHeight: 1.7, color: s.ink, fontWeight: 500,
          }}
        >
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16, maxWidth: 580 }}>
      <div
        style={{
          fontSize: 13, fontWeight: 700, color: s.ink,
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7,
        }}
      >
        <div
          style={{
            width: 22, height: 22, borderRadius: 7,
            background: s.black, display: 'grid', placeItems: 'center',
          }}
        >
          <JIcon name="sparkle" size={11} color={s.selInk} sw={2} />
        </div>
        {/* Nom de l'assistant MEGGA AI (marque) — cohérent avec « Megga » partout ailleurs. */}
        {'Megga'}
      </div>
      <div style={{ fontSize: 15.5, lineHeight: 1.8, color: s.ink, fontWeight: 400, paddingLeft: 30 }}>
        {msg.loading && !msg.content ? (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: 7, height: 7, borderRadius: '50%', background: s.muted,
                  animation: `jpulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        ) : email ? (
          <EmailDraft email={email} s={s} dark={dark} onCopy={copyEmail} copied={copied} />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        )}

        {msg.streaming && <StreamingIndicator dark={dark} s={s} />}
      </div>
      {!msg.loading && !msg.streaming && msg.content && !email && (
        <div style={{ paddingLeft: 30, marginTop: 12, display: 'flex', gap: 4 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(msg.content).catch(() => {})
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999, border: 0,
              background: 'transparent', color: s.muted,
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <JIcon name={copied ? 'check' : 'copy'} size={12} color="currentColor" />
            {copied ? tr('julien.actions.copied') : tr('julien.actions.copy')}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Indicateur de streaming (logo GG animé) ─────────────────────────────

function StreamingIndicator({ dark, s }: { dark: boolean; s: JulienTokens }) {
  return (
    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', animation: 'gg-fade-in .3s ease' }}>
      <div style={{ position: 'relative', width: 32, height: 32, display: 'grid', placeItems: 'center' }}>
        <div
          style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            background: dark
              ? 'radial-gradient(circle, rgba(242,240,236,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(11,12,14,0.10) 0%, transparent 70%)',
            animation: 'gg-halo 1.8s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `1.5px solid ${dark ? 'rgba(242,240,236,0.18)' : 'rgba(11,12,14,0.12)'}`,
            borderTopColor: s.ink,
            animation: 'gg-spin 1.4s linear infinite',
          }}
        />
        <svg
          viewBox="0 0 694.81 419.02" width="18" height="13"
          fill={s.ink}
          style={{ animation: 'gg-breathe 1.6s ease-in-out infinite', transformOrigin: 'center' }}
        >
          <path d="M212.94,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92C-27.8,280.23-21.84,119.65,81.31,39.5,110.93,16.49,145.39,3.92,181.93,0h31.01Z" />
          <path d="M511.94,419.01h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8h0Z" />
          <path d="M511.94,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25C402.99,19.45,441.75,4.18,482.95.02h29-.01Z" />
        </svg>
      </div>
    </div>
  )
}

// ─── EmailDraft (rendu d'un email parsé en composer card) ───────────────

interface EmailDraftProps {
  email: ParsedEmail
  s: JulienTokens
  dark: boolean
  onCopy: () => void
  copied: boolean
}

function EmailDraft({ email, s, dark, onCopy, copied }: EmailDraftProps) {
  const { t: tr } = useTranslation('messages')
  return (
    <div
      style={{
        marginTop: 4, borderRadius: 18,
        border: `1px solid ${s.border}`,
        background: dark ? 'rgba(255,255,255,0.025)' : '#FFFFFF',
        overflow: 'hidden',
        boxShadow: dark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 10px rgba(11,12,14,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px',
          borderBottom: `1px solid ${s.border}`,
          background: dark ? 'rgba(255,255,255,0.02)' : s.surfaceB,
        }}
      >
        <div
          style={{
            width: 22, height: 22, borderRadius: 7,
            background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(11,12,14,0.06)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <JIcon name="mail" size={12} color={s.ink} sw={2} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: s.ink, letterSpacing: '0.01em' }}>
          {tr('julien.email.draftTitle')}
        </div>
        <div
          style={{
            marginLeft: 6, padding: '2px 8px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: dark ? 'rgba(217,119,87,0.18)' : 'rgba(217,119,87,0.12)',
            color: '#B5582F',
          }}
        >
          {tr('julien.email.notSent')}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onCopy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 999, border: 0,
            background: copied ? (dark ? 'rgba(46,160,67,0.18)' : 'rgba(46,160,67,0.10)') : s.black,
            color: copied ? '#2EA043' : s.selInk,
            fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            transition: 'all .18s',
          }}
        >
          <JIcon name={copied ? 'check' : 'copy'} size={11} color="currentColor" sw={2.2} />
          {copied ? tr('julien.email.copied') : tr('julien.email.copyEmail')}
        </button>
      </div>

      <div style={{ padding: '4px 14px' }}>
        <div
          style={{
            display: 'flex', alignItems: 'baseline', gap: 10,
            padding: '9px 0',
            borderBottom: `1px solid ${s.border}`,
          }}
        >
          <div
            style={{
              width: 48, fontSize: 11.5, fontWeight: 700, color: s.muted,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            {tr('julien.email.toLabel')}
          </div>
          <div
            style={{
              flex: 1, fontSize: 14,
              color: email.to ? s.ink : s.muted,
              fontStyle: email.to ? 'normal' : 'italic',
            }}
          >
            {email.to || 'destinataire@email.com'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 0' }}>
          <div
            style={{
              width: 48, fontSize: 11.5, fontWeight: 700, color: s.muted,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            {tr('julien.email.subjectLabel')}
          </div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: s.ink }}>
            {email.subject}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '16px 18px 18px',
          borderTop: `1px solid ${s.border}`,
          fontSize: 14.5, lineHeight: 1.75, color: s.ink,
          whiteSpace: 'pre-wrap',
          fontFamily: '"Inter Tight", system-ui, sans-serif',
        }}
      >
        {email.body}
      </div>
    </div>
  )
}

// ─── PromptBar (textarea + send) ─────────────────────────────────────────
// Attach + mic + ContextPicker retirés : pas d'upload réel (fichiers
// silencieusement droppés à send), pas de STT wired, pas de table contextes.
// Chips séparées pour : real file upload → ai-copilot, MediaRecorder/Whisper,
// ContextPicker câblé à transactions/contacts.

interface PromptBarProps {
  onSend: (text: string) => void
  loading: boolean
  dark: boolean
  s: JulienTokens
}

function PromptBar({ onSend, loading, dark, s }: PromptBarProps) {
  const { t: tr } = useTranslation('messages')
  const [val, setVal] = useState('')

  const send = () => {
    if (!val.trim() || loading) return
    onSend(val.trim())
    setVal('')
  }
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: '100%',
          background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          borderRadius: 26,
          boxShadow: dark
            ? 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 32px 80px rgba(0,0,0,.55)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.9), 0 32px 80px rgba(15,23,42,0.12), 0 4px 16px rgba(15,23,42,0.06)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px 0' }}>
          <textarea
            value={val} onChange={e => setVal(e.target.value)} onKeyDown={onKey}
            placeholder={tr('julien.promptPlaceholder')} rows={1}
            style={{
              width: '100%', border: 0, background: 'transparent',
              color: s.ink, fontSize: 15.5, fontFamily: '"Inter Tight", system-ui, sans-serif',
              resize: 'none', outline: 'none', lineHeight: 1.65,
              maxHeight: 200, overflowY: 'auto', padding: 0,
            }}
            onInput={e => {
              const ta = e.currentTarget
              ta.style.height = 'auto'
              ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px 12px 12px' }}>
          <button
            onClick={send}
            disabled={!val.trim() && !loading}
            style={{
              width: 34, height: 34, borderRadius: 10, border: 0,
              background: val.trim() ? s.black : s.surfaceB,
              cursor: val.trim() ? 'pointer' : 'default',
              display: 'grid', placeItems: 'center',
              boxShadow: val.trim() ? '0 4px 12px rgba(11,12,14,0.2)' : 'none',
              transition: 'all .18s',
            }}
          >
            <JIcon name="send" size={15} color={val.trim() ? s.selInk : s.muted} sw={1.8} />
          </button>
        </div>
      </div>
    </div>
  )
}

