/**
 * Écran de détail d'un deal (mobile) : UI + câblage données, monté par
 * MobileDealDetailPage.
 */
import { useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { formatCHF } from '@/lib/utils'
import { useTransaction, useUpdateTransactionNotes } from '@/hooks/useTransactions'
import { useContact } from '@/hooks/useContacts'
import { useProperty } from '@/hooks/useProperties'
import { useKycDossierByContact } from '@/hooks/useKycDossier'
import { useOfferChain, useUpdateOfferStatus, lastOffer } from '@/hooks/useOffers'
import { countActiveConditions, type Offer, type OfferStatus } from '@/types/offer'
import { DEAL_STEPPER_ORDER, dealStepperIndex, isStageKycBlocking, mapTransactionStageToStepper } from '@/components/crm-sugar-v3/dealStepper'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import SgToast from '../primitives/SgToast'
import { useSgToast } from '../primitives/useSgToast'

type StageInput = Parameters<typeof mapTransactionStageToStepper>[0]

/** Vue-modèle du deal : agrège transaction, acheteur, bien, KYC et offres pour le rendu. */
export interface DealData {
  id?: string
  stage: StageInput
  value: number
  buyerName: string
  buyerInitials: string
  buyerId?: string
  buyerBudgetMin?: number | null
  buyerBudgetMax?: number | null
  buyerProb?: number | null
  propertyTitle: string
  propertyAddr: string
  propertyPrice: number | null
  propertySurface?: number | null
  propertyRooms?: number | null
  propertyId?: string
  photo?: string
  kycStatus: string
  offers: Offer[]
  notes: string
  createdAt: string
}

const STATUS_COLOR: Record<OfferStatus, string> = {
  pending: '#B7791F',
  accepted: '#059669',
  rejected: '#8E1F3D',
  expired: '#7A8088',
  withdrawn: '#7A8088',
}

/** Style d'un état centré (≥60 % de hauteur), réutilisé par les états chargement / erreur / introuvable. */
function fullState(mono: string, font: string): CSSProperties {
  return { minHeight: '60dvh', display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: mono, fontFamily: font }
}

/**
 * Détail deal mobile — port du proto, branché 100 % réel (aucun mock en prod).
 * Hero (parties + valeur + stage), stepper 8 étapes **read-only**, bannière KYC
 * **informative non-bloquante**, cartes Acheteur/Bien, négociation (chaîne
 * d'offres `useOfferChain` + accepter/refuser via `useUpdateOfferStatus`, création
 * via la route `/offre/:kind` = `OfferModalSugarV3Page`), notes privées
 * (`useUpdateTransactionNotes`), timeline + documents **dérivés** (comme le
 * desktop). `demoData` injecte un jeu de démo pour le harnais ; en prod, hooks.
 */
export function MobileDealDetailScreen({ demoData }: { demoData?: DealData }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('pipeline')
  const { tk } = useMobileTokens()
  const { toast, showToast } = useSgToast()

  const live = !demoData
  const { data: deal, isLoading, isError } = useTransaction(live ? id : undefined)
  const { data: contact } = useContact(live ? deal?.contact_buyer_id ?? undefined : undefined)
  const { data: property } = useProperty(live ? deal?.property_id ?? undefined : undefined)
  const { data: kycDossier } = useKycDossierByContact(live ? deal?.contact_buyer_id ?? undefined : undefined)
  const { data: offerChain } = useOfferChain(live ? deal?.id : undefined)
  const updateNotes = useUpdateTransactionNotes()
  const updateOfferStatus = useUpdateOfferStatus()

  const vm: DealData | null =
    demoData ??
    (deal
      ? {
          id: deal.id,
          stage: deal.stage,
          value: deal.price_offered ?? deal.price_final ?? property?.price ?? 0,
          buyerName: contact ? `${contact.first_name} ${contact.last_name}`.trim() : '',
          buyerInitials: contact ? `${contact.first_name[0] ?? ''}${contact.last_name[0] ?? ''}`.toUpperCase() : '—',
          buyerId: contact?.id ?? deal.contact_buyer_id ?? undefined,
          buyerBudgetMin: contact?.search_criteria?.budget_min ?? null,
          buyerBudgetMax: contact?.search_criteria?.budget_max ?? null,
          buyerProb: contact?.ai_purchase_probability ?? null,
          propertyTitle: property?.title ?? '',
          propertyAddr: [property?.address, property?.city].filter(Boolean).join(' · '),
          propertyPrice: property?.price ?? null,
          propertySurface: property?.surface_m2 ?? null,
          propertyRooms: property?.rooms ?? null,
          propertyId: property?.id ?? deal.property_id ?? undefined,
          photo: property?.photos?.[0],
          kycStatus: kycDossier?.dossier_status ?? 'none',
          offers: offerChain ?? [],
          notes: deal.notes ?? '',
          createdAt: deal.created_at,
        }
      : null)

  // Brouillon local initialisé à l'entrée en édition (pas d'effet de sync :
  // hors édition on affiche `vm.notes` directement).
  const [draft, setDraft] = useState('')
  const [notesEditing, setNotesEditing] = useState(false)

  if (live && isLoading) return <div style={fullState(tk.muted, MOBILE_FONT)}>{t('deal.loading')}</div>
  if (live && isError) return <div style={fullState(tk.muted, MOBILE_FONT)}>{t('deal.load_error', { message: t('deal.error_unknown') })}</div>
  if (!vm) return <div style={fullState(tk.muted, MOBILE_FONT)}>{t('deal.not_found')}</div>

  const stepIdx = dealStepperIndex(vm.stage)
  const kycBlocking = vm.kycStatus !== 'verified' && isStageKycBlocking(vm.stage)
  const current = lastOffer(vm.offers)
  const buyerLabel = vm.buyerName || t('deal.buyer_fallback')

  const card: CSSProperties = { background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: tk.shadowSm, padding: 'var(--crm-space-3xl)' }
  const sectionTitle: CSSProperties = { margin: '24px 2px 11px', fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.4, color: tk.ink }

  const offreRoute = (kind: 'nouvelle' | 'contre') => `/dashboard/transactions/${vm.id}/offre/${kind}`

  const setOfferStatus = (offer: Offer, status: Exclude<OfferStatus, 'pending'>) => {
    if (!live || !vm.id) {
      showToast(t(`deal.offer_status.${status}`))
      return
    }
    if (!window.confirm(t(`deal.offer_confirm.${status}`))) return
    updateOfferStatus.mutate(
      { offerId: offer.id, dealId: vm.id, status },
      { onError: (e) => showToast(t('deal.offer_update_failed', { message: e instanceof Error ? e.message : '' })) },
    )
  }

  const saveNotes = () => {
    setNotesEditing(false)
    if (live && vm.id) void updateNotes.mutateAsync({ id: vm.id, notes: draft })
  }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, padding: '0 var(--crm-space-4xl) var(--crm-space-md)' }}>
      {/* HERO */}
      <div style={{ position: 'relative', borderRadius: 'var(--crm-radius-5xl)', overflow: 'hidden', marginTop: 6, minHeight: 196, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', boxShadow: tk.shadow }}>
        {vm.photo ? (
          <img src={vm.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#1A1B22' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,9,12,.35) 0%, rgba(8,9,12,.92) 100%)' }} />
        <div style={{ position: 'relative', padding: 'var(--crm-space-4xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: 'rgba(255,255,255,.78)'}}>
            {t('deal.pipeline_stage', { stage: t(`stages.${mapTransactionStageToStepper(vm.stage)}`) })}
          </div>
          <h1 style={{ margin: '5px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 500, letterSpacing: -0.7, lineHeight: 1.05 }}>{buyerLabel}</h1>
          {vm.propertyTitle ? <div style={{ fontSize: 'var(--crm-text-lg)', color: 'rgba(255,255,255,.82)', marginTop: 3 }}>{vm.propertyTitle}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.4 }}>{formatCHF(vm.value)}</span>
            {current && current.amount !== vm.value ? (
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>{t('deal.last_offer', { amount: formatCHF(current.amount) })}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* STEPPER (read-only) */}
      <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', marginTop: 16 }}>
        {DEAL_STEPPER_ORDER.map((s, i) => {
          const done = i < stepIdx
          const active = i === stepIdx
          return <span key={s} title={t(`stages.${s}`)} style={{ flex: 1, height: 4, borderRadius: 'var(--crm-radius-pill)', background: done ? tk.goal : active ? tk.accent : tk.hair }} />
        })}
      </div>
      <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, marginTop: 8, letterSpacing: 0.2 }}>{t(`stages.${mapTransactionStageToStepper(vm.stage)}`)}</div>

      {/* KYC banner — informative, NON-bloquante */}
      {kycBlocking ? (
        <div style={{ marginTop: 16, background: tk.accent, color: tk.accentInk, borderRadius: 'var(--crm-radius-3xl)', padding: 'var(--crm-space-3xl) var(--crm-space-3xl) var(--crm-space-2xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
            <MEIcon name="shield" size={16} color={tk.accentInk} />
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2 }}>{t('deal.kyc_banner_title')}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/kyc${vm.buyerId ? `?contactId=${vm.buyerId}` : ''}`)}
            style={{ marginTop: 12, height: 40, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: tk.ctaBg, color: tk.ctaInk }}
          >
            {t('deal.open_kyc_dossier')}
          </button>
        </div>
      ) : null}

      {/* PARTIES */}
      <div style={sectionTitle}>{t('deal.buyer')}</div>
      <button
        type="button"
        onClick={() => vm.buyerId && navigate(`/dashboard/contacts/${vm.buyerId}`)}
        style={{ ...card, width: '100%', textAlign: 'left', cursor: vm.buyerId ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}
      >
        <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', background: tk.accent, color: tk.accentInk, fontSize: 'var(--crm-text-xl)', fontWeight: 600, flexShrink: 0 }}>{vm.buyerInitials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{buyerLabel}</div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 3, flexWrap: 'wrap' }}>
            {vm.buyerBudgetMax != null ? (
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted }}>
                {t('deal.capacity')} {formatCHF(vm.buyerBudgetMin ?? 0)} — {formatCHF(vm.buyerBudgetMax)}
              </span>
            ) : null}
            {vm.buyerProb != null ? (
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.goal }}>{t('deal.purchase_probability', { value: vm.buyerProb })}</span>
            ) : null}
          </div>
        </div>
        <MEIcon name="chevron-right" size={18} color={tk.ghost} />
      </button>

      {vm.propertyTitle ? (
        <button
          type="button"
          onClick={() => vm.propertyId && navigate(`/dashboard/listings/${vm.propertyId}`)}
          style={{ ...card, width: '100%', textAlign: 'left', cursor: vm.propertyId ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', marginTop: 11 }}
        >
          <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-lg)', display: 'grid', placeItems: 'center', background: tk.cardSubtle, flexShrink: 0 }}>
            <MEIcon name="building" size={20} color={tk.inkSoft} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vm.propertyTitle}</div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, marginTop: 2 }}>
              {vm.propertyAddr}
              {vm.propertySurface != null && vm.propertyRooms != null ? ` · ${t('deal.surface_rooms', { surface: vm.propertySurface, rooms: vm.propertyRooms })}` : ''}
            </div>
          </div>
          {vm.propertyPrice != null ? (
            <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCHF(vm.propertyPrice)}</span>
          ) : null}
        </button>
      ) : null}

      {/* NÉGOCIATION */}
      <div style={sectionTitle}>{t('deal.offers_title')}</div>
      {vm.offers.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 'var(--crm-space-7xl) var(--crm-space-4xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink }}>{t('deal.no_offer_title')}</div>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: tk.muted, marginTop: 5, lineHeight: 1.45 }}>{t('deal.no_offer_subtitle')}</div>
          <button
            type="button"
            onClick={() => navigate(offreRoute('nouvelle'))}
            style={{ marginTop: 16, height: 46, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}
          >
            {t('deal.record_offer')}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            {vm.offers.map((o) => {
              const isCurrent = current?.id === o.id
              const condCount = countActiveConditions(o.conditions)
              return (
                <div key={o.id} style={{ ...card, ...(isCurrent ? { boxShadow: `0 0 0 2px ${tk.accent} inset, ${tk.shadowSm}` } : {}) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
                    <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2, color: tk.muted}}>
                      {o.kind === 'counter' ? t('deal.counter_offer') : t('deal.new_offer')}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: 0.2, color: '#fff', background: STATUS_COLOR[o.status], padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)' }}>
                      {t(`deal.offer_status.${o.status}`)}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: tk.ink, letterSpacing: -0.6, fontVariantNumeric: 'tabular-nums', marginTop: 8 }}>{formatCHF(o.amount)}</div>
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, marginTop: 3 }}>
                    {o.by_label}
                    {condCount > 0 ? ` · ${condCount}` : ''}
                  </div>
                  {isCurrent && o.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 13 }}>
                      <button type="button" onClick={() => setOfferStatus(o, 'rejected')} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.inkSoft, background: tk.cardSubtle }}>
                        {t('deal.offer_status.rejected')}
                      </button>
                      <button type="button" onClick={() => setOfferStatus(o, 'accepted')} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.accentInk, background: tk.accent }}>
                        {t('deal.offer_status.accepted')}
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => navigate(offreRoute(current ? 'contre' : 'nouvelle'))}
            style={{ marginTop: 11, width: '100%', height: 46, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.card, color: tk.ink, boxShadow: tk.shadowSm }}
          >
            {current ? t('deal.counter_offer') : t('deal.new_offer')}
          </button>
        </>
      )}

      {/* NOTES PRIVÉES */}
      <div style={sectionTitle}>{t('deal.private_notes')}</div>
      <div style={card}>
        {notesEditing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              style={{ width: '100%', resize: 'vertical', border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-xl)', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', color: tk.ink, background: tk.cardSubtle, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 10 }}>
              <button type="button" onClick={() => setNotesEditing(false)} style={{ flex: 1, height: 42, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.inkSoft, background: tk.cardSubtle }}>
                {t('deal.notes_cancel')}
              </button>
              <button type="button" onClick={saveNotes} style={{ flex: 1, height: 42, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.accentInk, background: tk.accent }}>
                {updateNotes.isPending ? t('deal.notes_saving') : t('deal.notes_save')}
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => { setDraft(vm.notes); setNotesEditing(true) }} style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: vm.notes ? tk.inkSoft : tk.muted, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{vm.notes || t('deal.notes_empty')}</div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, marginTop: 8 }}>{t('deal.never_visible_client')}</div>
          </button>
        )}
      </div>

      <SgToast toast={toast} />
    </div>
  )
}
