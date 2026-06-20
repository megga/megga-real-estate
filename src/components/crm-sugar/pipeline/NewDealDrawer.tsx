// MEGGA CRM Sugar v2 — New deal drawer (slide from right, 540px).
// 1:1 port from the Claude Design bundle (crm-pipeline-new-deal.jsx).
// 4 archétypes, contact existant/nouveau, bien picker, stage+value, next action,
// pré-remplissage IA depuis email/message, DateTimePicker custom.

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CRM_STAGES, CRM_STAGE_ORDER, crmFmtCHF, crmInitials, type CrmTheme, type SugarPalette, type StageId } from '../tokens'
import {
  crmContactById, crmBienById,
  type CrmContact,
  type CrmBien,
} from '../mockData'
import { useAuth } from '@/hooks/useAuth'
import { useCreateContact } from '@/hooks/useContacts'
import { useCreateTransaction } from '@/hooks/useTransactions'
import { useContactsSugar } from '@/hooks/useContactsSugar'
import { useBiensSugar } from '@/hooks/useBiensSugar'
import { stageIdToTransactionStage } from '@/lib/sugarAdapters'

// Mock-id patterns from `src/components/crm-sugar/mockData.ts` — both `c-…`
// and `b-…` prefixes are reserved for the design-system seed data and will
// never match a real Supabase UUID. We detect them up front so the agent
// gets a clear error instead of a cryptic FK violation.
const MOCK_ID_RE = /^[bcd]-\d/

function isMockId(id: string | null | undefined): boolean {
  return !!id && MOCK_ID_RE.test(id)
}

// i18n: les libellés (label/sub/placeholder) ne sont plus codés en dur ici —
// ces constantes vivent au niveau module et ne peuvent pas appeler `t()`. On
// garde des clés stables (`labelKey`/`subKey`/`placeholderKey`) que l'UI résout
// au rendu via `t(...)`. La forme des données et les `id`/`k` restent inchangés.
interface Archetype {
  id: 'buyer-search' | 'buyer-bien' | 'seller-mandate' | 'tenant'
  labelKey: string
  subKey: string
  contactType: 'buyer' | 'seller'
  needsBien: boolean
  initialStage: StageId
}

const ARCHETYPES: Archetype[] = [
  { id: 'buyer-search',   labelKey: 'newDeal.archetype.buyerSearch.label', subKey: 'newDeal.archetype.buyerSearch.sub', contactType: 'buyer',  needsBien: false, initialStage: 'searching' },
  { id: 'buyer-bien',     labelKey: 'newDeal.archetype.buyerBien.label',   subKey: 'newDeal.archetype.buyerBien.sub',   contactType: 'buyer',  needsBien: true,  initialStage: 'visit-scheduled' },
  { id: 'seller-mandate', labelKey: 'newDeal.archetype.sellerMandate.label', subKey: 'newDeal.archetype.sellerMandate.sub', contactType: 'seller', needsBien: true,  initialStage: 'new-lead' },
  { id: 'tenant',         labelKey: 'newDeal.archetype.tenant.label',      subKey: 'newDeal.archetype.tenant.sub',      contactType: 'buyer',  needsBien: true,  initialStage: 'visit-scheduled' },
]

interface NextActionKindOpt { k: 'call' | 'visit' | 'match' | 'kyc' | 'doc'; labelKey: string; placeholderKey: string }
const NEXT_ACTION_KINDS: NextActionKindOpt[] = [
  { k: 'call',  labelKey: 'newDeal.action.call.label',  placeholderKey: 'newDeal.action.call.placeholder' },
  { k: 'visit', labelKey: 'newDeal.action.visit.label', placeholderKey: 'newDeal.action.visit.placeholder' },
  { k: 'match', labelKey: 'newDeal.action.match.label', placeholderKey: 'newDeal.action.match.placeholder' },
  { k: 'kyc',   labelKey: 'newDeal.action.kyc.label',   placeholderKey: 'newDeal.action.kyc.placeholder' },
  { k: 'doc',   labelKey: 'newDeal.action.doc.label',   placeholderKey: 'newDeal.action.doc.placeholder' },
]

// Translator type for the (rare) places that resolve a key outside JSX.
type TFunc = (key: string, params?: Record<string, unknown>) => string

// Resolve a next-action kind to its translated label. Falls back to the raw
// `k` if the kind is unknown (keeps the persisted note non-empty).
function actionKindLabel(k: NextActionKindOpt['k'], t: TFunc): string {
  const opt = NEXT_ACTION_KINDS.find(x => x.k === k)
  return opt ? t(opt.labelKey) : k
}

function defaultDueAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.toISOString().slice(0, 16)
}

interface NewDealPrefill { contactId?: string; bienId?: string; archetype?: Archetype['id'] }

interface NewDealDrawerProps {
  open: boolean
  onClose: () => void
  sp: SugarPalette
  t: CrmTheme
  dark: boolean
  prefill: NewDealPrefill | null
}

export function NewDealDrawer({ open, onClose, sp, t: theme, dark, prefill }: NewDealDrawerProps) {
  const { t } = useTranslation('pipeline')
  const [archetype, setArch] = useState<Archetype['id']>('buyer-bien')
  const [contactMode, setContactMode] = useState<'existing' | 'new'>('existing')
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactQuery, setContactQuery] = useState('')
  const [newContact, setNewContact] = useState({
    firstName: '', lastName: '', email: '', phone: '', lang: 'fr',
  })
  const [bienId, setBienId] = useState<string | null>(null)
  const [bienQuery, setBienQuery] = useState('')
  const [stage, setStage] = useState<StageId>('visit-scheduled')
  const [value, setValue] = useState('')
  const [actionKind, setActionKind] = useState<NextActionKindOpt['k']>('call')
  const [actionDue, setActionDue] = useState(defaultDueAt())
  const [actionNote, setActionNote] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [created, setCreated] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Auth + mutations — wired so the "Créer" button actually persists the
  // deal (previously a silent no-op that only flipped the `created` flag).
  const { profile } = useAuth()
  const createContact = useCreateContact()
  const createTransaction = useCreateTransaction()
  const isPending = createContact.isPending || createTransaction.isPending

  const arch = ARCHETYPES.find(a => a.id === archetype)
  useEffect(() => {
    if (arch) setStage(arch.initialStage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archetype])

  useEffect(() => {
    if (!open) return
    if (prefill?.contactId) { setContactMode('existing'); setContactId(prefill.contactId) }
    if (prefill?.bienId) setBienId(prefill.bienId)
    if (prefill?.archetype) setArch(prefill.archetype)
    setCreated(false)
  }, [open, prefill])

  useEffect(() => {
    if (!bienId) return
    const b = crmBienById(bienId)
    if (b?.price) setValue(String(b.price))
    else if (b?.rent) setValue(String(b.rent * 12))
  }, [bienId])

  // Use the registry-aware lookup so real Supabase contacts (pushed by
  // PipelineSugarV2Page via `registerLiveContact`) resolve here too.
  const selectedContact = contactId ? crmContactById(contactId) || null : null
  const selectedBien = bienId ? crmBienById(bienId) : null

  const needsKycBanner = ['interest-confirmed', 'offer', 'signed'].includes(stage)
  const needsMandate = arch?.id === 'seller-mandate'

  // Real Supabase contacts/biens — replace CRM_CONTACTS / CRM_BIENS mock arrays.
  // KYC + scores arrivent via useContactsSugar adapter (jointure kyc_cases).
  const { contacts: realContacts } = useContactsSugar()
  const { biens: realBiens } = useBiensSugar()

  const dupContact = (contactMode === 'new' && newContact.email)
    ? realContacts.find(c => c.email.toLowerCase() === newContact.email.toLowerCase())
    : null
  // Note : la détection conflictDeal (même contact + même bien) avec deals
  // mock n'avait pas de sens — on la retire. Si vraiment besoin de dédup,
  // une RPC count() sur transactions serait correcte (chip si demandé).

  const canCreate = (contactMode === 'existing' ? !!contactId : !!(newContact.firstName && newContact.lastName))
    && (!arch?.needsBien || !!bienId)

  // AI prefill : parse texte → champs newContact. Plus de hardcode "Élodie
  // Schmidt → c-003 + b-101" (mock IDs qui ne match plus rien en prod).
  const handleAi = () => {
    setAiThinking(true)
    setTimeout(() => {
      const emailMatch = aiText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
      const phoneMatch = aiText.match(/\+?\d[\d\s]{8,}/)
      const lines = aiText.split('\n').map(l => l.trim()).filter(Boolean)
      const name = (lines[0] || '').split(' ')
      setContactMode('new')
      setNewContact({
        firstName: name[0] || '',
        lastName: name.slice(1).join(' ') || '',
        email: emailMatch?.[0] || '',
        phone: phoneMatch?.[0] || '',
        lang: 'fr',
      })
      setActionKind('call')
      setActionNote(t('newDeal.ai.prefilledNote'))
      setAiThinking(false)
      setAiOpen(false)
    }, 900)
  }

  async function handleCreate() {
    if (!canCreate || isPending) return
    setCreateError(null)

    // 1) Guards — surface clear errors before hitting the DB
    if (!profile?.agency_id) {
      setCreateError(t('newDeal.error.noAgency'))
      return
    }
    if (arch?.needsBien && isMockId(bienId)) {
      setCreateError(t('newDeal.error.demoBien'))
      return
    }

    try {
      // 2) Resolve / create the contact
      let realContactId: string
      if (contactMode === 'new') {
        const contact = await createContact.mutateAsync({
          firstName: newContact.firstName,
          lastName: newContact.lastName,
          email: newContact.email,
          phone: newContact.phone || undefined,
          type: arch?.contactType ?? 'buyer',
          source: 'manual',
          // TODO: once #433 lands, pass newContact.lang via form_data
          // (the extended useCreateContact signature). Until then it's
          // dropped — non-critical (default lang inferred elsewhere).
        })
        realContactId = contact.id
      } else {
        if (isMockId(contactId)) {
          setCreateError(t('newDeal.error.demoContact'))
          return
        }
        if (!contactId) {
          setCreateError(t('newDeal.error.selectContact'))
          return
        }
        realContactId = contactId
      }

      // 3) Create the transaction (deal). Stage IDs differ between the
      // mock CRM UI (`'visit-scheduled'`) and the DB enum (`'visit_planned'`)
      // — `stageIdToTransactionStage` is the mapper.
      const isBuyerSide = arch?.contactType === 'buyer'
      await createTransaction.mutateAsync({
        agency_id: profile.agency_id,
        property_id: arch?.needsBien && bienId ? bienId : undefined,
        contact_buyer_id: isBuyerSide ? realContactId : undefined,
        contact_seller_id: !isBuyerSide ? realContactId : undefined,
        stage: stageIdToTransactionStage(stage),
        notes: actionNote
          ? `[${actionKindLabel(actionKind, t)} — ${actionDue}] ${actionNote}`
          : undefined,
      })

      // Cache Helpers auto-invalidates `transactions` queries — pipeline
      // refreshes itself on the next render.
      setCreated(true)
    } catch (e) {
      const message = e instanceof Error ? e.message : t('newDeal.error.unknown')
      setCreateError(message)
    }
  }

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: theme.overlay || 'rgba(14,20,16,.42)',
        zIndex: 80, animation: 'ndOverlay .2s ease-out',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 540, maxWidth: '100vw',
        background: dark ? sp.pageBg : '#F4F5F8',
        zIndex: 81, display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px -20px rgba(14,20,16,.30)',
        animation: 'ndDrawer .28s cubic-bezier(.2,.7,.2,1)',
        overflow: 'hidden',
      }}>
        <style>{`
          @keyframes ndDrawer { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }
          @keyframes ndOverlay { from { opacity: 0 } to { opacity: 1 } }
          @keyframes ndPulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
        `}</style>

        {created ? (
          <DealCreatedView sp={sp} t={t} archetype={arch}
            contact={selectedContact || newContact}
            bien={selectedBien ?? undefined}
            stage={stage} value={value}
            onClose={onClose} />
        ) : (
          <>
            <Header sp={sp} t={t} onClose={onClose} onAi={() => setAiOpen(true)} />

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 120px' }}>
              {aiOpen && (
                <AiPasteCard sp={sp} t={t} text={aiText} setText={setAiText}
                  onCancel={() => { setAiOpen(false); setAiText('') }}
                  onRun={handleAi} thinking={aiThinking} />
              )}

              <SectionHeader n="1" title={t('newDeal.section.dealType')} sp={sp} />
              <ArchetypeGrid sp={sp} value={archetype} onChange={setArch} t={t} />

              <SectionHeader n="2" title={t('newDeal.section.contact')} sp={sp} />
              <ContactCard sp={sp} t={t}
                contacts={realContacts}
                mode={contactMode} setMode={setContactMode}
                query={contactQuery} setQuery={setContactQuery}
                contactId={contactId} setContactId={setContactId}
                newContact={newContact} setNewContact={setNewContact}
                contactType={arch?.contactType}
                dupContact={dupContact} />

              {arch?.needsBien && (
                <>
                  <SectionHeader n="3" title={t('newDeal.section.bien')} sp={sp} />
                  <BienCard sp={sp} t={t}
                    biens={realBiens}
                    query={bienQuery} setQuery={setBienQuery}
                    bienId={bienId} setBienId={setBienId}
                    archetype={arch} />
                </>
              )}

              <SectionHeader n={arch?.needsBien ? '4' : '3'} title={t('newDeal.section.stageValue')} sp={sp} />
              <StageValueCard sp={sp} t={t}
                stage={stage} setStage={setStage}
                value={value} setValue={setValue}
                bien={selectedBien ?? undefined} archetype={arch} />

              <SectionHeader n={arch?.needsBien ? '5' : '4'} title={t('newDeal.section.nextAction')} sp={sp} />
              <NextActionCard sp={sp} t={t}
                kind={actionKind} setKind={setActionKind}
                due={actionDue} setDue={setActionDue}
                note={actionNote} setNote={setActionNote} />

              {(needsKycBanner || needsMandate) && (
                <div style={{ marginTop: 18 }}>
                  {needsMandate && (
                    <Guard sp={sp} tone="warn"
                      title={t('newDeal.guard.mandate.title')}
                      body={t('newDeal.guard.mandate.body')} />
                  )}
                  {needsKycBanner && (
                    <Guard sp={sp} tone="info"
                      title={t('newDeal.guard.kyc.title')}
                      body={t('newDeal.guard.kyc.body')} />
                  )}
                </div>
              )}
            </div>

            <Footer sp={sp} t={t} canCreate={canCreate}
              onCancel={onClose}
              onCreate={handleCreate}
              isPending={isPending}
              error={createError} />
          </>
        )}
      </div>
    </>
  )
}

// ─── Header ────────────────────────────────────────────────────────────
function Header({ sp, t, onClose, onAi }: { sp: SugarPalette; t: TFunc; onClose: () => void; onAi: () => void }) {
  return (
    <div style={{
      padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 12,
      background: sp.pageBg, borderBottom: `1px solid ${sp.cardBorder}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: sp.sub,
          letterSpacing: 0.5, textTransform: 'uppercase',
        }}>{t('title')}</div>
        <h2 style={{
          margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: sp.ink, letterSpacing: -0.6,
        }}>{t('new_deal')}</h2>
      </div>
      <button onClick={onAi} title={t('newDeal.ai.buttonTitle')} style={{
        width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer',
        background: sp.cardBg, boxShadow: sp.shadowSm,
        display: 'grid', placeItems: 'center', fontFamily: 'inherit',
      }}>
        <SparkIcon color={sp.ink} />
      </button>
      <button onClick={onClose} aria-label={t('common:actions.close')} style={{
        width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer',
        background: sp.cardBg, boxShadow: sp.shadowSm,
        display: 'grid', placeItems: 'center', fontFamily: 'inherit',
        fontSize: 18, color: sp.soft,
      }}>×</button>
    </div>
  )
}

function SparkIcon({ color = '#0E1410' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5l1.4 4.1L13.5 7l-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4L8 1.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill="none" />
      <path d="M13 11.5l.5 1.4 1.4.6-1.4.5-.5 1.5-.5-1.5-1.5-.5 1.5-.6.5-1.4z" fill={color} />
    </svg>
  )
}

// ─── AI Paste card ─────────────────────────────────────────────────────
function AiPasteCard({
  sp, t, text, setText, onCancel, onRun, thinking,
}: {
  sp: SugarPalette
  t: TFunc
  text: string
  setText: (v: string) => void
  onCancel: () => void
  onRun: () => void
  thinking: boolean
}) {
  return (
    <div style={{
      background: sp.focusBg, color: sp.focusInk,
      borderRadius: 18, padding: 16, marginTop: 16, marginBottom: 8,
      boxShadow: sp.focusShadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <SparkIcon color={sp.focusInk} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>{t('newDeal.ai.title')}</div>
        <button onClick={onCancel} style={{
          width: 26, height: 26, borderRadius: 999, border: 0, cursor: 'pointer',
          background: 'rgba(255,255,255,.10)', color: sp.focusInk, fontSize: 14,
        }}>×</button>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t('newDeal.ai.placeholder')}
        style={{
          width: '100%', minHeight: 100, padding: 12, borderRadius: 12,
          background: 'rgba(255,255,255,.07)', color: sp.focusInk,
          border: '1px solid rgba(255,255,255,.12)',
          fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
          lineHeight: 1.5, boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
        <button onClick={onCancel} style={{
          padding: '9px 16px', borderRadius: 999, border: 0, cursor: 'pointer',
          background: 'transparent', color: 'rgba(255,255,255,.7)',
          fontWeight: 600, fontSize: 12.5, fontFamily: 'inherit',
        }}>{t('common:actions.cancel')}</button>
        <button onClick={onRun} disabled={!text || thinking} style={{
          padding: '9px 18px', borderRadius: 999, border: 0,
          cursor: text && !thinking ? 'pointer' : 'not-allowed',
          background: text && !thinking ? '#FFF' : 'rgba(255,255,255,.18)',
          color: text && !thinking ? sp.focusBg : 'rgba(255,255,255,.5)',
          fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit',
          animation: thinking ? 'ndPulse 1s infinite' : 'none',
        }}>{thinking ? t('newDeal.ai.analyzing') : t('newDeal.ai.extract')}</button>
      </div>
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────
function SectionHeader({ n, title, sp }: { n: string; title: string; sp: SugarPalette }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, margin: '26px 4px 12px',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 999,
        background: sp.ink, color: sp.pageBg,
        display: 'grid', placeItems: 'center',
        fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
      }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}>{title}</div>
    </div>
  )
}

// ─── Archetype grid ────────────────────────────────────────────────────
function ArchetypeGrid({
  sp, t, value, onChange,
}: { sp: SugarPalette; t: TFunc; value: Archetype['id']; onChange: (v: Archetype['id']) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {ARCHETYPES.map(a => {
        const sel = a.id === value
        return (
          <button key={a.id} onClick={() => onChange(a.id)} style={{
            textAlign: 'left', padding: 14, borderRadius: 16,
            background: sel ? sp.focusBg : sp.cardBg,
            border: sel ? '0' : `1px solid ${sp.cardBorder}`,
            color: sel ? sp.focusInk : sp.ink,
            boxShadow: sel ? sp.focusShadow : sp.shadowSm,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2 }}>{t(a.labelKey)}</div>
            <div style={{
              fontSize: 10.5, fontWeight: 500, opacity: sel ? .7 : 1,
              color: sel ? 'rgba(255,255,255,.7)' : sp.sub, lineHeight: 1.4,
            }}>{t(a.subKey)}</div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Card wrapper ──────────────────────────────────────────────────────
function SugarCard({ sp, children }: { sp: SugarPalette; children: ReactNode }) {
  return (
    <div style={{
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
      borderRadius: 18, padding: 16, boxShadow: sp.shadow,
    }}>{children}</div>
  )
}

// ─── In-card segmented ─────────────────────────────────────────────────
function InCardSegmented<T extends string>({
  sp, value, options, onChange,
}: { sp: SugarPalette; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{
      display: 'flex', padding: 3, background: sp.cardSubBg,
      border: `1px solid ${sp.cardBorder}`, borderRadius: 999, gap: 2, alignSelf: 'flex-start',
    }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '6px 14px', borderRadius: 999, border: 0, cursor: 'pointer',
          background: value === o.value ? sp.ink : 'transparent',
          color: value === o.value ? sp.pageBg : sp.soft,
          fontSize: 11.5, fontWeight: value === o.value ? 700 : 600,
          fontFamily: 'inherit',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

// ─── Contact card ──────────────────────────────────────────────────────
function ContactCard({
  sp, t, mode, setMode, query, setQuery, contactId, setContactId,
  contacts, newContact, setNewContact, contactType, dupContact,
}: {
  sp: SugarPalette
  t: TFunc
  contacts: CrmContact[]
  mode: 'existing' | 'new'
  setMode: (v: 'existing' | 'new') => void
  query: string
  setQuery: (v: string) => void
  contactId: string | null
  setContactId: (id: string) => void
  newContact: { firstName: string; lastName: string; email: string; phone: string; lang: string }
  setNewContact: (v: { firstName: string; lastName: string; email: string; phone: string; lang: string }) => void
  contactType?: 'buyer' | 'seller'
  dupContact: CrmContact | null | undefined
}) {
  // Liste réelle des contacts de l'agence (useContactsSugar amont).
  const list = contacts
    .filter(c => contactType ? (c.type === contactType || c.type === 'mixed') : true)
    .filter(c => {
      if (!query) return true
      const q = query.toLowerCase()
      return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
        || c.email.toLowerCase().includes(q)
        || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
    })
    .slice(0, 6)

  return (
    <SugarCard sp={sp}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: sp.sub,
          letterSpacing: 0.4, textTransform: 'uppercase',
        }}>
          {mode === 'existing' ? t('newDeal.contact.selectTitle') : t('newDeal.contact.createTitle')}
        </div>
        <InCardSegmented<'existing' | 'new'> sp={sp} value={mode} onChange={setMode}
          options={[{ value: 'existing', label: t('newDeal.contact.existing') }, { value: 'new', label: t('newDeal.contact.new') }]} />
      </div>

      {mode === 'existing' ? (
        <>
          <div style={{
            height: 40, padding: '0 14px', background: sp.cardSubBg,
            border: `1px solid ${sp.cardBorder}`, borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <SearchIcon color={sp.sub} />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder={t('newDeal.contact.searchPlaceholder')}
              style={{
                flex: 1, background: 'transparent', border: 0, outline: 'none',
                color: sp.ink, fontSize: 13, fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map(c => {
              const sel = c.id === contactId
              return (
                <button key={c.id} onClick={() => setContactId(c.id)} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 12,
                  background: sel ? sp.focusBg : 'transparent',
                  border: sel ? 0 : '1px solid transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  fontFamily: 'inherit',
                  boxShadow: sel ? sp.focusShadow : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 999,
                    background: c.avatarBg || '#0041D9', color: '#fff',
                    display: 'grid', placeItems: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: sel ? sp.focusInk : sp.ink,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {c.firstName} {c.lastName}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: sel ? 'rgba(255,255,255,.65)' : sp.sub, marginTop: 1,
                    }}>
                      {c.email} · {c.kyc?.status === 'verified' ? t('newDeal.contact.kycVerified') : c.kyc?.status === 'pending' ? t('newDeal.contact.kycPending') : t('newDeal.contact.kycTodo')}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 800,
                    color: sel ? sp.focusInk : sp.ink,
                    padding: '3px 8px', borderRadius: 999,
                    background: sel ? 'rgba(255,255,255,.12)' : sp.cardSubBg,
                    fontVariantNumeric: 'tabular-nums',
                  }}>{c.score}</div>
                </button>
              )
            })}
            {list.length === 0 && (
              <div style={{ padding: '16px 12px', fontSize: 12, color: sp.sub, textAlign: 'center' }}>
                {t('newDeal.contact.empty')}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field sp={sp} label={t('newDeal.contact.firstName')} value={newContact.firstName}
            onChange={v => setNewContact({ ...newContact, firstName: v })} />
          <Field sp={sp} label={t('newDeal.contact.lastName')} value={newContact.lastName}
            onChange={v => setNewContact({ ...newContact, lastName: v })} />
          <Field sp={sp} label={t('newDeal.contact.email')} wide value={newContact.email}
            onChange={v => setNewContact({ ...newContact, email: v })} />
          <Field sp={sp} label={t('newDeal.contact.phone')} value={newContact.phone}
            onChange={v => setNewContact({ ...newContact, phone: v })} />
          <SelectField sp={sp} label={t('newDeal.contact.language')} value={newContact.lang}
            onChange={v => setNewContact({ ...newContact, lang: v })}
            options={[
              { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' },
              { value: 'de', label: 'Deutsch' }, { value: 'it', label: 'Italiano' },
            ]} />
          {dupContact && (
            <div style={{
              gridColumn: '1 / -1', marginTop: 4,
              padding: '8px 12px', borderRadius: 10,
              background: '#FEF3DB', color: '#925700',
              fontSize: 11.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              {t('newDeal.contact.duplicate', { name: `${dupContact.firstName} ${dupContact.lastName}` })}
            </div>
          )}
        </div>
      )}
    </SugarCard>
  )
}

// ─── Bien card ─────────────────────────────────────────────────────────
function BienCard({
  sp, t, biens, query, setQuery, bienId, setBienId, archetype,
}: {
  sp: SugarPalette
  t: TFunc
  biens: CrmBien[]
  query: string
  setQuery: (v: string) => void
  bienId: string | null
  setBienId: (id: string | null) => void
  archetype: Archetype | undefined
}) {
  // Liste réelle des biens de l'agence (useBiensSugar amont).
  const list = biens
    .filter(b => {
      if (!query) return true
      const q = query.toLowerCase()
      return b.title.toLowerCase().includes(q)
        || b.ref.toLowerCase().includes(q)
        || b.addr.toLowerCase().includes(q)
    })
    .slice(0, 5)

  return (
    <SugarCard sp={sp}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12,
      }}>
        {archetype?.id === 'seller-mandate' ? t('newDeal.bien.toPublish') : t('newDeal.bien.fromPortfolio')}
      </div>
      <div style={{
        height: 40, padding: '0 14px', background: sp.cardSubBg,
        border: `1px solid ${sp.cardBorder}`, borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <SearchIcon color={sp.sub} />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t('newDeal.bien.searchPlaceholder')}
          style={{
            flex: 1, background: 'transparent', border: 0, outline: 'none',
            color: sp.ink, fontSize: 13, fontFamily: 'inherit',
          }}
        />
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map(b => {
          const sel = b.id === bienId
          return (
            <button key={b.id} onClick={() => setBienId(b.id)} style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 12,
              background: sel ? sp.focusBg : 'transparent',
              cursor: 'pointer', border: 0,
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: 'inherit',
              boxShadow: sel ? sp.focusShadow : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: b.accent || '#0041D9', flexShrink: 0,
                display: 'grid', placeItems: 'center', color: '#fff',
                fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
              }}>{b.ref.split('-').pop()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: sel ? sp.focusInk : sp.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{b.title}</div>
                <div style={{
                  fontSize: 11,
                  color: sel ? 'rgba(255,255,255,.65)' : sp.sub,
                  marginTop: 1, fontVariantNumeric: 'tabular-nums',
                }}>
                  {b.addr} · {b.area}m² · {b.price ? crmFmtCHF(b.price) : (b.rent ? t('newDeal.bien.rentPerMonth', { amount: b.rent }) : '—')}
                </div>
              </div>
            </button>
          )
        })}
        {archetype?.id === 'buyer-search' && (
          <button onClick={() => setBienId(null)} style={{
            padding: '10px 12px', borderRadius: 12,
            background: !bienId ? sp.cardSubBg : 'transparent',
            cursor: 'pointer', border: `1px dashed ${sp.cardBorder}`,
            color: sp.sub, fontSize: 12, fontWeight: 600, textAlign: 'center',
            fontFamily: 'inherit',
          }}>{t('newDeal.bien.noneIdentified')}</button>
        )}
      </div>
    </SugarCard>
  )
}

// ─── Stage & value ─────────────────────────────────────────────────────
function StageValueCard({
  sp, t, stage, setStage, value, setValue, bien, archetype,
}: {
  sp: SugarPalette
  t: TFunc
  stage: StageId
  setStage: (s: StageId) => void
  value: string
  setValue: (v: string) => void
  bien: ReturnType<typeof crmBienById>
  archetype: Archetype | undefined
}) {
  const visibleStages = CRM_STAGE_ORDER.filter(s => {
    if (archetype?.id === 'buyer-search') return ['new-lead', 'to-qualify', 'searching'].includes(s)
    if (archetype?.id === 'seller-mandate') return ['new-lead', 'to-qualify'].includes(s)
    return !['new-lead'].includes(s)
  })

  return (
    <SugarCard sp={sp}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12,
      }}>{t('newDeal.stage.startLabel')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {visibleStages.map(s => {
          const sel = s === stage
          const stageInfo = CRM_STAGES[s]
          return (
            <button key={s} onClick={() => setStage(s)} style={{
              padding: '7px 12px', borderRadius: 999,
              background: sel ? sp.ink : sp.cardSubBg,
              border: 0, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, fontWeight: sel ? 700 : 600,
              color: sel ? sp.pageBg : sp.soft,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: stageInfo.color }} />
              {t(`stages.${s}`)}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field sp={sp} label={t('newDeal.stage.estimatedValue')} value={value}
          onChange={setValue}
          hint={bien ? t('newDeal.stage.autoFromRef', { ref: bien.ref }) : t('newDeal.stage.optional')} />
        <div>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: sp.sub,
            letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6,
          }}>{t('newDeal.stage.estimatedCommission')}</div>
          <div style={{
            height: 40, padding: '0 14px', borderRadius: 12,
            background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
            display: 'flex', alignItems: 'center', color: sp.ink,
            fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          }}>
            {value ? crmFmtCHF(Math.round(Number(value) * 0.03)) : '—'}
            <span style={{ fontSize: 10.5, color: sp.sub, marginLeft: 6, fontWeight: 600 }}>3%</span>
          </div>
        </div>
      </div>
    </SugarCard>
  )
}

// ─── Next action ───────────────────────────────────────────────────────
function NextActionCard({
  sp, t, kind, setKind, due, setDue, note, setNote,
}: {
  sp: SugarPalette
  t: TFunc
  kind: NextActionKindOpt['k']
  setKind: (k: NextActionKindOpt['k']) => void
  due: string
  setDue: (v: string) => void
  note: string
  setNote: (v: string) => void
}) {
  const k = NEXT_ACTION_KINDS.find(x => x.k === kind)
  return (
    <SugarCard sp={sp}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12,
      }}>{t('newDeal.action.scheduleLabel')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {NEXT_ACTION_KINDS.map(a => {
          const sel = a.k === kind
          return (
            <button key={a.k} onClick={() => setKind(a.k)} style={{
              padding: '7px 14px', borderRadius: 999,
              background: sel ? sp.ink : sp.cardSubBg,
              color: sel ? sp.pageBg : sp.soft,
              border: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11.5, fontWeight: sel ? 700 : 600,
            }}>{t(a.labelKey)}</button>
          )
        })}
      </div>
      <div style={{ marginBottom: 10 }}>
        <DateTimePicker sp={sp} t={t} label={t('newDeal.action.dueLabel')} value={due} onChange={setDue} />
      </div>
      <div>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: sp.sub,
          letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6,
        }}>{t('newDeal.action.noteLabel')}</div>
        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder={k ? t(k.placeholderKey) : undefined}
          style={{
            width: '100%', minHeight: 64, padding: 12, borderRadius: 12,
            background: sp.cardSubBg, color: sp.ink,
            border: `1px solid ${sp.cardBorder}`,
            fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
            lineHeight: 1.5, boxSizing: 'border-box',
          }}
        />
      </div>
    </SugarCard>
  )
}

// ─── Field primitives ──────────────────────────────────────────────────
function Field({
  sp, label, value, onChange, type = 'text', hint, wide,
}: {
  sp: SugarPalette
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  hint?: string
  wide?: boolean
}) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', height: 40, padding: '0 14px', borderRadius: 12,
          background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
          color: sp.ink, fontSize: 13, fontFamily: 'inherit', outline: 'none',
          fontVariantNumeric: type === 'datetime-local' ? 'tabular-nums' : 'normal',
          boxSizing: 'border-box',
        }}
      />
      {hint && <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 4, fontWeight: 600 }}>{hint}</div>}
    </div>
  )
}

function SelectField({
  sp, label, value, onChange, options,
}: {
  sp: SugarPalette
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', height: 40, padding: '0 14px', borderRadius: 12,
          background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
          color: sp.ink, fontSize: 13, fontFamily: 'inherit', outline: 'none',
          appearance: 'none', cursor: 'pointer', boxSizing: 'border-box',
        }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ─── Guard banners ─────────────────────────────────────────────────────
function Guard({
  tone, title, body,
}: {
  sp: SugarPalette
  tone: 'info' | 'warn' | 'danger'
  title: string
  body: string
}) {
  const colors = {
    info:   { bg: '#E8EFFE', fg: '#0033AC', dot: '#0041D9' },
    warn:   { bg: '#FEF3DB', fg: '#925700', dot: '#F59E0B' },
    danger: { bg: '#FDECEA', fg: '#A11C16', dot: '#E53935' },
  }[tone]
  return (
    <div style={{
      background: colors.bg, color: colors.fg,
      padding: '12px 14px', borderRadius: 14, marginTop: 8,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999, background: colors.dot, marginTop: 6, flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.5, opacity: .85 }}>{body}</div>
      </div>
    </div>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────
function Footer({
  sp, t, canCreate, onCancel, onCreate, isPending = false, error = null,
}: {
  sp: SugarPalette
  t: TFunc
  canCreate: boolean
  onCancel: () => void
  onCreate: () => void
  isPending?: boolean
  error?: string | null
}) {
  const enabled = canCreate && !isPending
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: '16px 24px',
      background: sp.pageBg, borderTop: `1px solid ${sp.cardBorder}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {error && (
        <div role="alert" style={{
          background: '#FEF2F2', color: '#B91C1C',
          border: '1px solid #FCA5A5', borderRadius: 10,
          padding: '8px 12px', fontSize: 12, fontWeight: 600, lineHeight: 1.4,
        }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={onCancel} disabled={isPending} style={{
          flex: 1, height: 46, borderRadius: 999, border: 0,
          cursor: isPending ? 'not-allowed' : 'pointer',
          background: 'transparent', color: sp.soft,
          fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
          opacity: isPending ? 0.5 : 1,
        }}>{t('common:actions.cancel')}</button>
        <button onClick={onCreate} disabled={!enabled} style={{
          flex: 2, height: 46, borderRadius: 999, border: 0,
          cursor: enabled ? 'pointer' : 'not-allowed',
          background: enabled ? sp.ink : sp.cardSubBg,
          color: enabled ? sp.pageBg : sp.sub,
          fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
          boxShadow: enabled ? sp.focusShadow : 'none',
        }}>{isPending ? t('newDeal.footer.creating') : t('newDeal.footer.create')}</button>
      </div>
    </div>
  )
}

// ─── Created confirmation view ─────────────────────────────────────────
function DealCreatedView({
  sp, t, archetype, contact, bien, stage, value, onClose,
}: {
  sp: SugarPalette
  t: TFunc
  archetype: Archetype | undefined
  contact: { firstName?: string; lastName?: string }
  bien: ReturnType<typeof crmBienById>
  stage: StageId
  value: string
  onClose: () => void
}) {
  const stageInfo = CRM_STAGES[stage]
  const fullName = contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '—' : '—'
  return (
    <>
      <div style={{
        padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 12,
        background: sp.pageBg, borderBottom: `1px solid ${sp.cardBorder}`,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#0E9F6E',
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>✓ {t('newDeal.created.badge')}</div>
          <h2 style={{
            margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: sp.ink, letterSpacing: -0.6,
          }}>{fullName}</h2>
        </div>
        <button onClick={onClose} style={{
          width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer',
          background: sp.cardBg, boxShadow: sp.shadowSm,
          display: 'grid', placeItems: 'center', fontFamily: 'inherit',
          fontSize: 18, color: sp.soft,
        }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 100px' }}>
        <SugarCard sp={sp}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: stageInfo.color }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink }}>{t(`stages.${stage}`)}</div>
            <div style={{ flex: 1 }} />
            <div style={{
              fontSize: 16, fontWeight: 800, color: sp.ink, fontVariantNumeric: 'tabular-nums',
            }}>
              {value ? crmFmtCHF(Number(value)) : '—'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: sp.sub, fontWeight: 600 }}>
            {t('newDeal.created.bienLine', { title: bien?.title || t('newDeal.created.activeSearch') })}
          </div>
          <div style={{ fontSize: 11, color: sp.sub, fontWeight: 600, marginTop: 2 }}>
            {t('newDeal.created.typeLine', { type: archetype ? t(archetype.labelKey) : '—' })}
          </div>
        </SugarCard>

        <div style={{
          fontSize: 12, fontWeight: 700, color: sp.sub,
          letterSpacing: 0.4, textTransform: 'uppercase',
          margin: '24px 4px 12px',
        }}>{t('newDeal.created.continue')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <QuickAction sp={sp} label={t('newDeal.created.quickMatch.label')} sub={t('newDeal.created.quickMatch.sub')} />
          <QuickAction sp={sp} label={t('newDeal.created.quickVisit.label')} sub={t('newDeal.created.quickVisit.sub')} />
          <QuickAction sp={sp} label={t('newDeal.created.quickKyc.label')} sub={t('newDeal.created.quickKyc.sub')} />
          <QuickAction sp={sp} label={t('newDeal.created.quickDetail.label')} sub={t('newDeal.created.quickDetail.sub')} />
        </div>

        <div style={{
          marginTop: 20, padding: 14, borderRadius: 14,
          background: sp.cardSubBg, fontSize: 12, color: sp.sub, lineHeight: 1.5,
        }}>
          {t('newDeal.created.timelineNote')}
        </div>
      </div>
    </>
  )
}

function QuickAction({ sp, label, sub }: { sp: SugarPalette; label: string; sub: string }) {
  return (
    <button style={{
      textAlign: 'left', padding: 14, borderRadius: 14, border: 0,
      background: sp.cardBg, boxShadow: sp.shadowSm,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}>{label}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: sp.sub, marginTop: 3 }}>{sub}</div>
    </button>
  )
}

function SearchIcon({ color = '#7A8079' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke={color} strokeWidth="1.5" />
      <path d="M11 11l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── DateTime picker ───────────────────────────────────────────────────
// i18n: les noms de mois / initiales de jours viennent de la locale via `t`
// (clés `newDeal.datetime.months` / `.daysShort`, tableaux `returnObjects`).

function ndParseLocal(v: string): Date {
  if (!v) return new Date()
  const [d, t] = v.split('T')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = (t || '10:00').split(':').map(Number)
  return new Date(y, mo - 1, da, h || 0, mi || 0)
}
function ndFormatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function ndFormatDisplay(v: string, months: string[]): string {
  if (!v) return '—'
  const d = ndParseLocal(v)
  return `${String(d.getDate()).padStart(2, '0')} ${(months[d.getMonth()] || '').slice(0, 3).toLowerCase()}. ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function DateTimePicker({
  sp, t, label, value, onChange,
}: { sp: SugarPalette; t: TFunc; label: string; value: string; onChange: (v: string) => void }) {
  // `returnObjects` yields the locale's arrays; guard against a missing key
  // (i18next returns the key string in that case) so `.map()`/index access
  // never crash the picker.
  const monthsRaw = t('newDeal.datetime.months', { returnObjects: true })
  const daysRaw = t('newDeal.datetime.daysShort', { returnObjects: true })
  const months = (Array.isArray(monthsRaw) ? monthsRaw : []) as string[]
  const daysShort = (Array.isArray(daysRaw) ? daysRaw : []) as string[]
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<Date>(() => ndParseLocal(value))
  const ref = useRef<HTMLDivElement>(null)
  const current = ndParseLocal(value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const monthStart = new Date(view.getFullYear(), view.getMonth(), 1)
  const startDay = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date(); today.setHours(0, 0, 0, 0)

  const setDay = (d: number) => {
    const next = new Date(view.getFullYear(), view.getMonth(), d, current.getHours(), current.getMinutes())
    onChange(ndFormatLocal(next))
  }
  const setHM = (h: number, m: number) => {
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate(), h, m)
    onChange(ndFormatLocal(next))
  }

  const quicks = [
    { label: t('newDeal.datetime.today17'), days: 0, h: 17 },
    { label: t('newDeal.datetime.tomorrow10'), days: 1, h: 10 },
    { label: t('newDeal.datetime.inTwoDays'), days: 2, h: 10 },
    { label: t('newDeal.datetime.nextMonday'), days: ((1 - today.getDay() + 7) % 7) || 7, h: 10 },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</div>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', height: 40, padding: '0 14px', borderRadius: 12,
        background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
        color: sp.ink, fontSize: 13, fontFamily: 'inherit', outline: 'none',
        cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
      }}>
        <CalIcon color={sp.sub} />
        <span style={{ flex: 1, fontWeight: 600 }}>{ndFormatDisplay(value, months)}</span>
        <span style={{ fontSize: 10.5, color: sp.sub, fontWeight: 600 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
          background: sp.cardBg, borderRadius: 18,
          border: `1px solid ${sp.cardBorder}`, boxShadow: sp.shadow,
          padding: 14, zIndex: 100, backdropFilter: 'blur(12px)',
          animation: 'ndPop .18s cubic-bezier(.2,.7,.2,1)',
        }}>
          <style>{`@keyframes ndPop { from { transform: translateY(4px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {quicks.map(q => (
              <button key={q.label} onClick={() => {
                const d = new Date(); d.setDate(d.getDate() + q.days); d.setHours(q.h, 0, 0, 0)
                onChange(ndFormatLocal(d)); setView(d)
              }} style={{
                padding: '6px 12px', borderRadius: 999, border: 0, cursor: 'pointer',
                background: sp.cardSubBg, color: sp.soft, fontFamily: 'inherit',
                fontSize: 11, fontWeight: 600,
              }}>{q.label}</button>
            ))}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10, padding: '0 4px',
          }}>
            <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} style={{
              width: 28, height: 28, borderRadius: 999, border: 0, cursor: 'pointer',
              background: sp.cardSubBg, color: sp.soft, fontFamily: 'inherit', fontWeight: 700,
            }}>‹</button>
            <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}>
              {months[view.getMonth()]} {view.getFullYear()}
            </div>
            <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} style={{
              width: 28, height: 28, borderRadius: 999, border: 0, cursor: 'pointer',
              background: sp.cardSubBg, color: sp.soft, fontFamily: 'inherit', fontWeight: 700,
            }}>›</button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 10,
          }}>
            {daysShort.map((d, i) => (
              <div key={i} style={{
                fontSize: 10, color: sp.sub, fontWeight: 700,
                textAlign: 'center', padding: '4px 0',
              }}>{d}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />
              const cellDate = new Date(view.getFullYear(), view.getMonth(), d)
              const isSel = cellDate.toDateString() === current.toDateString()
              const isToday = cellDate.toDateString() === today.toDateString()
              const isPast = cellDate < today
              return (
                <button key={i} onClick={() => setDay(d)} disabled={isPast && !isSel} style={{
                  height: 32, borderRadius: 10, border: 0,
                  cursor: isPast && !isSel ? 'not-allowed' : 'pointer',
                  background: isSel ? sp.ink : 'transparent',
                  color: isSel ? sp.pageBg : (isPast ? sp.sub : sp.ink),
                  fontSize: 12, fontWeight: isSel || isToday ? 700 : 500,
                  fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
                  position: 'relative',
                  opacity: isPast && !isSel ? .35 : 1,
                  boxShadow: isSel ? sp.focusShadow : 'none',
                }}>
                  {d}
                  {isToday && !isSel && (
                    <span style={{
                      position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                      width: 3, height: 3, borderRadius: 999, background: sp.ink,
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          <div style={{
            borderTop: `1px solid ${sp.cardBorder}`, paddingTop: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: sp.sub,
              letterSpacing: 0.3, textTransform: 'uppercase',
            }}>{t('newDeal.datetime.time')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              <select value={current.getHours()} onChange={e => setHM(Number(e.target.value), current.getMinutes())} style={{
                height: 32, padding: '0 10px', borderRadius: 10,
                background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
                color: sp.ink, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                outline: 'none', cursor: 'pointer', appearance: 'none',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                ))}
              </select>
              <span style={{ color: sp.sub, fontWeight: 700 }}>:</span>
              <select
                value={current.getMinutes() - (current.getMinutes() % 5)}
                onChange={e => setHM(current.getHours(), Number(e.target.value))}
                style={{
                  height: 32, padding: '0 10px', borderRadius: 10,
                  background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
                  color: sp.ink, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                  outline: 'none', cursor: 'pointer', appearance: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <button onClick={() => setOpen(false)} style={{
              padding: '8px 16px', borderRadius: 999, border: 0, cursor: 'pointer',
              background: sp.ink, color: sp.pageBg, fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700, boxShadow: sp.focusShadow,
            }}>{t('newDeal.datetime.ok')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CalIcon({ color = '#7A8079' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3.5" width="12" height="11" rx="2" stroke={color} strokeWidth="1.4" />
      <path d="M2 6.5h12M5.5 2v3M10.5 2v3" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export type { NewDealPrefill }
