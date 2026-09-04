/**
 * MEGGA CRM — Fiche deal V4 « Atelier scindé » (route /dashboard/transactions/:id, desktop).
 * Port 1:1 du handoff crm-screen-deal-detail-v4.jsx (concept C acté, juillet 2026),
 * qui remplace la V3 : deux moitiés — L'ACHETEUR (identité, critères, coordonnées,
 * KYC non-bloquant) à gauche, L'AFFAIRE (barre d'étape 8 segments, prochaine
 * action, matching lead OU négociation) à droite. Zéro animation de survol.
 *
 * Câblage prod : useTransaction/useContact/useProperty (Supabase), offres via
 * useOfferChain + useUpdateOfferStatus (accepter passe aussi status='completed' —
 * le deal gagné sort du board), prochaine action via useTransactionNextReminder,
 * matching lead = port exact de dsMatches sur le portefeuille actif (useListingsScreen,
 * % calculé jamais stocké), « Transmettre » → /dashboard/matching?contact= (l'atelier
 * lit déjà ce param). Fix hérité de la V3 : le deep-link KYC utilise ?openContactId=
 * (la page KYC ne lit pas ?contactId=).
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CrmIcon } from '@/components/crm-dossiers/icons'
import { fmtDateTime } from '@/components/crm-dossiers/tokens'
import {
  CRM_STAGE_ORDER, crmPalette, type StageId,
} from '@/components/crm/tokens'
import { mapTransactionStageToStepper } from '@/components/crm-dossiers/dealStepper'
import OfferModal from '@/components/crm-dossiers/offer-modal/OfferModal'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import { CrmSidebar } from '@/components/crm/CrmSidebar'
import {
  useTransaction, useUpdateTransactionStage, useUpdateTransactionStatus,
  type ContactTransaction,
} from '@/hooks/useTransactions'
import { useContact } from '@/hooks/useContacts'
import { useProperty } from '@/hooks/useProperties'
import { useOfferChain, lastOffer, useUpdateOfferStatus } from '@/hooks/useOffers'
import { useKycDossierByContact } from '@/hooks/useKycDossier'
import { useTransactionNextReminder } from '@/hooks/usePipelineNextActions'
import { useListingsScreen } from '@/hooks/useListingsScreen'
import { mapCriteria } from '@/lib/crmAdapters'
import { dsPalette, type DsPal } from '@/components/crm-dossiers/dealTokens'
import { encreSur } from '@/components/megga-x-crm/tokens'
import type { CrmBien, CrmContact } from '@/components/crm/mockData'
import type { Offer, OfferKind } from '@/types/offer'
import type { Contact } from '@/types/contact'
import type { Property } from '@/types/listing'
import { CRM_DARK_KEY, readCrmDark } from '@/lib/crmDark'

const dsFmt = (n: number | null | undefined) =>
  n == null ? '' : 'CHF ' + n.toLocaleString('fr-CH').replace(/\u202f|,/g, "'")

function DsEyebrow({ children, p }: { children: ReactNode; p: DsPal }) {
  return (
    <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: p.muted }}>
      {children}
    </div>
  )
}
function DsChip({ children, p }: { children: ReactNode; p: DsPal }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '6px 13px', borderRadius: 999,
      background: p.chip, color: p.soft, fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}
function DsBlack({ children, onClick, p }: { children: ReactNode; onClick: () => void; p: DsPal }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      height: 44, padding: '0 22px', borderRadius: 999, border: 0,
      background: h ? p.accentHover : p.accent, color: p.accentInk, fontFamily: 'inherit',
      fontWeight: 600, fontSize: 'var(--crm-text-md)', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}
function DsGhost({ children, onClick, p }: { children: ReactNode; onClick: () => void; p: DsPal }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      height: 40, padding: '0 18px', borderRadius: 999, border: 0,
      background: h ? p.sub : 'transparent', color: p.soft, fontFamily: 'inherit',
      fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}

/** Barre d'étape 8 segments — `lost` peint tout en rouge ; « étape n/8 » masqué
 *  sur signed/lost. */
function DsStageBar2({ stage, label, p, t }: {
  stage: StageId; label: string; p: DsPal
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const idx = CRM_STAGE_ORDER.indexOf(stage as (typeof CRM_STAGE_ORDER)[number])
  const isLost = stage === 'lost'
  return (
    <div>
      <div style={{ display: 'flex', gap: 5 }}>
        {CRM_STAGE_ORDER.map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 999,
            background: isLost ? p.err : (i <= idx ? p.ink : p.sub),
          }} />
        ))}
      </div>
      <div style={{ marginTop: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: isLost ? p.err : p.ink }}>{label}</span>
        {!isLost && stage !== 'signed' && (
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: p.muted, fontVariantNumeric: 'tabular-nums' }}>
            {t('deal.step_counter', { index: idx + 1, total: CRM_STAGE_ORDER.length })}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Matching lead — port exact de dsMatches (score de proximité calculé,
// jamais stocké : base 68 + budget×40 + 8 pièces + 6 surface + 10 ville, cap 97).
interface DsMatch { b: CrmBien; pct: number | null }
function dsMatches(criteria: CrmContact['criteria'], biens: CrmBien[]): DsMatch[] {
  const actifs = biens.filter(b => !b.status || b.status === 'active')
  const c = criteria
  if (!c) return actifs.slice(0, 3).map(b => ({ b, pct: null }))
  return actifs.filter(b => {
    if (c.transaction && b.transaction && c.transaction !== b.transaction) return false
    if (c.types && c.types.length && b.type && !c.types.includes(b.type)) return false
    if (c.cantons && c.cantons.length && b.canton && !c.cantons.includes(b.canton)) return false
    const price = b.transaction === 'location' ? b.rent : b.price
    if (c.budgetMax && price && price > c.budgetMax * 1.06) return false
    return true
  }).map(b => {
    const price = (b.transaction === 'location' ? b.rent : b.price) || 0
    let pct = 68
    if (c.budgetMax && price) pct += Math.round(Math.max(0, Math.min(1, 1 - price / (c.budgetMax * 1.06))) * 40)
    if (c.roomsMin && b.rooms >= c.roomsMin) pct += 8
    if (c.areaMin && b.area >= c.areaMin) pct += 6
    if (c.cities && c.cities.length && b.city && c.cities.includes(b.city)) pct += 10
    return { b, pct: Math.min(97, pct) }
  }).sort((a, x) => (x.pct || 0) - (a.pct || 0)).slice(0, 3)
}

function DsMatchRow({ b, pct, top, p, onOpen }: {
  b: CrmBien; pct: number | null; top: boolean; p: DsPal; onOpen: () => void
}) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onOpen} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: 14, padding: '13px 10px', borderRadius: 14,
      background: h ? p.sub : 'transparent', minWidth: 0,
    }}>
      {pct != null && (
        <span style={{
          flexShrink: 0, padding: '3px 9px', borderRadius: 999, fontSize: 'var(--crm-text-xs)', fontWeight: 600,
          background: top ? p.ink : p.chip, color: top ? p.onInk : p.ink, fontVariantNumeric: 'tabular-nums',
        }}>{pct}%</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--crm-text-md)', fontWeight: 600, color: p.ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{b.title}</div>
      </div>
      <span style={{
        fontSize: 'var(--crm-text-md)', fontWeight: 600, color: p.ink, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
      }}>{dsFmt(b.transaction === 'location' ? b.rent : b.price)}</span>
    </button>
  )
}

/** Fil de négociation (repris de la V3, condensé) — pilules de statut pleines. */
function DsOfferRow2({ o, current, p, t }: {
  o: Offer; current: boolean; p: DsPal
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const counter = o.kind === 'counter'
  const pill = (bg: string, fg: string, label: string) => (
    <span style={{
      padding: '2px 9px', borderRadius: 999, background: bg, color: fg,
      fontSize: 'var(--crm-text-xs)', fontWeight: 600,
    }}>{label}</span>
  )
  const conds = [
    o.conditions?.financing?.active ? t('deal.cond.financing', { days: o.conditions.financing.days }) : null,
    o.conditions?.sale?.active ? t('deal.cond.sale') : null,
    o.conditions?.diagnostic?.active ? t('deal.cond.diagnostic') : null,
  ].filter(Boolean)
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 12px', borderRadius: 14,
      boxShadow: current ? `0 0 0 1.5px ${p.ink} inset` : 'none',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: counter ? 'transparent' : p.ink,
        boxShadow: counter ? `0 0 0 1.5px ${p.ghost} inset` : 'none',
      }}>
        <CrmIcon name={counter ? 'swap' : 'arrowR'} size={13} stroke={counter ? p.ink : p.onInk} sw={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: p.muted,
          }}>{counter ? t('deal.offer_row.counter') : t('deal.offer_row.offer')}</span>
          {o.status === 'accepted' ? pill(p.ok, encreSur(p.ok), t('deal.offer_status.accepted'))
            : o.status === 'rejected' ? pill(p.err, encreSur(p.err), t('deal.offer_status.rejected'))
            : o.status === 'expired' ? pill(p.muted, encreSur(p.muted), t('deal.offer_status.expired'))
            : current ? pill(p.ink, p.onInk, t('deal.offer_status.current')) : null}
          <span style={{ marginLeft: 'auto', fontSize: 'var(--crm-text-xs)', color: p.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {fmtDateTime(o.created_at)}
          </span>
        </div>
        <div style={{
          marginTop: 7, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, color: p.ink, letterSpacing: -0.6,
          lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        }}>{dsFmt(o.amount)}</div>
        {conds.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 'var(--crm-text-xs)', color: p.muted, fontWeight: 500, lineHeight: 1.5 }}>
            {conds.join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════

/**
 * Contrat du slot d'aperçu (`/dev/pipeline`, écran « Fiche deal »).
 *
 * ⚠ C'est un VUE-MODÈLE, pas un jeu de lignes de base — idiome déjà retenu par
 * `MobileDealDetailScreen({ demoData })`, qu'on reprend plutôt que d'en inventer
 * un second. La page lit une projection étroite de cinq types DB (`Contact` a 30
 * champs requis, `KycCase` 40) : fabriquer les lignes entières pour en afficher
 * sept serait inventer de la donnée — et pour le KYC, inventer de la donnée de
 * CONFORMITÉ (statut PEP, sanctions, score de risque) que personne ne lit.
 *
 * Les `Pick<>` sont volontaires : si la page se met à lire un champ de plus, elle
 * ne compile plus. La projection ne peut donc pas se périmer en silence.
 */
export interface DealDetailBanc {
  deal: ContactTransaction | null
  contact: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'search_criteria' | 'form_data'> | null
  property: Pick<Property, 'id' | 'title' | 'address' | 'city' | 'surface_m2' | 'rooms' | 'price'> | null
  offers: Offer[]
  /** Seul champ de `KycCase` que la page lit — voir la note ci-dessus. */
  kycStatus: string
  nextAction: { kind: string; note: string } | null
  /** Portefeuille pour `dsMatches` en mode LEAD. */
  biens: CrmBien[]
  isLoading: boolean
  isError: boolean
  /** ⛔ Intercepte toute sortie — sinon `ProtectedRoute` éjecte vers la production. */
  onNavigate?: (vers: string) => void
  Chrome?: (p: { dark: boolean }) => ReactNode
}

export default function DealDetailPage({ banc }: { banc?: DealDetailBanc } = {}) {
  const { t } = useTranslation('pipeline')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const enBanc = banc !== undefined
  /** Seul point de sortie de la page — voir `DealDetailBanc.onNavigate`. */
  const go = (vers: string) => { if (banc?.onNavigate) banc.onNavigate(vers); else navigate(vers) }

  // Thème dark/light, persisté (même clé que les autres pages Sugar).
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return readCrmDark()
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CRM_DARK_KEY, dark ? '1' : '0')
    }
  }, [dark])

  const sp = crmPalette(dark)
  const p = dsPalette(dark, sp)

  // ⚠ Les sept hooks sont appelés DANS TOUS LES CAS (règle des hooks) ; en banc
  // leur résultat est écarté. Sans session ils ne partent de toute façon pas.
  const live = useTransaction(id)
  const { data: liveContact } = useContact(live.data?.contact_buyer_id ?? undefined)
  const { data: liveProperty } = useProperty(live.data?.property_id ?? undefined)
  const { data: offerChain } = useOfferChain(live.data?.id)
  const { data: kycDossier } = useKycDossierByContact(live.data?.contact_buyer_id ?? undefined)
  const { nextAction: liveNextAction } = useTransactionNextReminder(live.data?.id)
  const { biens: liveBiens } = useListingsScreen()

  const deal = banc ? banc.deal ?? undefined : live.data
  const contact = banc ? banc.contact ?? undefined : liveContact
  const property = banc ? banc.property ?? undefined : liveProperty
  const isLoading = banc ? banc.isLoading : live.isLoading
  const isError = banc ? banc.isError : live.isError
  const error = banc ? null : live.error
  const nextAction = banc ? banc.nextAction : liveNextAction
  const biens = banc ? banc.biens : liveBiens

  const offers = useMemo(() => (banc ? banc.offers : offerChain ?? []), [banc, offerChain])
  const last = lastOffer(offers)
  const updateOfferStatus = useUpdateOfferStatus()
  const updateStage = useUpdateTransactionStage()
  const updateStatus = useUpdateTransactionStatus()

  const [offerModalOpen, setOfferModalOpen] = useState(false)
  const [offerModalKind, setOfferModalKind] = useState<OfferKind>('offer')

  // Toast éphémère (2600 ms, pilule bas-centre sans icône).
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const respondOffer = (offer: Offer, status: 'accepted' | 'rejected') => {
    if (!deal) return
    if (enBanc) { showToast(status === 'accepted' ? t('deal.toast.accepted') : t('deal.toast.rejected')); return }
    updateOfferStatus.mutate(
      { offerId: offer.id, dealId: deal.id, status },
      {
        onSuccess: () => {
          if (status === 'accepted') {
            // Deal gagné : il sort du board actif (même contrat que le bento signé).
            void updateStatus.mutateAsync({ id: deal.id, status: 'completed' }).catch(() => {})
          }
          showToast(status === 'accepted' ? t('deal.toast.accepted') : t('deal.toast.rejected'))
        },
        onError: (err) => showToast(t('deal.offer_update_failed', { message: err.message })),
      },
    )
  }
  const markLost = () => {
    if (!deal) return
    if (enBanc) { showToast(t('deal.toast.lost')); return }
    updateStage.mutate(
      { id: deal.id, stage: 'lost' },
      {
        onSuccess: () => showToast(t('deal.toast.lost')),
        onError: (err) => showToast(t('deal.offer_update_failed', { message: err.message })),
      },
    )
  }

  const shell = (children: ReactNode) => (
    <div style={{
      position: 'relative', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: sp.pageBg, color: p.ink, fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
    }}>
      <style>{CRM_KEYFRAMES}</style>
      <style>{`
        .ds-scroll { scrollbar-width: thin; scrollbar-color: ${p.ghost} transparent; }
        .ds-scroll::-webkit-scrollbar { width: 10px; }
        .ds-scroll::-webkit-scrollbar-thumb { background: ${p.ghost}; border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }
      `}</style>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmSidebar active="pipeline" sp={sp} dark={dark} setDark={setDark} />
        <main style={{
          flex: 1, minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column',
          paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)',
          paddingRight: 24, paddingBottom: 22,
        }}>
          <div style={{
            position: 'relative', flex: 1, minHeight: 0, borderRadius: 26, overflow: 'hidden',
            border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg,
            display: 'flex', flexDirection: 'column',
          }}>
            {children}
          </div>
        </main>
      </div>
      {/* ⚠ À la RACINE : le cadre bento porte `overflow: hidden` et clipperait
          les commandes. Le thème est reçu, jamais relu — voir le banc Pipeline. */}
      {banc?.Chrome ? <banc.Chrome dark={dark} /> : null}
    </div>
  )

  if (isLoading) {
    return shell(<div style={{ flex: 1, display: 'grid', placeItems: 'center', color: p.muted }}>{t('deal.loading')}</div>)
  }
  if (isError) {
    return shell(
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: p.err, padding: 40, textAlign: 'center' }}>
        {t('deal.load_error', { message: error?.message ?? t('deal.error_unknown') })}
      </div>,
    )
  }
  if (!deal) {
    return shell(<div style={{ flex: 1, display: 'grid', placeItems: 'center', color: p.muted }}>{t('deal.not_found')}</div>)
  }

  const dealValue = deal.price_offered ?? deal.price_final ?? property?.price ?? 0
  const contactName = contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : t('deal.buyer_fallback')
  const initials = contact
    ? `${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'
  const kycStatus = banc ? banc.kycStatus : kycDossier?.dossier_status ?? 'none'
  const uiStage: StageId = deal.stage === 'lost' ? 'lost' : mapTransactionStageToStepper(deal.stage)
  const stageLabel = t(`stages.${uiStage}`)
  const isTerminal = deal.stage === 'signed' || deal.stage === 'lost'
  const crit = mapCriteria(contact?.search_criteria ?? null)
  const isLead = !property && offers.length === 0
  const matches = isLead ? dsMatches(crit, biens) : []
  const langLabel = contact?.form_data && typeof contact.form_data === 'object'
    ? (() => {
        const lang = (contact.form_data as Record<string, unknown>).lang
        return typeof lang === 'string' ? t(`deal.lang.${lang}`, { defaultValue: lang }) : null
      })()
    : null

  const cardStyle = (delay: number): CSSProperties => ({
    background: p.card, borderRadius: 24, boxShadow: p.shadow, padding: '28px 30px',
    animation: `crm-fade-up .5s cubic-bezier(.2,.8,.2,1) ${delay}s both`,
    display: 'flex', flexDirection: 'column', minWidth: 0,
  })

  const contactRow = (label: string, value: string | null | undefined) => value ? (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: p.muted, width: 84, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: p.soft, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</span>
    </div>
  ) : null

  return shell(
    <>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', flexShrink: 0 }}>
        <DsGhost p={p} onClick={() => go('/dashboard/pipeline')}>
          <CrmIcon name="arrowL" size={15} stroke={p.soft} />{t('title')}
        </DsGhost>
      </header>

      <div className="ds-scroll" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 34px 46px', boxSizing: 'border-box', display: 'flex',
      }}>
        <div style={{
          maxWidth: 1160, width: '100%', margin: '0 auto', minHeight: '100%',
          display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 22, alignItems: 'stretch',
        }}>

          {/* ── L'ACHETEUR ─────────────────────────────────── */}
          <div style={cardStyle(0)}>
            <DsEyebrow p={p}>{t('deal.buyer_eyebrow')}</DsEyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 999, background: p.sub, color: p.ink,
                display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 600, fontSize: 'var(--crm-text-2xl)',
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{
                  margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, color: p.ink, letterSpacing: -0.8, lineHeight: 1.1,
                }}>{contactName}</h1>
                {langLabel && (
                  <div style={{ fontSize: 'var(--crm-text-sm)', color: p.muted, fontWeight: 500, marginTop: 4 }}>{langLabel}</div>
                )}
              </div>
            </div>
            {crit && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
                {crit.transaction && (
                  <DsChip p={p}>{crit.transaction === 'location' ? t('deal.crit.rent') : t('deal.crit.buy')}</DsChip>
                )}
                {(crit.types || []).map(x => (
                  <DsChip key={x} p={p}>{x.charAt(0).toUpperCase() + x.slice(1)}</DsChip>
                ))}
                {((crit.cities && crit.cities.length ? crit.cities : crit.cantons) || []).slice(0, 3).map(x => (
                  <DsChip key={x} p={p}>{x}</DsChip>
                ))}
                {crit.budgetMax ? <DsChip p={p}>{t('deal.crit.budget_max', { amount: dsFmt(crit.budgetMax) })}</DsChip> : null}
                {crit.roomsMin ? <DsChip p={p}>{t('deal.crit.rooms_min', { count: crit.roomsMin })}</DsChip> : null}
              </div>
            )}
            <div style={{ height: 1, background: p.hair, margin: '24px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {contactRow(t('deal.phone'), contact?.phone)}
              {contactRow(t('deal.email'), contact?.email)}
            </div>
            {kycStatus !== 'verified' && contact && (
              <>
                <div style={{ height: 1, background: p.hair, margin: '24px 0' }} />
                <button
                  onClick={() => go(`/dashboard/kyc?openContactId=${contact.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: 0, background: 'transparent',
                    border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <CrmIcon name="shield" size={16} stroke={p.muted} sw={1.8} />
                  <span style={{ flex: 1, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: p.soft }}>
                    {t('deal.kyc_to_complete')} <span style={{ color: p.muted, fontWeight: 500 }}>· {t('deal.optional')}</span>
                  </span>
                  <CrmIcon name="arrowR" size={14} stroke={p.muted} />
                </button>
              </>
            )}
            <div style={{ marginTop: 'auto', paddingTop: 26 }}>
              <DsGhost p={p} onClick={() => contact && go(`/dashboard/contacts/${contact.id}`)}>
                {t('deal.open_contact')} <CrmIcon name="arrowR" size={14} stroke={p.soft} />
              </DsGhost>
            </div>
          </div>

          {/* ── L'AFFAIRE ──────────────────────────────────── */}
          <div style={cardStyle(0.05)}>
            <DsEyebrow p={p}>{t('deal.affair_eyebrow')}</DsEyebrow>
            <div style={{ marginTop: 18 }}>
              <DsStageBar2 stage={uiStage} label={stageLabel} p={p} t={t} />
            </div>

            {nextAction && deal.stage !== 'signed' && deal.stage !== 'lost' && (
              <div style={{
                marginTop: 22, padding: '15px 18px', borderRadius: 16, background: p.sub,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: p.muted,
                  }}>{t('deal.next_action')}</div>
                  <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: p.ink, marginTop: 5, lineHeight: 1.35 }}>
                    {nextAction.note || t(`timeline.kind.${nextAction.kind}`, { defaultValue: t('timeline.kind.fallback') })}
                  </div>
                </div>
              </div>
            )}

            {isLead ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 26,
                }}>
                  <h2 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: p.ink, letterSpacing: -0.4 }}>
                    {t('deal.matches_title')}
                  </h2>
                  <span style={{ fontSize: 'var(--crm-text-sm)', color: p.muted, fontWeight: 600 }}>
                    {t('deal.matches_count', { count: matches.length })}
                  </span>
                </div>
                {matches.length === 0 ? (
                  <div style={{
                    marginTop: 16, padding: '24px 18px', textAlign: 'center',
                    fontSize: 'var(--crm-text-sm)', color: p.muted, fontWeight: 500,
                  }}>{t('deal.no_matches')}</div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    {matches.map((m, i) => (
                      <div key={m.b.id}>
                        {i > 0 && <div style={{ height: 1, background: p.hair, margin: '0 4px' }} />}
                        <DsMatchRow b={m.b} pct={m.pct} top={i === 0} p={p}
                          onOpen={() => go(`/dashboard/listings/${m.b.id}`)} />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                  <DsBlack p={p} onClick={() => go(`/dashboard/matching${contact ? `?contact=${contact.id}` : ''}`)}>
                    {t('deal.transmit', { name: contact?.first_name ?? t('deal.buyer_fallback') })}
                  </DsBlack>
                </div>
              </>
            ) : (
              <>
                {property && (
                  <button onClick={() => go(`/dashboard/listings/${property.id}`)} style={{
                    marginTop: 22, width: '100%', textAlign: 'left', border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', background: 'transparent', padding: 0,
                    display: 'flex', alignItems: 'center', gap: 14, minWidth: 0,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: p.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{property.title}</div>
                      <div style={{ fontSize: 'var(--crm-text-xs)', color: p.muted, fontWeight: 500, marginTop: 3 }}>
                        {t('deal.property_line', {
                          addr: property.address ?? property.city ?? '',
                          area: property.surface_m2 ?? 0,
                          rooms: property.rooms ?? 0,
                        })}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: p.ink,
                      fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                    }}>{dsFmt(dealValue)}</span>
                  </button>
                )}
                <div style={{ height: 1, background: p.hair, margin: '22px 0' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: p.ink, letterSpacing: -0.4 }}>
                    {t('deal.negotiation')}
                  </h2>
                  {offers.length > 0 && (
                    <span style={{ fontSize: 'var(--crm-text-sm)', color: p.muted, fontWeight: 600 }}>
                      {t('deal.rounds', { count: offers.length })}
                    </span>
                  )}
                </div>
                {offers.length === 0 ? (
                  <div style={{ marginTop: 16, padding: '26px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: p.ink, marginBottom: 6 }}>
                      {t('deal.no_offer_title')}
                    </div>
                    <div style={{ fontSize: 'var(--crm-text-sm)', color: p.muted, marginBottom: 18 }}>{t('deal.no_offer_hint')}</div>
                    {!isTerminal && (
                      <DsBlack p={p} onClick={() => { setOfferModalKind('offer'); setOfferModalOpen(true) }}>
                        {t('deal.record_offer')}
                      </DsBlack>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    {offers.map((o, i) => (
                      <div key={o.id}>
                        {i > 0 && <div style={{ height: 1, background: p.hair, margin: '0 14px' }} />}
                        <DsOfferRow2 o={o} current={i === offers.length - 1} p={p} t={t} />
                      </div>
                    ))}
                    {last && last.status === 'pending' && (
                      <div style={{
                        marginTop: 14, paddingTop: 16, borderTop: `1px solid ${p.hair}`,
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      }}>
                        <DsBlack p={p} onClick={() => respondOffer(last, 'accepted')}>{t('deal.accept_offer')}</DsBlack>
                        <DsGhost p={p} onClick={() => respondOffer(last, 'rejected')}>{t('deal.reject')}</DsGhost>
                        <DsGhost p={p} onClick={() => { setOfferModalKind('counter'); setOfferModalOpen(true) }}>
                          {t('deal.counter_offer')}
                        </DsGhost>
                      </div>
                    )}
                    {last && last.status === 'rejected' && deal.stage !== 'lost' && (
                      <div style={{ marginTop: 14, paddingTop: 16, borderTop: `1px solid ${p.hair}` }}>
                        <div style={{
                          fontSize: 'var(--crm-text-sm)', color: p.muted, fontWeight: 500, marginBottom: 12, lineHeight: 1.5,
                        }}>{t('deal.rejected_note')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <DsBlack p={p} onClick={() => { setOfferModalKind('counter'); setOfferModalOpen(true) }}>
                            {t('deal.relaunch_offer')}
                          </DsBlack>
                          <button onClick={markLost} style={{
                            height: 40, padding: '0 18px', borderRadius: 999, border: 0,
                            background: 'transparent', color: p.err, fontFamily: 'inherit',
                            fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
                          }}>{t('deal.mark_lost')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Offre / contre-offre — épouse le bento (contained) */}
      {offerModalOpen && (
        <OfferModal
          dealId={deal.id}
          kind={offerModalKind}
          parentOffer={offerModalKind === 'counter' ? last ?? null : null}
          banc={banc ? {
            deal: { id: deal.id, contact_buyer_id: contact?.id ?? null, property_id: property?.id ?? '' },
            bien: property ? { title: property.title, price: property.price } : null,
            buyer: contact ? { first_name: contact.first_name, last_name: contact.last_name } : null,
          } : undefined}
          contained
          dark={dark}
          onSubmit={() => showToast(offerModalKind === 'counter' ? t('deal.toast.counter_sent') : t('deal.toast.offer_sent'))}
          onClose={() => setOfferModalOpen(false)}
        />
      )}

      {toast && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 60,
          display: 'inline-flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderRadius: 999,
          background: p.ink, color: p.onInk, fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
          boxShadow: '0 18px 44px rgba(0,0,0,0.30), 0 4px 14px rgba(0,0,0,0.20)',
          animation: 'crm-fade-up .3s cubic-bezier(.2,.8,.2,1) both',
        }}>{toast}</div>
      )}
    </>,
  )
}
