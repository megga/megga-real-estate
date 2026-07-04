// MEGGA CRM — Fiche Deal V3 « épurée » (Sugar Pure) — port fidèle Claude Design
// ─────────────────────────────────────────────────────────────────────
// (crm-screen-deal-detail-v3.jsx). Repart de 2 surfaces :
//   1. Carte principale — identité, montant, progression (DvStageBar), NÉGOCIATION
//      (créer → contrer → accepter/refuser → relancer/perdu, toasts, verrous terminaux)
//   2. Colonne contexte — bien, acheteur, rappel KYC (optionnel)
// Retirés volontairement (design) : documents, notes privées, timeline, stepper 8
// cercles, bannière KYC bloquante. Les hooks correspondants restent dans le codebase
// (useTransactionDocuments / useUpdateTransactionNotes), réintégrables au besoin.
//
// Câblage Supabase LIVE :
//   - useTransaction / useContact / useProperty / useKycDossierByContact / useOfferChain
//   - Accepter une offre → useUpdateOfferStatus('accepted') (le hook avance AUSSI la
//     transaction en 'signed' — cf. contrat handoff deal.won). Refuser → 'rejected'.
//   - Marquer perdu → useUpdateTransactionStage(stage='lost').
//   - Offre / contre-offre → <OfferModalSugar contained dark> embarquée dans le bento.
//
// Route : /dashboard/transactions/:id

import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { TFunction } from 'i18next'
import { SgIcon } from '@/components/crm-sugar-v3/icons'
import { fmtDateTime } from '@/components/crm-sugar-v3/tokens'
import { CRM_TOKENS, crmSugarPalette } from '@/components/crm-sugar/tokens'
import { mapTransactionStageToStepper } from '@/components/crm-sugar-v3/dealStepper'
import OfferModalSugar from '@/components/crm-sugar-v3/offer-modal/OfferModalSugar'
import { useTranslation } from 'react-i18next'
import { useTransaction, useUpdateTransactionStage } from '@/hooks/useTransactions'
import { useContact } from '@/hooks/useContacts'
import { useProperty } from '@/hooks/useProperties'
import { useOfferChain, lastOffer, useUpdateOfferStatus } from '@/hooks/useOffers'
import { useKycDossierByContact } from '@/hooks/useKycDossier'
import { useSugarDark } from '@/lib/sugarDark'
import type { TransactionStage } from '@/lib/constants'
import type { Offer, OfferKind } from '@/types/offer'

// ─── Palettes ────────────────────────────────────────────────────────────
interface DvPalette {
  card: string
  sub: string
  ink: string
  soft: string
  muted: string
  ghost: string
  black: string
  blackHover: string
  onBlack: string
  shadow: string
  shadowSm: string
  ring: string
  ok: string
  warn: string
  err: string
  pop: string
}
const DV_LIGHT: DvPalette = {
  card: '#FFFFFF', sub: '#F7F8FA', ink: '#0B0C0E', soft: '#3A3D44', muted: '#7A8088', ghost: '#B5BAC2',
  black: '#0B0C0E', blackHover: '#1F2024', onBlack: '#FFFFFF',
  shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
  shadowSm: '0 4px 16px rgba(15,23,42,0.04)', ring: '',
  ok: '#10B981', warn: '#F59E0B', err: '#EF4444', pop: '#3B82F6',
}
const DV_DARK: DvPalette = {
  card: '#1B1E28', sub: '#262A36', ink: '#F4F5F7', soft: '#C4C8D0', muted: '#8A909B', ghost: '#4C505A',
  black: '#F4F5F7', blackHover: '#FFFFFF', onBlack: '#0B0C0E',
  shadow: '0 14px 40px rgba(0,0,0,0.42), 0 2px 8px rgba(0,0,0,0.30)',
  shadowSm: '0 4px 16px rgba(0,0,0,0.28)', ring: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  ok: '#34D399', warn: '#FBBF24', err: '#F87171', pop: '#60A5FA',
}

const DV_ORDER = [
  'new-lead', 'to-qualify', 'searching', 'visit-scheduled',
  'visit-done', 'interest-confirmed', 'offer', 'signed',
] as const

function dvFmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return 'CHF ' + n.toLocaleString('fr-CH').replace(/[\u00A0\u202F,]/g, "'")
}

interface TransactionJoined {
  id: string
  property_id: string
  contact_buyer_id: string | null
  stage: TransactionStage
  price_offered: number | null
  price_final: number | null
}

// ─── Primitives (module-level → pas de remount/focus-loss) ─────────────────
function DvEyebrow({ children, pal }: { children: ReactNode; pal: DvPalette }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 600, color: pal.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
      {children}
    </div>
  )
}

function DvBlackPill({ children, onClick, pal }: { children: ReactNode; onClick: () => void; pal: DvPalette }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: 44, padding: '0 22px', borderRadius: 999, border: 0,
        background: h ? pal.blackHover : pal.black, color: pal.onBlack,
        fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 9, whiteSpace: 'nowrap',
        boxShadow: h ? '0 12px 30px rgba(11,12,14,0.25)' : '0 6px 16px rgba(11,12,14,0.18)',
        transform: h ? 'translateY(-1px)' : 'none', transition: 'all .18s ease',
      }}
    >
      {children}
    </button>
  )
}

function DvGhostPill({ children, onClick, icon, pal }: { children: ReactNode; onClick: () => void; icon?: ReactNode; pal: DvPalette }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: 40, padding: '0 18px', borderRadius: 999, border: 0,
        background: h ? pal.card : 'transparent', color: pal.soft,
        fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        boxShadow: h ? pal.shadow : 'none', transition: 'all .18s ease',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// Progression — barre segmentée fine (remplace le stepper 8 cercles).
function DvStageBar({ stage, label, pal, t }: { stage: string; label: string; pal: DvPalette; t: TFunction<'pipeline'> }) {
  const idx = DV_ORDER.indexOf(stage as (typeof DV_ORDER)[number])
  const isLost = stage === 'lost'
  const terminal = isLost || stage === 'signed'
  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        {DV_ORDER.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1, height: 4, borderRadius: 999,
              background: isLost ? pal.err : i <= idx ? pal.ink : pal.sub,
              transition: 'background .3s ease',
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: isLost ? pal.err : pal.ink }}>{label}</span>
        {!terminal && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: pal.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {t('deal.step_counter', { index: idx + 1, total: DV_ORDER.length })}
          </span>
        )}
      </div>
    </div>
  )
}

// Négociation — fil épuré (une ligne par offre).
function DvOfferRow({ o, current, pal, t }: { o: Offer; current: boolean; pal: DvPalette; t: TFunction<'pipeline'> }) {
  const counter = o.kind === 'counter'
  const pill = (bg: string, fg: string, label: string) => (
    <span style={{ padding: '2px 9px', borderRadius: 999, background: bg, color: fg, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
      {label}
    </span>
  )
  let statusPill: ReactNode = null
  if (o.status === 'accepted') statusPill = pill(pal.ok, '#FFFFFF', t('deal.offer_status.accepted'))
  else if (o.status === 'rejected') statusPill = pill(pal.err, '#FFFFFF', t('deal.offer_status.rejected'))
  else if (o.status === 'expired') statusPill = pill(pal.muted, '#FFFFFF', t('deal.offer_status.expired'))
  else if (current) statusPill = pill(pal.black, pal.onBlack, t('deal.offer_status.current'))

  const conds = o.conditions
  const condSummary = conds
    ? [
        conds.financing?.active ? t('deal.cond.financing', { days: conds.financing.days ?? 45 }) : null,
        conds.sale?.active ? t('deal.cond.sale') : null,
        conds.diagnostic?.active ? t('deal.cond.diagnostic') : null,
      ].filter(Boolean).join(' · ')
    : ''

  return (
    <div
      style={{
        display: 'flex', gap: 16, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 16,
        background: 'transparent',
        boxShadow: current ? `0 0 0 1.5px ${pal.ink} inset` : 'none',
      }}
    >
      <div
        style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: counter ? 'transparent' : pal.black,
          boxShadow: counter ? `0 0 0 1.5px ${pal.ghost} inset` : 'none',
        }}
      >
        <SgIcon name={counter ? 'swap' : 'arrowR'} size={14} stroke={counter ? pal.ink : pal.onBlack} sw={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: pal.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {counter ? t('deal.offer_row.counter') : t('deal.offer_row.offer')}
          </span>
          {statusPill}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: pal.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {fmtDateTime(o.created_at)}
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 27, fontWeight: 700, color: pal.ink, letterSpacing: -0.6, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {dvFmt(o.amount)}
        </div>
        {condSummary && (
          <div style={{ marginTop: 10, fontSize: 12, color: pal.muted, fontWeight: 500, lineHeight: 1.5 }}>{condSummary}</div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
export default function DealDetailSugarV3Page() {
  const { t } = useTranslation('pipeline')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dark = useSugarDark()
  const pal = dark ? DV_DARK : DV_LIGHT
  const pageBg = crmSugarPalette(dark ? CRM_TOKENS.dark : CRM_TOKENS.light, dark, 'meggaAi').pageBg

  const { data: dealRaw, isLoading, isError, error } = useTransaction(id)
  const deal = dealRaw as TransactionJoined | undefined
  const { data: contact } = useContact(deal?.contact_buyer_id ?? undefined)
  const { data: property } = useProperty(deal?.property_id)
  const { data: offerChain } = useOfferChain(deal?.id)
  const { data: kycDossier } = useKycDossierByContact(deal?.contact_buyer_id ?? undefined)

  const offers = useMemo(() => offerChain ?? [], [offerChain])
  const last = lastOffer(offers)
  const updateOfferStatus = useUpdateOfferStatus()
  const updateStage = useUpdateTransactionStage()

  const [offerModalOpen, setOfferModalOpen] = useState(false)
  const [offerModalKind, setOfferModalKind] = useState<OfferKind>('offer')

  // Toast éphémère (2600 ms, sans icône).
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const respondOffer = (offer: Offer, status: 'accepted' | 'rejected') => {
    updateOfferStatus.mutate(
      { offerId: offer.id, dealId: deal!.id, status },
      {
        onSuccess: () => showToast(status === 'accepted' ? t('deal.toast.accepted') : t('deal.toast.rejected')),
        onError: (err) => showToast(t('deal.offer_update_failed', { message: err.message })),
      },
    )
  }
  const markLost = () => {
    updateStage.mutate(
      { id: deal!.id, stage: 'lost' },
      {
        onSuccess: () => showToast(t('deal.toast.lost')),
        onError: (err) => showToast(t('deal.offer_update_failed', { message: err.message })),
      },
    )
  }

  const shell = (children: ReactNode): ReactElement => (
    <div
      style={{
        position: 'relative', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: pageBg, color: pal.ink, fontFamily: '"Inter Tight", system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  )

  if (isLoading) {
    return shell(
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: pal.muted }}>{t('deal.loading')}</div>,
    )
  }
  if (isError) {
    return shell(
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: pal.err, padding: 40, textAlign: 'center' }}>
        {t('deal.load_error', { message: error?.message ?? t('deal.error_unknown') })}
      </div>,
    )
  }
  if (!deal) {
    return shell(<div style={{ flex: 1, display: 'grid', placeItems: 'center', color: pal.muted }}>{t('deal.not_found')}</div>)
  }

  const dealValue = deal.price_offered ?? deal.price_final ?? property?.price ?? 0
  const contactName = contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : t('deal.buyer_fallback')
  const initials = contact
    ? `${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'
  const kycStatus = kycDossier?.dossier_status ?? 'none'
  const isTerminal = deal.stage === 'signed' || deal.stage === 'lost'
  const uiStage = deal.stage === 'lost' ? 'lost' : mapTransactionStageToStepper(deal.stage)
  const stageLabel = t(`stages.${uiStage}`)

  return shell(
    <>
      <style>{`
        @keyframes sgFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .dv-scroll { scrollbar-width: thin; scrollbar-color: ${pal.ghost} transparent; }
        .dv-scroll::-webkit-scrollbar { width: 10px; }
        .dv-scroll::-webkit-scrollbar-thumb { background: ${pal.ghost}; border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }
      `}</style>

      {/* Barre d'actions */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 34px', flexWrap: 'wrap', flexShrink: 0 }}>
        <DvGhostPill pal={pal} icon={<SgIcon name="arrowL" size={15} stroke={pal.soft} />} onClick={() => navigate('/dashboard/pipeline')}>
          {t('title')}
        </DvGhostPill>
        <div style={{ flex: 1 }} />
        {!isTerminal && (
          <DvBlackPill
            pal={pal}
            onClick={() => {
              setOfferModalKind(last ? 'counter' : 'offer')
              setOfferModalOpen(true)
            }}
          >
            {last ? t('deal.counter_offer') : t('deal.new_offer')}
          </DvBlackPill>
        )}
      </header>

      <div className="dv-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 34px 46px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 330px', gap: 22, alignItems: 'start' }}>
          {/* ── CARTE PRINCIPALE ── */}
          <div style={{ background: pal.card, borderRadius: 24, boxShadow: (pal.ring ? pal.ring + ', ' : '') + pal.shadow, padding: 36, animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h1 style={{ margin: '0 0 6px', fontSize: 38, fontWeight: 700, color: pal.ink, letterSpacing: -1, lineHeight: 1.08 }}>
                  {contactName}
                </h1>
                {property && <div style={{ fontSize: 15.5, fontWeight: 500, color: pal.muted }}>{property.title}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: pal.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {t('deal.deal_amount')}
                </div>
                <div style={{ marginTop: 8, fontSize: 42, fontWeight: 700, color: pal.ink, letterSpacing: -1.2, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {dvFmt(dealValue)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 30 }}>
              <DvStageBar stage={uiStage} label={stageLabel} pal={pal} t={t} />
            </div>

            <div style={{ height: 1, background: pal.sub, margin: '30px 0' }} />

            {/* Négociation */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: pal.ink, letterSpacing: -0.4 }}>{t('deal.negotiation')}</h2>
              {offers.length > 0 && (
                <span style={{ fontSize: 12, color: pal.muted, fontWeight: 600 }}>
                  {t('deal.rounds', { count: offers.length })}
                </span>
              )}
            </div>

            {offers.length === 0 ? (
              <div style={{ marginTop: 18, padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: pal.ink, marginBottom: 6 }}>{t('deal.no_offer_title')}</div>
                <div style={{ fontSize: 12.5, color: pal.muted, marginBottom: 18 }}>{t('deal.no_offer_hint')}</div>
                {!isTerminal && (
                  <DvBlackPill pal={pal} onClick={() => { setOfferModalKind('offer'); setOfferModalOpen(true) }}>
                    {t('deal.record_offer')}
                  </DvBlackPill>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {offers.map((o, i) => (
                  <div key={o.id}>
                    {i > 0 && <div style={{ height: 1, background: pal.sub, margin: '0 18px' }} />}
                    <DvOfferRow o={o} current={i === offers.length - 1} pal={pal} t={t} />
                  </div>
                ))}

                {last && last.status === 'pending' && !isTerminal && (
                  <div style={{ marginTop: 14, paddingTop: 16, borderTop: `1px solid ${pal.sub}`, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 18 }}>
                    <DvBlackPill pal={pal} onClick={() => respondOffer(last, 'accepted')}>{t('deal.accept_offer')}</DvBlackPill>
                    <DvGhostPill pal={pal} onClick={() => respondOffer(last, 'rejected')}>{t('deal.reject')}</DvGhostPill>
                  </div>
                )}

                {last && last.status === 'rejected' && deal.stage !== 'lost' && (
                  <div style={{ marginTop: 14, paddingTop: 16, borderTop: `1px solid ${pal.sub}`, paddingLeft: 18, paddingRight: 18 }}>
                    <div style={{ fontSize: 12.5, color: pal.muted, fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>
                      {t('deal.rejected_note')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <DvBlackPill pal={pal} onClick={() => { setOfferModalKind('counter'); setOfferModalOpen(true) }}>
                        {t('deal.relaunch_offer')}
                      </DvBlackPill>
                      <button
                        onClick={markLost}
                        onMouseEnter={(e) => { e.currentTarget.style.background = dark ? 'rgba(224,115,140,0.12)' : 'rgba(142,31,61,0.08)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        style={{
                          height: 40, padding: '0 18px', borderRadius: 999, border: 0,
                          background: 'transparent', color: pal.err,
                          fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .18s ease',
                        }}
                      >
                        {t('deal.mark_lost')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── COLONNE CONTEXTE ── */}
          <div style={{ background: pal.card, borderRadius: 24, boxShadow: (pal.ring ? pal.ring + ', ' : '') + pal.shadow, padding: '8px 22px', animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both', display: 'flex', flexDirection: 'column' }}>
            {property && (
              <>
                <DvContextButton pal={pal} onClick={() => navigate(`/dashboard/listings/${property.id}`)}>
                  <DvEyebrow pal={pal}>{t('column.property')}</DvEyebrow>
                  <div style={{ marginTop: 10, fontSize: 14.5, fontWeight: 700, color: pal.ink }}>{property.title}</div>
                  <div style={{ marginTop: 3, fontSize: 12, color: pal.muted, fontWeight: 500 }}>
                    {property.address} · {property.canton}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: pal.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {dvFmt(property.price)}
                  </div>
                </DvContextButton>
                {contact && <div style={{ height: 1, background: pal.sub }} />}
              </>
            )}

            {contact && (
              <div style={{ padding: '16px 6px' }}>
                <DvEyebrow pal={pal}>{t('deal.buyer')}</DvEyebrow>
                <button
                  onClick={() => navigate(`/dashboard/contacts/${contact.id}`)}
                  style={{ width: '100%', textAlign: 'left', marginTop: 12, padding: 0, background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 999, background: pal.pop, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 700, fontSize: 14 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: pal.ink }}>{contactName}</div>
                    <div style={{ fontSize: 11.5, color: pal.muted, fontWeight: 500 }}>{t('deal.view_full_profile')}</div>
                  </div>
                  <SgIcon name="arrowR" size={15} stroke={pal.muted} />
                </button>
              </div>
            )}

            {kycStatus !== 'verified' && contact && (
              <>
                <div style={{ height: 1, background: pal.sub }} />
                <DvContextButton pal={pal} onClick={() => navigate(`/dashboard/kyc?contactId=${contact.id}`)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <SgIcon name="shield" size={16} stroke={pal.muted} sw={1.8} />
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: pal.soft }}>
                      {t('deal.kyc_to_complete')}{' '}
                      <span style={{ color: pal.muted, fontWeight: 500 }}>· {t('deal.optional')}</span>
                    </span>
                    <SgIcon name="arrowR" size={14} stroke={pal.muted} />
                  </span>
                </DvContextButton>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Offre / contre-offre — épouse le bento (contained) */}
      {offerModalOpen && (
        <OfferModalSugar
          dealId={deal.id}
          kind={offerModalKind}
          parentOffer={offerModalKind === 'counter' ? last ?? null : null}
          contained
          dark={dark}
          onSubmit={() => showToast(offerModalKind === 'counter' ? t('deal.toast.counter_sent') : t('deal.toast.offer_sent'))}
          onClose={() => setOfferModalOpen(false)}
        />
      )}

      {/* Toast — pilule bas-centre, sans icône */}
      {toast && (
        <div
          style={{
            position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 60,
            display: 'inline-flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderRadius: 999,
            background: pal.black, color: pal.onBlack, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
            boxShadow: '0 18px 44px rgba(0,0,0,0.30), 0 4px 14px rgba(0,0,0,0.20)',
            animation: 'sgFadeUp .3s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          {toast}
        </div>
      )}
    </>,
  )
}

// Bloc contexte cliquable (survol → fond subtil).
function DvContextButton({ children, onClick, pal }: { children: ReactNode; onClick: () => void; pal: DvPalette }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', textAlign: 'left', padding: '16px 6px', background: 'transparent', border: 0, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s ease', display: 'block' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = pal.sub }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
