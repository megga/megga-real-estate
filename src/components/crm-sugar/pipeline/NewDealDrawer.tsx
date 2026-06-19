// MEGGA CRM Sugar v2 — New deal drawer (slide from right, 540px).
// 1:1 port from the Claude Design bundle (crm-pipeline-new-deal.jsx).
// 4 archétypes, contact existant/nouveau, bien picker, stage+value, next action,
// pré-remplissage IA depuis email/message, DateTimePicker custom.

import { useState, useEffect, useRef, type ReactNode } from 'react'
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

interface Archetype {
  id: 'buyer-search' | 'buyer-bien' | 'seller-mandate' | 'tenant'
  label: string
  sub: string
  contactType: 'buyer' | 'seller'
  needsBien: boolean
  initialStage: StageId
}

const ARCHETYPES: Archetype[] = [
  { id: 'buyer-search',   label: 'Acquéreur en recherche', sub: "Pas encore de bien identifié", contactType: 'buyer',  needsBien: false, initialStage: 'searching' },
  { id: 'buyer-bien',     label: 'Acheteur sur un bien',   sub: 'Bien déjà identifié, visite ou intérêt', contactType: 'buyer',  needsBien: true,  initialStage: 'visit-scheduled' },
  { id: 'seller-mandate', label: 'Mandat vendeur',         sub: 'Nouveau bien à publier — mandat requis', contactType: 'seller', needsBien: true,  initialStage: 'new-lead' },
  { id: 'tenant',         label: 'Locataire',              sub: 'Cycle court, KYC allégé',                contactType: 'buyer',  needsBien: true,  initialStage: 'visit-scheduled' },
]

interface NextActionKindOpt { k: 'call' | 'visit' | 'match' | 'kyc' | 'doc'; label: string; placeholder: string }
const NEXT_ACTION_KINDS: NextActionKindOpt[] = [
  { k: 'call',  label: 'Appel',     placeholder: 'Premier appel de qualification' },
  { k: 'visit', label: 'Visite',    placeholder: 'Planifier la visite du bien' },
  { k: 'match', label: 'Matching',  placeholder: 'Envoyer 3 biens du portefeuille' },
  { k: 'kyc',   label: 'KYC',       placeholder: 'Lancer le dossier de vérification LBA' },
  { k: 'doc',   label: 'Document',  placeholder: 'Préparer le bon de visite / mandat' },
]

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

export function NewDealDrawer({ open, onClose, sp, t, dark, prefill }: NewDealDrawerProps) {
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
      setActionNote('Premier appel suite au message reçu')
      setAiThinking(false)
      setAiOpen(false)
    }, 900)
  }

  async function handleCreate() {
    if (!canCreate || isPending) return
    setCreateError(null)

    // 1) Guards — surface clear errors before hitting the DB
    if (!profile?.agency_id) {
      setCreateError("Aucune agence rattachée — impossible de créer le deal")
      return
    }
    if (arch?.needsBien && isMockId(bienId)) {
      setCreateError(
        "Le bien sélectionné est un exemple de démo. Sélectionnez un bien réel du portefeuille agence.",
      )
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
          setCreateError(
            "Le contact sélectionné est un exemple de démo. Sélectionnez un contact réel.",
          )
          return
        }
        if (!contactId) {
          setCreateError('Sélectionnez un contact')
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
          ? `[${NEXT_ACTION_KINDS.find(k => k.k === actionKind)?.label ?? actionKind} — ${actionDue}] ${actionNote}`
          : undefined,
      })

      // Cache Helpers auto-invalidates `transactions` queries — pipeline
      // refreshes itself on the next render.
      setCreated(true)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      setCreateError(message)
    }
  }

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: t.overlay || 'rgba(14,20,16,.42)',
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
          <DealCreatedView sp={sp} archetype={arch}
            contact={selectedContact || newContact}
            bien={selectedBien ?? undefined}
            stage={stage} value={value}
            onClose={onClose} />
        ) : (
          <>
            <Header sp={sp} onClose={onClose} onAi={() => setAiOpen(true)} />

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 120px' }}>
              {aiOpen && (
                <AiPasteCard sp={sp} text={aiText} setText={setAiText}
                  onCancel={() => { setAiOpen(false); setAiText('') }}
                  onRun={handleAi} thinking={aiThinking} />
              )}

              <SectionHeader n="1" title="Type de deal" sp={sp} />
              <ArchetypeGrid sp={sp} value={archetype} onChange={setArch} />

              <SectionHeader n="2" title="Contact" sp={sp} />
              <ContactCard sp={sp}
                contacts={realContacts}
                mode={contactMode} setMode={setContactMode}
                query={contactQuery} setQuery={setContactQuery}
                contactId={contactId} setContactId={setContactId}
                newContact={newContact} setNewContact={setNewContact}
                contactType={arch?.contactType}
                dupContact={dupContact} />

              {arch?.needsBien && (
                <>
                  <SectionHeader n="3" title="Bien concerné" sp={sp} />
                  <BienCard sp={sp}
                    biens={realBiens}
                    query={bienQuery} setQuery={setBienQuery}
                    bienId={bienId} setBienId={setBienId}
                    archetype={arch} />
                </>
              )}

              <SectionHeader n={arch?.needsBien ? '4' : '3'} title="Étape & valeur" sp={sp} />
              <StageValueCard sp={sp}
                stage={stage} setStage={setStage}
                value={value} setValue={setValue}
                bien={selectedBien ?? undefined} archetype={arch} />

              <SectionHeader n={arch?.needsBien ? '5' : '4'} title="Prochaine action" sp={sp} />
              <NextActionCard sp={sp}
                kind={actionKind} setKind={setActionKind}
                due={actionDue} setDue={setActionDue}
                note={actionNote} setNote={setActionNote} />

              {(needsKycBanner || needsMandate) && (
                <div style={{ marginTop: 18 }}>
                  {needsMandate && (
                    <Guard sp={sp} tone="warn"
                      title="Mandat requis avant publication"
                      body="Un wizard mandat sera proposé après création — 3 documents à signer (mandat, conditions, état des lieux)." />
                  )}
                  {needsKycBanner && (
                    <Guard sp={sp} tone="info"
                      title="KYC recommandé à cette étape"
                      body="Le KYC est proposé comme prochaine action, en appui de la conformité LBA. Il n'empêche aucune étape du pipeline ; la vérification finale revient au notaire." />
                  )}
                </div>
              )}
            </div>

            <Footer sp={sp} canCreate={canCreate}
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
function Header({ sp, onClose, onAi }: { sp: SugarPalette; onClose: () => void; onAi: () => void }) {
  return (
    <div style={{
      padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 12,
      background: sp.pageBg, borderBottom: `1px solid ${sp.cardBorder}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: sp.sub,
          letterSpacing: 0.5, textTransform: 'uppercase',
        }}>Pipeline</div>
        <h2 style={{
          margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: sp.ink, letterSpacing: -0.6,
        }}>Nouveau deal</h2>
      </div>
      <button onClick={onAi} title="Pré-remplir depuis un email/message" style={{
        width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer',
        background: sp.cardBg, boxShadow: sp.shadowSm,
        display: 'grid', placeItems: 'center', fontFamily: 'inherit',
      }}>
        <SparkIcon color={sp.ink} />
      </button>
      <button onClick={onClose} aria-label="Fermer" style={{
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
  sp, text, setText, onCancel, onRun, thinking,
}: {
  sp: SugarPalette
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
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>MEGGA AI · pré-remplissage</div>
        <button onClick={onCancel} style={{
          width: 26, height: 26, borderRadius: 999, border: 0, cursor: 'pointer',
          background: 'rgba(255,255,255,.10)', color: sp.focusInk, fontSize: 14,
        }}>×</button>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Collez ici un email, une note vocale transcrite ou un message WhatsApp. L'IA en extrait le contact, le bien éventuel, le score et propose une prochaine action."
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
        }}>Annuler</button>
        <button onClick={onRun} disabled={!text || thinking} style={{
          padding: '9px 18px', borderRadius: 999, border: 0,
          cursor: text && !thinking ? 'pointer' : 'not-allowed',
          background: text && !thinking ? '#FFF' : 'rgba(255,255,255,.18)',
          color: text && !thinking ? sp.focusBg : 'rgba(255,255,255,.5)',
          fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit',
          animation: thinking ? 'ndPulse 1s infinite' : 'none',
        }}>{thinking ? 'Analyse…' : 'Extraire'}</button>
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
  sp, value, onChange,
}: { sp: SugarPalette; value: Archetype['id']; onChange: (v: Archetype['id']) => void }) {
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
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2 }}>{a.label}</div>
            <div style={{
              fontSize: 10.5, fontWeight: 500, opacity: sel ? .7 : 1,
              color: sel ? 'rgba(255,255,255,.7)' : sp.sub, lineHeight: 1.4,
            }}>{a.sub}</div>
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
  sp, mode, setMode, query, setQuery, contactId, setContactId,
  contacts, newContact, setNewContact, contactType, dupContact,
}: {
  sp: SugarPalette
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
          {mode === 'existing' ? 'Sélectionner un contact' : 'Créer un contact'}
        </div>
        <InCardSegmented<'existing' | 'new'> sp={sp} value={mode} onChange={setMode}
          options={[{ value: 'existing', label: 'Existant' }, { value: 'new', label: 'Nouveau' }]} />
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
              placeholder="Rechercher nom, email, téléphone…"
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
                      {c.email} · {c.kyc?.status === 'verified' ? 'KYC ✓' : c.kyc?.status === 'pending' ? 'KYC en cours' : 'KYC à faire'}
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
                Aucun résultat — basculez sur "Nouveau" pour créer ce contact.
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field sp={sp} label="Prénom" value={newContact.firstName}
            onChange={v => setNewContact({ ...newContact, firstName: v })} />
          <Field sp={sp} label="Nom" value={newContact.lastName}
            onChange={v => setNewContact({ ...newContact, lastName: v })} />
          <Field sp={sp} label="Email" wide value={newContact.email}
            onChange={v => setNewContact({ ...newContact, email: v })} />
          <Field sp={sp} label="Téléphone" value={newContact.phone}
            onChange={v => setNewContact({ ...newContact, phone: v })} />
          <SelectField sp={sp} label="Langue" value={newContact.lang}
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
              Contact existant trouvé : {dupContact.firstName} {dupContact.lastName}. Basculez sur "Existant" pour l'utiliser.
            </div>
          )}
        </div>
      )}
    </SugarCard>
  )
}

// ─── Bien card ─────────────────────────────────────────────────────────
function BienCard({
  sp, biens, query, setQuery, bienId, setBienId, archetype,
}: {
  sp: SugarPalette
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
        {archetype?.id === 'seller-mandate' ? 'Bien à publier (peut être créé après)' : 'Bien du portefeuille ou catalogue MEGGA'}
      </div>
      <div style={{
        height: 40, padding: '0 14px', background: sp.cardSubBg,
        border: `1px solid ${sp.cardBorder}`, borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <SearchIcon color={sp.sub} />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher titre, référence MG-…, adresse"
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
                  {b.addr} · {b.area}m² · {b.price ? crmFmtCHF(b.price) : (b.rent ? `CHF ${b.rent}/mois` : '—')}
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
          }}>Pas encore de bien identifié</button>
        )}
      </div>
    </SugarCard>
  )
}

// ─── Stage & value ─────────────────────────────────────────────────────
function StageValueCard({
  sp, stage, setStage, value, setValue, bien, archetype,
}: {
  sp: SugarPalette
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
      }}>Étape de départ</div>
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
              {stageInfo.label}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field sp={sp} label="Valeur estimée (CHF)" value={value}
          onChange={setValue}
          hint={bien ? `Auto depuis ${bien.ref}` : 'Optionnel'} />
        <div>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: sp.sub,
            letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6,
          }}>Commission estimée</div>
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
  sp, kind, setKind, due, setDue, note, setNote,
}: {
  sp: SugarPalette
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
      }}>Action à programmer</div>
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
            }}>{a.label}</button>
          )
        })}
      </div>
      <div style={{ marginBottom: 10 }}>
        <DateTimePicker sp={sp} label="Échéance" value={due} onChange={setDue} />
      </div>
      <div>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: sp.sub,
          letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6,
        }}>Note</div>
        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder={k?.placeholder}
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
  sp, canCreate, onCancel, onCreate, isPending = false, error = null,
}: {
  sp: SugarPalette
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
        }}>Annuler</button>
        <button onClick={onCreate} disabled={!enabled} style={{
          flex: 2, height: 46, borderRadius: 999, border: 0,
          cursor: enabled ? 'pointer' : 'not-allowed',
          background: enabled ? sp.ink : sp.cardSubBg,
          color: enabled ? sp.pageBg : sp.sub,
          fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
          boxShadow: enabled ? sp.focusShadow : 'none',
        }}>{isPending ? 'Création…' : 'Créer le deal'}</button>
      </div>
    </div>
  )
}

// ─── Created confirmation view ─────────────────────────────────────────
function DealCreatedView({
  sp, archetype, contact, bien, stage, value, onClose,
}: {
  sp: SugarPalette
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
          }}>✓ Deal créé</div>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink }}>{stageInfo.label}</div>
            <div style={{ flex: 1 }} />
            <div style={{
              fontSize: 16, fontWeight: 800, color: sp.ink, fontVariantNumeric: 'tabular-nums',
            }}>
              {value ? crmFmtCHF(Number(value)) : '—'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: sp.sub, fontWeight: 600 }}>
            Bien · {bien?.title || 'Recherche active'}
          </div>
          <div style={{ fontSize: 11, color: sp.sub, fontWeight: 600, marginTop: 2 }}>
            Type · {archetype?.label}
          </div>
        </SugarCard>

        <div style={{
          fontSize: 12, fontWeight: 700, color: sp.sub,
          letterSpacing: 0.4, textTransform: 'uppercase',
          margin: '24px 4px 12px',
        }}>Continuer</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <QuickAction sp={sp} label="Envoyer 3 biens" sub="Matching IA" />
          <QuickAction sp={sp} label="Planifier visite" sub="Calendrier" />
          <QuickAction sp={sp} label="Lancer KYC" sub="LBA" />
          <QuickAction sp={sp} label="Voir le détail" sub="Fiche deal" />
        </div>

        <div style={{
          marginTop: 20, padding: 14, borderRadius: 14,
          background: sp.cardSubBg, fontSize: 12, color: sp.sub, lineHeight: 1.5,
        }}>
          La timeline du deal commence ici. Les actions ci-dessus ajouteront un évènement à la fiche.
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
const ND_MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const ND_DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

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
function ndFormatDisplay(v: string): string {
  if (!v) return '—'
  const d = ndParseLocal(v)
  return `${String(d.getDate()).padStart(2, '0')} ${ND_MONTHS_FR[d.getMonth()].slice(0, 3).toLowerCase()}. ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function DateTimePicker({
  sp, label, value, onChange,
}: { sp: SugarPalette; label: string; value: string; onChange: (v: string) => void }) {
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
    { label: "Aujourd'hui 17h", days: 0, h: 17 },
    { label: 'Demain 10h', days: 1, h: 10 },
    { label: 'Dans 2 jours', days: 2, h: 10 },
    { label: 'Lundi prochain', days: ((1 - today.getDay() + 7) % 7) || 7, h: 10 },
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
        <span style={{ flex: 1, fontWeight: 600 }}>{ndFormatDisplay(value)}</span>
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
              {ND_MONTHS_FR[view.getMonth()]} {view.getFullYear()}
            </div>
            <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} style={{
              width: 28, height: 28, borderRadius: 999, border: 0, cursor: 'pointer',
              background: sp.cardSubBg, color: sp.soft, fontFamily: 'inherit', fontWeight: 700,
            }}>›</button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 10,
          }}>
            {ND_DAYS_FR.map((d, i) => (
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
            }}>Heure</div>
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
            }}>OK</button>
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
