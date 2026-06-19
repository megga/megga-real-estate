// MEGGA CRM Sprint 2 — Fiche Deal Sugar Pure
// Port pixel-près de crm-screen-deal-detail-sugar.jsx (handoff Sprint 2).
//
// Sections :
//   1. Header retour pipeline + actions (modifier / visite / nouvelle offre)
//   2. Hero — acheteur + bien, stepper 8 cercles, montant + sentiment
//   3. Bannière KYC — rappel NON-BLOQUANT (si stage∈{interest-confirmed, offer,
//      signed} ET kyc.status !== 'verified') : recommandation, jamais un verrou
//   4. Grid 2 cols :
//      Main:    Offres & contre-offres (timeline filiation) · Activité
//      Sidebar: Acheteur · Bien · Prochaine action · Documents · Notes privées
//
// Route : /dashboard/transactions/:id

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SugarV3, SUGAR_V3_KEYFRAMES, fmtDateTime } from '@/components/crm-sugar-v3/tokens'
import { SgIcon } from '@/components/crm-sugar-v3/icons'
import {
  SgBlackPill,
  SgGhostPill,
  SgCircleBtn,
} from '@/components/crm-sugar-v3/primitives'
import { isStageKycBlocking } from '@/components/crm-sugar-v3/dealStepper'
import {
  DdEyebrow,
  DdCard,
  DdStageStepper,
  DdKycChip,
  DdSentimentChip,
  DdOfferCard,
  ddFmt,
} from '@/components/crm-sugar-v3/deal-detail/DdShared'
import { useTransaction, useUpdateTransactionNotes } from '@/hooks/useTransactions'
import { useContact } from '@/hooks/useContacts'
import { useProperty } from '@/hooks/useProperties'
import { useOfferChain, lastOffer, useUpdateOfferStatus } from '@/hooks/useOffers'
import { useKycDossierByContact } from '@/hooks/useKycDossier'
import type { TransactionStage } from '@/lib/constants'
import {
  DEAL_STEPPER_LABELS,
  mapTransactionStageToStepper,
} from '@/components/crm-sugar-v3/dealStepper'

interface TransactionJoined {
  id: string
  agency_id: string
  property_id: string
  contact_buyer_id: string | null
  contact_seller_id: string | null
  assigned_to: string
  stage: TransactionStage
  status: string
  price_offered: number | null
  price_final: number | null
  mandate_type: string | null
  notes: string | null
  created_at: string
  updated_at: string
  property?: {
    id?: string
    title?: string
    address?: string
    city?: string
    canton?: string
    price?: number | null
  } | null
}

export default function DealDetailSugarV3Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: dealRaw, isLoading, isError, error } = useTransaction(id)
  const deal = dealRaw as TransactionJoined | undefined
  const { data: contact } = useContact(deal?.contact_buyer_id ?? undefined)
  const { data: property } = useProperty(deal?.property_id)
  const { data: offerChain } = useOfferChain(deal?.id)
  const { data: kycDossier } = useKycDossierByContact(
    deal?.contact_buyer_id ?? undefined,
  )

  const [notesEditing, setNotesEditing] = useState(false)
  const [privateNotes, setPrivateNotes] = useState<string>('')

  // Sync notes depuis Supabase quand le deal charge (ou s'invalide après save)
  useEffect(() => {
    setPrivateNotes(deal?.notes ?? '')
  }, [deal?.notes])

  const updateNotes = useUpdateTransactionNotes()
  const handleNotesSave = async () => {
    if (!deal?.id) return
    try {
      await updateNotes.mutateAsync({ id: deal.id, notes: privateNotes })
      setNotesEditing(false)
    } catch (err) {
       
      console.error('[DealDetail] save notes failed', err)
    }
  }
  const handleNotesCancel = () => {
    setPrivateNotes(deal?.notes ?? '')
    setNotesEditing(false)
  }

  const offers = useMemo(() => offerChain ?? [], [offerChain])
  const last = lastOffer(offers)
  const updateOfferStatus = useUpdateOfferStatus()

  const kycStatus = kycDossier?.dossier_status ?? 'none'
  const kycBlocking =
    kycStatus !== 'verified' && deal && isStageKycBlocking(deal.stage)

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: SugarV3.bgGradient,
          display: 'grid',
          placeItems: 'center',
          color: SugarV3.muted,
          fontFamily: SugarV3.font,
        }}
      >
        Chargement du deal…
      </div>
    )
  }
  if (isError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: SugarV3.bgGradient,
          display: 'grid',
          placeItems: 'center',
          color: SugarV3.err,
          fontFamily: SugarV3.font,
          padding: 40,
          textAlign: 'center',
        }}
      >
        Erreur de chargement du deal : {error?.message ?? 'inconnue'}
      </div>
    )
  }
  if (!deal) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: SugarV3.bgGradient,
          display: 'grid',
          placeItems: 'center',
          color: SugarV3.muted,
          fontFamily: SugarV3.font,
        }}
      >
        Deal introuvable.
      </div>
    )
  }

  const dealValue =
    deal.price_offered ?? deal.price_final ?? property?.price ?? 0
  const contactName = contact
    ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
    : 'Acheteur'
  const initials = contact
    ? `${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div
      data-screen-label="Fiche Deal (Sugar v3)"
      style={{
        width: '100%',
        minHeight: '100vh',
        background: SugarV3.bgGradient,
        color: SugarV3.ink,
        fontFamily: SugarV3.font,
      }}
    >
      <style>{SUGAR_V3_KEYFRAMES}</style>

      <main style={{ padding: '28px 40px 80px', minWidth: 0 }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 32,
            flexWrap: 'wrap',
          }}
        >
          <SgGhostPill
            icon={<SgIcon name="arrowL" size={15} stroke={SugarV3.inkSoft} />}
            onClick={() => navigate('/dashboard/pipeline')}
          >
            Pipeline
          </SgGhostPill>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'nowrap',
              fontSize: 12,
              color: SugarV3.muted,
              letterSpacing: 0.3,
            }}
          >
            {deal.id.slice(0, 8).toUpperCase()}
          </span>
          <div style={{ flex: 1 }} />
          <SgCircleBtn
            icon={<SgIcon name="pencil" size={17} stroke={SugarV3.inkSoft} />}
            title="Modifier"
          />
          <SgCircleBtn
            icon={<SgIcon name="cal" size={17} stroke={SugarV3.inkSoft} />}
            title="Planifier une visite"
            onClick={() =>
              navigate(
                `/dashboard/visits/nouveau?bienId=${deal.property_id}&contactId=${deal.contact_buyer_id ?? ''}&dealId=${deal.id}`,
              )
            }
          />
          {deal.stage !== 'signed' && (
            <SgBlackPill
              icon={
                <SgIcon
                  name={last ? 'swap' : 'plus'}
                  size={14}
                  stroke="#fff"
                />
              }
              onClick={() =>
                navigate(
                  `/dashboard/transactions/${deal.id}/offre/${last ? 'contre' : 'nouvelle'}`,
                )
              }
            >
              {last ? 'Contre-offre' : 'Nouvelle offre'}
            </SgBlackPill>
          )}
        </header>

        {/* HERO */}
        <DdCard padding={32} style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 24,
              flexWrap: 'wrap',
              marginBottom: 28,
            }}
          >
            <div style={{ flex: 1, minWidth: 280 }}>
              <DdEyebrow>
                Pipeline ·{' '}
                {DEAL_STEPPER_LABELS[mapTransactionStageToStepper(deal.stage)]}
              </DdEyebrow>
              <h1
                style={{
                  margin: '12px 0 12px',
                  fontSize: 36,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.8,
                  lineHeight: 1.15,
                }}
              >
                {contactName}
                {property && (
                  <span style={{ color: SugarV3.muted, fontWeight: 500 }}>
                    {' '}
                    · {property.title}
                  </span>
                )}
              </h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <DdKycChip status={kycStatus} />
                <DdSentimentChip tone="healthy" label="Sain" />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: SugarV3.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                Montant du deal
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 42,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -1,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {ddFmt(dealValue)}
              </div>
              {last && last.amount !== dealValue && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: SugarV3.muted,
                    fontWeight: 500,
                  }}
                >
                  Dernière offre : {ddFmt(last.amount)}
                </div>
              )}
            </div>
          </div>

          <DdStageStepper stage={deal.stage} />
        </DdCard>

        {/* BANNIÈRE KYC — RAPPEL NON-BLOQUANT (recommandation, pas un verrou) */}
        {kycBlocking && (
          <div
            style={{
              marginBottom: 20,
              padding: 24,
              borderRadius: 22,
              background: SugarV3.ink,
              color: '#fff',
              boxShadow: SugarV3.shadow,
              animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.10)',
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SgIcon name="lock" size={20} stroke="#fff" sw={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div
                style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}
              >
                KYC recommandé avant la signature
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.5,
                }}
              >
                Un KYC vérifié pour{' '}
                <strong style={{ color: '#fff', fontWeight: 700 }}>
                  {contactName}
                </strong>{' '}
                est recommandé avant la signature, en appui de conformité LBA
                (pas un verrou). Vous pouvez poursuivre la négociation et la
                signature ; la vérification finale revient au notaire.
              </div>
            </div>
            <button
              onClick={() =>
                navigate(`/dashboard/kyc?contactId=${deal.contact_buyer_id}`)
              }
              style={{
                height: 42,
                padding: '0 22px',
                borderRadius: 999,
                border: 0,
                background: '#fff',
                color: SugarV3.ink,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <SgIcon name="shield" size={14} stroke={SugarV3.ink} sw={2} />
              Ouvrir le dossier KYC
            </button>
          </div>
        )}

        {/* GRID 2 COLONNES */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.55fr 1fr',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              minWidth: 0,
            }}
          >
            {/* Offres & contre-offres */}
            <DdCard>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <DdEyebrow>
                    Négociation · {offers.length}{' '}
                    {offers.length > 1 ? 'tours' : 'tour'}
                  </DdEyebrow>
                  <h2
                    style={{
                      margin: '10px 0 0',
                      fontSize: 22,
                      fontWeight: 700,
                      color: SugarV3.ink,
                      letterSpacing: -0.4,
                    }}
                  >
                    Offres & contre-offres
                  </h2>
                </div>
                {offers.length > 0 && deal.stage !== 'signed' && (
                  <SgGhostPill
                    icon={
                      <SgIcon
                        name="swap"
                        size={14}
                        stroke={SugarV3.inkSoft}
                      />
                    }
                    onClick={() =>
                      navigate(`/dashboard/transactions/${deal.id}/offre/contre`)
                    }
                  >
                    Contre-offre
                  </SgGhostPill>
                )}
              </div>

              {offers.length === 0 ? (
                <div
                  style={{
                    marginTop: 22,
                    padding: 28,
                    borderRadius: 18,
                    background: SugarV3.cardSubtle,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: SugarV3.ink,
                      marginBottom: 6,
                    }}
                  >
                    Aucune offre déposée
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: SugarV3.muted,
                      marginBottom: 18,
                      lineHeight: 1.5,
                    }}
                  >
                    Quand l'acheteur sera prêt, vous pourrez saisir son offre
                    formelle ici.
                  </div>
                  <SgBlackPill
                    icon={<SgIcon name="plus" size={14} stroke="#fff" />}
                    onClick={() =>
                      navigate(
                        `/dashboard/transactions/${deal.id}/offre/nouvelle`,
                      )
                    }
                  >
                    Saisir une offre
                  </SgBlackPill>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  {offers.map((o, i) => (
                    <DdOfferCard
                      key={o.id}
                      offer={o}
                      isCurrent={i === offers.length - 1}
                      onUpdateStatus={(status) => {
                        if (typeof window !== 'undefined') {
                          const verb =
                            status === 'accepted' ? 'accepter'
                            : status === 'rejected' ? 'refuser'
                            : status === 'withdrawn' ? 'retirer'
                            : 'marquer expirée'
                          if (!window.confirm(`Voulez-vous ${verb} cette offre ?`)) return
                        }
                        updateOfferStatus.mutate(
                          { offerId: o.id, dealId: deal!.id, status },
                          {
                            onError: (err) => {
                               
                              window.alert(`Échec : ${err.message}`)
                            },
                          }
                        )
                      }}
                    />
                  ))}
                </div>
              )}
            </DdCard>

            {/* Activité récente */}
            <DdCard>
              <DdEyebrow>Activité récente</DdEyebrow>
              <h2
                style={{
                  margin: '10px 0 22px',
                  fontSize: 22,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.4,
                }}
              >
                Timeline du deal
              </h2>
              <div style={{ position: 'relative', paddingLeft: 22 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: 6,
                    bottom: 6,
                    width: 2,
                    background: SugarV3.cardSubtle,
                    borderRadius: 999,
                  }}
                />
                {[
                  ...offers.map((o) => ({
                    at: o.created_at,
                    kind: o.kind,
                    label:
                      o.kind === 'counter'
                        ? `Contre-offre de ${o.by_label}`
                        : `Offre de ${o.by_label}`,
                    detail: ddFmt(o.amount),
                  })),
                  {
                    at: deal.created_at,
                    kind: 'system' as const,
                    label: 'Deal créé',
                    detail: '',
                  },
                ]
                  .sort(
                    (a, b) =>
                      new Date(b.at).getTime() - new Date(a.at).getTime(),
                  )
                  .slice(0, 8)
                  .map((e, i, arr) => (
                    <div
                      key={i}
                      style={{
                        position: 'relative',
                        marginBottom: i === arr.length - 1 ? 0 : 18,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: -22,
                          top: 4,
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          background:
                            e.kind === 'offer' || e.kind === 'counter'
                              ? SugarV3.ink
                              : SugarV3.cardSubtle,
                          border: `3px solid ${SugarV3.card}`,
                          boxShadow: SugarV3.shadowSm,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 11,
                          color: SugarV3.muted,
                          fontWeight: 600,
                          marginBottom: 3,
                        }}
                      >
                        {fmtDateTime(e.at)}
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          color: SugarV3.ink,
                          fontWeight: 600,
                          lineHeight: 1.5,
                        }}
                      >
                        {e.label}
                        {e.detail && (
                          <span
                            style={{
                              marginLeft: 10,
                              fontWeight: 700,
                              color: SugarV3.ink,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            · {e.detail}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </DdCard>
          </div>

          {/* SIDEBAR */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              minWidth: 0,
            }}
          >
            {/* Acheteur */}
            {contact && (
              <DdCard padding={24}>
                <DdEyebrow>Acheteur</DdEyebrow>
                <button
                  onClick={() => navigate(`/dashboard/contacts/${contact.id}`)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    marginTop: 14,
                    padding: 16,
                    background: SugarV3.cardSubtle,
                    border: 0,
                    borderRadius: 18,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      background: SugarV3.ink,
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: SugarV3.ink,
                      }}
                    >
                      {contactName}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: SugarV3.muted,
                        fontWeight: 500,
                      }}
                    >
                      Voir la fiche complète
                    </div>
                  </div>
                </button>

                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <SgCircleBtn
                    icon={
                      <SgIcon
                        name="phone"
                        size={15}
                        stroke={SugarV3.inkSoft}
                      />
                    }
                    title="Appeler"
                    size={38}
                  />
                  <SgCircleBtn
                    icon={
                      <SgIcon
                        name="mail"
                        size={15}
                        stroke={SugarV3.inkSoft}
                      />
                    }
                    title="Email"
                    size={38}
                  />
                  <SgCircleBtn
                    icon={
                      <SgIcon name="msg" size={15} stroke={SugarV3.inkSoft} />
                    }
                    title="Message"
                    size={38}
                  />
                </div>

                {/* Capacité (search_criteria.budget_min/max) — HIGH-4 audit */}
                {contact.search_criteria?.budget_max != null && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 14,
                      background: SugarV3.cardSubtle,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: SugarV3.muted,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Capacité
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: SugarV3.ink,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {contact.search_criteria.budget_min
                        ? `${ddFmt(contact.search_criteria.budget_min)} — `
                        : ''}
                      {ddFmt(contact.search_criteria.budget_max)}
                    </div>
                  </div>
                )}

                {/* Pill probabilité achat (HIGH-5 audit) */}
                {contact.ai_purchase_probability != null && (
                  <div
                    style={{
                      marginTop: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: SugarV3.cardSubtle,
                      color: SugarV3.inkSoft,
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    <SgIcon
                      name="target"
                      size={11}
                      stroke={SugarV3.inkSoft}
                      sw={1.8}
                    />
                    {contact.ai_purchase_probability}% probabilité d'achat
                  </div>
                )}
              </DdCard>
            )}

            {/* Bien */}
            {property && (
              <DdCard padding={24}>
                <DdEyebrow>Bien</DdEyebrow>
                <button
                  onClick={() =>
                    navigate(`/dashboard/listings/${property.id}`)
                  }
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    marginTop: 14,
                    padding: 14,
                    background: SugarV3.cardSubtle,
                    border: 0,
                    borderRadius: 18,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: 700,
                      color: SugarV3.ink,
                      marginBottom: 4,
                    }}
                  >
                    {property.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: SugarV3.muted,
                      fontWeight: 500,
                      marginBottom: 12,
                    }}
                  >
                    {property.address} · {property.canton}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: SugarV3.ink,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {ddFmt(property.price)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: SugarV3.muted,
                        fontWeight: 600,
                      }}
                    >
                      {property.surface_m2} m² · {property.rooms} pièces
                    </div>
                  </div>
                </button>
              </DdCard>
            )}

            {/* Documents */}
            <DdCard padding={24}>
              <DdEyebrow>Documents</DdEyebrow>
              <h3
                style={{
                  margin: '10px 0 14px',
                  fontSize: 18,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.3,
                }}
              >
                Du deal
              </h3>
              {(() => {
                const docs: {
                  name: string
                  status: 'signed' | 'pending' | 'missing'
                  pages: number | null
                }[] = []
                if (offers.length > 0) {
                  docs.push({
                    name: `Offre formelle — ${offers[0].by_label}`,
                    status:
                      offers[0].status === 'accepted' ? 'signed' : 'pending',
                    pages: 4,
                  })
                }
                if (offers.length > 1) {
                  docs.push({
                    name: `Contre-offre — ${offers[1].by_label}`,
                    status:
                      offers[1].status === 'accepted' ? 'signed' : 'pending',
                    pages: 3,
                  })
                }
                if (kycStatus === 'verified') {
                  docs.push({
                    name: 'KYC acheteur — dossier complet',
                    status: 'signed',
                    pages: 6,
                  })
                }
                if (deal.stage === 'notary' || deal.stage === 'signed') {
                  docs.push({
                    name: 'Compromis de vente',
                    status:
                      deal.stage === 'signed' ? 'signed' : 'missing',
                    pages: null,
                  })
                }
                if (docs.length === 0) {
                  return (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        background: SugarV3.cardSubtle,
                        fontSize: 12.5,
                        color: SugarV3.muted,
                        fontWeight: 500,
                      }}
                    >
                      Aucun document généré pour ce deal.
                    </div>
                  )
                }
                const tone = {
                  signed: { l: 'Signé', c: SugarV3.ok },
                  pending: { l: 'En attente', c: SugarV3.warn },
                  missing: { l: 'À générer', c: SugarV3.muted },
                } as const
                return (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {docs.map((d, i) => {
                      const t = tone[d.status]
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 14,
                            background: SugarV3.cardSubtle,
                          }}
                        >
                          <SgIcon
                            name="file"
                            size={14}
                            stroke={SugarV3.inkSoft}
                            sw={1.8}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: SugarV3.ink,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {d.name}
                            </div>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                marginTop: 2,
                                fontSize: 10.5,
                                color: SugarV3.muted,
                                fontWeight: 600,
                              }}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: 999,
                                  background: t.c,
                                }}
                              />
                              {t.l}
                              {d.pages && <> · {d.pages} pages</>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </DdCard>

            {/* Notes privées */}
            <DdCard padding={24}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <DdEyebrow>Notes privées</DdEyebrow>
                {!notesEditing && (
                  <button
                    onClick={() => setNotesEditing(true)}
                    style={{
                      height: 30,
                      padding: '0 12px',
                      borderRadius: 999,
                      border: 0,
                      background: SugarV3.cardSubtle,
                      color: SugarV3.ink,
                      fontFamily: 'inherit',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <SgIcon
                      name="pencil"
                      size={11}
                      stroke={SugarV3.ink}
                      sw={2}
                    />
                    Modifier
                  </button>
                )}
              </div>
              <h3
                style={{
                  margin: '10px 0 14px',
                  fontSize: 18,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.3,
                }}
              >
                Équipe MEGGA
              </h3>
              {notesEditing ? (
                <div>
                  <textarea
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    rows={6}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 14,
                      background: SugarV3.cardSubtle,
                      border: 0,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      color: SugarV3.ink,
                      lineHeight: 1.6,
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      onClick={handleNotesCancel}
                      disabled={updateNotes.isPending}
                      style={{
                        height: 36,
                        padding: '0 16px',
                        borderRadius: 999,
                        border: 0,
                        background: 'transparent',
                        color: SugarV3.inkSoft,
                        fontFamily: 'inherit',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: updateNotes.isPending ? 'not-allowed' : 'pointer',
                        opacity: updateNotes.isPending ? 0.5 : 1,
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleNotesSave}
                      disabled={updateNotes.isPending}
                      style={{
                        height: 36,
                        padding: '0 18px',
                        borderRadius: 999,
                        border: 0,
                        background: SugarV3.ink,
                        color: '#fff',
                        fontFamily: 'inherit',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: updateNotes.isPending ? 'wait' : 'pointer',
                        opacity: updateNotes.isPending ? 0.7 : 1,
                      }}
                    >
                      {updateNotes.isPending ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    background: SugarV3.cardSubtle,
                    fontSize: 13,
                    color: SugarV3.inkSoft,
                    lineHeight: 1.7,
                    fontWeight: 500,
                  }}
                >
                  {privateNotes ||
                    "Notes privées — visibles uniquement par l'équipe MEGGA."}
                </div>
              )}
              <div
                style={{
                  marginTop: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: SugarV3.cardSubtle,
                  color: SugarV3.muted,
                  fontSize: 10.5,
                  fontWeight: 600,
                }}
              >
                <SgIcon name="lock" size={10} stroke={SugarV3.muted} sw={2} />
                Jamais visible par le client
              </div>
            </DdCard>
          </div>
        </div>
      </main>
    </div>
  )
}
