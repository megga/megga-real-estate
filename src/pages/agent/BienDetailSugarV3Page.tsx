// MEGGA CRM Sprint 2 — Fiche Bien Sugar Pure
// Port pixel-près de crm-screen-bien-detail-sugar.jsx (handoff Sprint 2).
//
// Sections :
//   1. Header retour + ref + actions (édition / visite / publier)
//   2. Hero — photo + titre + prix + KPIs (vues/favoris/demandes)
//   3. Grid 2 colonnes :
//      - Main   : Caractéristiques · Description (public/privée) · Deals liés
//      - Sidebar: Mandat · Publication · Historique
// + Mode édition inline (12+ champs), toast confirmation 5s, AuditEvent.
//
// Route : /dashboard/listings/:id

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SugarV3, SUGAR_V3_KEYFRAMES, fmtDateShort } from '@/components/crm-sugar-v3/tokens'
import { SgIcon } from '@/components/crm-sugar-v3/icons'
import {
  SgBlackPill,
  SgGhostPill,
  SgCircleBtn,
} from '@/components/crm-sugar-v3/primitives'
import {
  BdEyebrow,
  BdCard,
  BdEditInput,
  BdStatusChip,
  BdPhoto,
  bdFormatPrice,
  bdPricePerM2,
  bdFmtCHF,
  BD_STAGE_LABEL,
} from '@/components/crm-sugar-v3/bien-detail/BdShared'
import {
  useProperty,
  useUpdateProperty,
  type CreatePropertyInput,
} from '@/hooks/useProperties'
import { useTransactions } from '@/hooks/useTransactions'
import { useContacts } from '@/hooks/useContacts'
import { useLogAudit } from '@/hooks/useAuditLog'
import type { Property } from '@/types/listing'

interface BienEditDraft {
  title: string
  address: string
  price: number | string
  charges_monthly: number | string
  surface_m2: number | string
  rooms: number | string
  bedrooms: number | string
  bathrooms: number | string
  year_built: number | string
  energy_class: string
  description: string
  mandate_type: string
  mandate_commission_pct: number | string
  mandate_expires_at: string
}

function buildDraft(b: Property | null | undefined): BienEditDraft {
  return {
    title: b?.title ?? '',
    address: b?.address ?? '',
    price: b?.price ?? 0,
    charges_monthly: b?.charges_monthly ?? 0,
    surface_m2: b?.surface_m2 ?? 0,
    rooms: b?.rooms ?? 0,
    bedrooms: b?.bedrooms ?? 0,
    bathrooms: b?.bathrooms ?? 0,
    year_built: b?.year_built ?? '',
    energy_class: b?.energy_class ?? '',
    description: b?.description ?? '',
    mandate_type: b?.mandate_type ?? 'exclusive',
    mandate_commission_pct: b?.mandate_commission_pct ?? 3.0,
    mandate_expires_at: b?.mandate_expires_at ?? '',
  }
}

function asNum(v: number | string): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export default function BienDetailSugarV3Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: bien, isLoading, isError, error } = useProperty(id)
  const { mutate: updateProperty, isPending: isSaving } = useUpdateProperty()
  const { mutate: logAudit } = useLogAudit()

  const { data: transactions } = useTransactions()
  const dealsForBien = useMemo(
    () => (transactions ?? []).filter((t) => t.property_id === id),
    [transactions, id],
  )

  const { contacts: contactsAll } = useContacts()
  const contactsById = useMemo(() => {
    const m = new Map<string, { id: string; first_name: string; last_name: string }>()
    ;(contactsAll ?? []).forEach((c) => {
      m.set(c.id, {
        id: c.id,
        first_name: c.first_name ?? '',
        last_name: c.last_name ?? '',
      })
    })
    return m
  }, [contactsAll])

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BienEditDraft>(() => buildDraft(bien))
  const [descTab, setDescTab] = useState<'public' | 'private'>('public')
  const [privateDesc, setPrivateDesc] = useState(
    "Notes privées — visibles uniquement par l'équipe MEGGA.",
  )
  const [editPrivate, setEditPrivate] = useState(false)
  const [toast, setToast] = useState<{ title: string; actions: string[] } | null>(
    null,
  )

  // Re-init draft when bien arrives ou change (hors édition)
  useEffect(() => {
    if (!editing) setDraft(buildDraft(bien))
  }, [bien, editing])

  // Auto-dismiss du toast — cleanup obligatoire pour éviter setState on unmount
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

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
        Chargement du bien…
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
        Erreur de chargement du bien : {error?.message ?? 'inconnue'}
      </div>
    )
  }
  if (!bien) {
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
        Bien introuvable.
      </div>
    )
  }

  const isRent = bien.transaction_type === 'rent'
  const priceLabel = bdFormatPrice(bien.price, isRent)
  const ppm2 = bdPricePerM2(bien.price, bien.surface_m2)
  const publicDesc =
    bien.description ||
    `Bien de ${bien.rooms} pièces (${bien.surface_m2} m²) situé ${bien.address}. ` +
      `Construit en ${bien.year_built || '—'}, classe énergétique ${
        bien.energy_class || 'non renseignée'
      }.`

  // Pas de date hardcodée : on calcule "dans X jours" depuis maintenant.
  const mandatExp = bien.mandate_expires_at ? new Date(bien.mandate_expires_at) : null
  const daysToExp = mandatExp
    ? Math.round((mandatExp.getTime() - Date.now()) / 86_400_000)
    : null

  // ─── Édition ──────────────────────────────────────────────────────────
  const setField = <K extends keyof BienEditDraft>(k: K, v: BienEditDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))
  const startEditing = () => {
    setDraft(buildDraft(bien))
    setEditing(true)
  }
  const cancelEditing = () => {
    setDraft(buildDraft(bien))
    setEditing(false)
  }
  const saveAndPublish = () => {
    const patch: { id: string } & Partial<CreatePropertyInput> = {
      id: bien.id,
      title: draft.title,
      address: draft.address,
      description: draft.description,
    }
    const price = asNum(draft.price)
    if (price != null) patch.price = price
    const charges = asNum(draft.charges_monthly)
    if (charges != null) patch.charges_monthly = charges
    const area = asNum(draft.surface_m2)
    if (area != null) patch.surface_m2 = area
    const rooms = asNum(draft.rooms)
    if (rooms != null) patch.rooms = rooms
    const beds = asNum(draft.bedrooms)
    if (beds != null) patch.bedrooms = beds
    const baths = asNum(draft.bathrooms)
    if (baths != null) patch.bathrooms = baths
    const year = asNum(draft.year_built)
    if (year != null) patch.year_built = year
    if (draft.energy_class) patch.energy_class = draft.energy_class
    if (draft.mandate_type) patch.mandate_type = draft.mandate_type
    const commission = asNum(draft.mandate_commission_pct)
    if (commission != null) patch.mandate_commission_pct = commission
    if (draft.mandate_expires_at) patch.mandate_expires_at = draft.mandate_expires_at

    updateProperty(patch, {
      onSuccess: () => {
        // AuditEvent nLPD 'Annonce modifiée' (category=bien, severity=info)
        logAudit({
          category: 'bien',
          severity: 'info',
          action: 'Annonce modifiée',
          entityType: 'property',
          entityId: bien.id,
          objectLabel: draft.title || bien.title,
          metadata: {
            price: price ?? bien.price,
            mandate_type: draft.mandate_type,
            surface_m2: area ?? bien.surface_m2,
          },
        })
        setEditing(false)
        setToast({
          title: 'Annonce mise à jour',
          actions: [
            bien.published_at
              ? 'Re-publiée sur les portails actifs'
              : null,
            'Notification envoyée au vendeur',
            "Entrée ajoutée au journal d'audit nLPD",
          ].filter((x): x is string => !!x),
        })
        // L'auto-dismiss 5s est géré par l'useEffect [toast] avec cleanup safe.
      },
    })
  }

  return (
    <div
      data-screen-label="Fiche Bien (Sugar v3)"
      style={{
        width: '100%',
        minHeight: '100vh',
        background: SugarV3.bgGradient,
        color: SugarV3.ink,
        fontFamily: SugarV3.font,
      }}
    >
      <style>{SUGAR_V3_KEYFRAMES}</style>
      <style>{`
        @keyframes vdPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes bdToastIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

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
            onClick={() => navigate('/dashboard/listings')}
          >
            Mes biens
          </SgGhostPill>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: SugarV3.muted,
              letterSpacing: 0.3,
              whiteSpace: 'nowrap',
            }}
          >
            {bien.id.slice(0, 8).toUpperCase()}
          </span>
          <div style={{ flex: 1 }} />
          {editing && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: SugarV3.ink,
                color: '#fff',
                fontSize: 11.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: SugarV3.warn,
                  animation: 'vdPulse 1.5s ease-in-out infinite',
                }}
              />
              Édition en cours
            </span>
          )}
          <SgCircleBtn
            icon={
              <SgIcon
                name={editing ? 'close' : 'pencil'}
                size={editing ? 18 : 17}
                stroke={SugarV3.inkSoft}
              />
            }
            title={editing ? 'Annuler les modifications' : 'Modifier'}
            onClick={editing ? cancelEditing : startEditing}
          />
          <SgCircleBtn
            icon={<SgIcon name="cal" size={17} stroke={SugarV3.inkSoft} />}
            title="Planifier une visite"
            onClick={() => navigate(`/dashboard/visites/nouveau?bienId=${bien.id}`)}
          />
          <SgBlackPill
            icon={
              <SgIcon
                name={editing ? 'check' : 'arrowUp'}
                size={14}
                stroke="#fff"
                sw={editing ? 2.5 : 1.6}
              />
            }
            disabled={editing && isSaving}
            onClick={editing ? saveAndPublish : startEditing}
          >
            {editing
              ? 'Enregistrer & publier'
              : bien.status === 'draft'
                ? 'Publier le bien'
                : 'Mettre à jour'}
          </SgBlackPill>
        </header>

        {/* HERO */}
        <BdCard padding={0} style={{ marginBottom: 24, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.15fr 1fr',
              minHeight: 460,
            }}
          >
            <div style={{ position: 'relative' }}>
              <BdPhoto
                photos={bien.photos}
                fallbackId={bien.id}
                c2paVerified={bien.c2pa_verified}
                photoCount={bien.photos?.length}
              />
              {bien.photos && bien.photos.length > 0 && (
                <button
                  style={{
                    position: 'absolute',
                    right: 18,
                    bottom: 18,
                    padding: '10px 16px',
                    borderRadius: 999,
                    border: 0,
                    background: 'rgba(255,255,255,0.92)',
                    color: SugarV3.ink,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: SugarV3.shadowSm,
                  }}
                >
                  <SgIcon name="photos" size={13} stroke={SugarV3.ink} />
                  Voir les {bien.photos.length} photos
                </button>
              )}
            </div>
            <div
              style={{
                padding: '44px 40px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <BdEyebrow>
                {bien.canton} · {isRent ? 'Location' : 'Vente'} · {bien.type}
              </BdEyebrow>
              <h1
                style={{
                  margin: '14px 0 10px',
                  fontSize: 36,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.8,
                  lineHeight: 1.15,
                }}
              >
                {editing ? (
                  <BdEditInput
                    value={draft.title}
                    onChange={(v) => setField('title', v)}
                    block
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      letterSpacing: -0.8,
                    }}
                  />
                ) : (
                  bien.title
                )}
              </h1>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  color: SugarV3.muted,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <SgIcon name="pin" size={14} stroke={SugarV3.muted} />
                {editing ? (
                  <BdEditInput
                    value={draft.address}
                    onChange={(v) => setField('address', v)}
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: SugarV3.ink,
                      width: 320,
                    }}
                  />
                ) : (
                  `${bien.address}, ${bien.city}`
                )}
              </div>

              {/* Prix */}
              <div style={{ marginTop: 28 }}>
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -1,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {editing ? (
                    <BdEditInput
                      type="number"
                      prefix="CHF"
                      value={draft.price}
                      onChange={(v) => setField('price', v)}
                      style={{
                        fontSize: 36,
                        fontWeight: 700,
                        letterSpacing: -1,
                        width: 220,
                      }}
                    />
                  ) : (
                    priceLabel
                  )}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: SugarV3.muted,
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {!editing && ppm2 && <span>{ppm2}</span>}
                  {!editing && ppm2 && bien.charges_monthly ? <span>·</span> : null}
                  {editing ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      Charges :
                      <BdEditInput
                        type="number"
                        prefix="CHF"
                        value={draft.charges_monthly}
                        onChange={(v) => setField('charges_monthly', v)}
                        style={{ fontSize: 13, width: 90 }}
                      />
                      {isRent && <span>/mois</span>}
                    </span>
                  ) : (
                    bien.charges_monthly && (
                      <span>
                        + CHF {bien.charges_monthly} charges
                        {isRent ? '/mois' : ''}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Pills statut */}
              <div
                style={{
                  marginTop: 24,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <BdStatusChip status={bien.status} />
                {bien.mandate_type && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: SugarV3.cardSubtle,
                      color: SugarV3.inkSoft,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <SgIcon
                      name="shield"
                      size={11}
                      stroke={SugarV3.inkSoft}
                      sw={2}
                    />
                    Mandat {bien.mandate_type}
                  </span>
                )}
              </div>

              {/* KPIs */}
              <div
                style={{
                  marginTop: 32,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                }}
              >
                {[
                  { l: 'Vues', v: 0, icon: 'eye' as const },
                  { l: 'Favoris', v: 0, icon: 'heart' as const },
                  { l: 'Demandes', v: 0, icon: 'cal' as const },
                ].map((k) => (
                  <div
                    key={k.l}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      background: SugarV3.cardSubtle,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: SugarV3.muted,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      <SgIcon
                        name={k.icon}
                        size={11}
                        stroke={SugarV3.muted}
                        sw={1.8}
                      />
                      {k.l}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 22,
                        fontWeight: 700,
                        color: SugarV3.ink,
                        letterSpacing: -0.4,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {k.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </BdCard>

        {/* GRID 2 COLONNES */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.55fr 1fr',
            gap: 24,
          }}
        >
          {/* COLONNE PRINCIPALE */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              minWidth: 0,
            }}
          >
            {/* Caractéristiques */}
            <BdCard>
              <BdEyebrow>Caractéristiques</BdEyebrow>
              <h2
                style={{
                  margin: '10px 0 22px',
                  fontSize: 22,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.4,
                }}
              >
                Tout savoir sur le bien
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 14,
                }}
              >
                {(
                  [
                    {
                      l: 'Surface habitable',
                      k: 'surface_m2',
                      icon: 'ruler',
                      suffix: 'm²',
                      text: false,
                      value: bien.surface_m2,
                    },
                    { l: 'Pièces', k: 'rooms', icon: 'home', value: bien.rooms },
                    {
                      l: 'Chambres',
                      k: 'bedrooms',
                      icon: 'bed',
                      value: bien.bedrooms,
                    },
                    {
                      l: 'Salles de bain',
                      k: 'bathrooms',
                      icon: 'bath',
                      value: bien.bathrooms,
                    },
                    {
                      l: 'Année construction',
                      k: 'year_built',
                      icon: 'cal',
                      value: bien.year_built ?? '—',
                    },
                    {
                      l: 'Classe énergétique',
                      k: 'energy_class',
                      icon: 'flame',
                      text: true,
                      value: bien.energy_class ?? '—',
                    },
                  ] as Array<{
                    l: string
                    k: keyof BienEditDraft
                    icon: string
                    suffix?: string
                    text?: boolean
                    value: string | number | undefined
                  }>
                ).map((s) => (
                  <div
                    key={s.l}
                    style={{
                      padding: 18,
                      borderRadius: 18,
                      background: SugarV3.cardSubtle,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: SugarV3.muted,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      <SgIcon
                        name={s.icon}
                        size={12}
                        stroke={SugarV3.muted}
                        sw={1.8}
                      />
                      {s.l}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 20,
                        fontWeight: 700,
                        color: SugarV3.ink,
                        letterSpacing: -0.3,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {editing ? (
                        <BdEditInput
                          type={s.text ? 'text' : 'number'}
                          value={draft[s.k] as string | number}
                          onChange={(v) => setField(s.k, v)}
                          suffix={s.suffix}
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            letterSpacing: -0.3,
                            width: 80,
                          }}
                        />
                      ) : s.k === 'surface_m2' ? (
                        `${bien.surface_m2} m²`
                      ) : (
                        s.value
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </BdCard>

            {/* Description */}
            <BdCard>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <BdEyebrow>Description</BdEyebrow>
                <div
                  style={{
                    display: 'inline-flex',
                    gap: 4,
                    padding: 4,
                    borderRadius: 999,
                    background: SugarV3.cardSubtle,
                  }}
                >
                  {(
                    [
                      { id: 'public' as const, l: 'Publique', icon: 'globe' as const },
                      { id: 'private' as const, l: 'Privée', icon: 'lock' as const },
                    ]
                  ).map((o) => {
                    const a = descTab === o.id
                    return (
                      <button
                        key={o.id}
                        onClick={() => setDescTab(o.id)}
                        style={{
                          height: 30,
                          padding: '0 14px',
                          borderRadius: 999,
                          border: 0,
                          background: a ? SugarV3.card : 'transparent',
                          color: a ? SugarV3.ink : SugarV3.muted,
                          fontFamily: 'inherit',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: a ? SugarV3.shadowSm : 'none',
                          transition: 'all .15s ease',
                        }}
                      >
                        <SgIcon
                          name={o.icon}
                          size={11}
                          stroke={a ? SugarV3.ink : SugarV3.muted}
                          sw={1.8}
                        />
                        {o.l}
                      </button>
                    )
                  })}
                </div>
              </div>
              <h2
                style={{
                  margin: '8px 0 18px',
                  fontSize: 22,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.4,
                }}
              >
                {descTab === 'public'
                  ? 'Annonce visible par les acheteurs'
                  : 'Notes équipe MEGGA'}
              </h2>

              {descTab === 'public' ? (
                <div>
                  {editing ? (
                    <textarea
                      value={draft.description}
                      onChange={(e) =>
                        setField('description', e.target.value)
                      }
                      rows={5}
                      style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 14,
                        background: SugarV3.cardSubtle,
                        border: 0,
                        fontFamily: 'inherit',
                        fontSize: 14.5,
                        color: SugarV3.ink,
                        lineHeight: 1.7,
                        resize: 'vertical',
                        outline: 'none',
                        boxSizing: 'border-box',
                        fontWeight: 400,
                        boxShadow: `inset 0 0 0 2px ${SugarV3.ink}`,
                      }}
                    />
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14.5,
                        color: SugarV3.inkSoft,
                        lineHeight: 1.7,
                        fontWeight: 400,
                      }}
                    >
                      {publicDesc}
                    </p>
                  )}

                  {/* Suggestion MEGGA AI */}
                  <div
                    style={{
                      marginTop: 20,
                      padding: '14px 16px',
                      borderRadius: 16,
                      background: SugarV3.cardSubtle,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: SugarV3.ink,
                        color: '#fff',
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <SgIcon name="sparkle" size={13} stroke="#fff" sw={2} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: SugarV3.ink,
                          marginBottom: 3,
                        }}
                      >
                        MEGGA AI · suggestion
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: SugarV3.inkSoft,
                          lineHeight: 1.55,
                        }}
                      >
                        La description gagnerait à mettre en avant{' '}
                        {bien.canton === 'GE'
                          ? 'la proximité du lac'
                          : 'le potentiel locatif'}
                        . Voulez-vous générer 3 variantes&nbsp;?
                      </div>
                    </div>
                    <button
                      style={{
                        height: 32,
                        padding: '0 14px',
                        borderRadius: 999,
                        border: 0,
                        background: SugarV3.card,
                        color: SugarV3.ink,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: SugarV3.shadowSm,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Générer
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {editPrivate ? (
                    <textarea
                      value={privateDesc}
                      onChange={(e) => setPrivateDesc(e.target.value)}
                      rows={6}
                      autoFocus
                      onBlur={() => setEditPrivate(false)}
                      style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 14,
                        background: SugarV3.cardSubtle,
                        border: 0,
                        fontFamily: 'inherit',
                        fontSize: 14,
                        color: SugarV3.ink,
                        lineHeight: 1.6,
                        resize: 'vertical',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setEditPrivate(true)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 16,
                        borderRadius: 14,
                        background: SugarV3.cardSubtle,
                        border: 0,
                        fontFamily: 'inherit',
                        fontSize: 14,
                        color: SugarV3.inkSoft,
                        lineHeight: 1.7,
                        cursor: 'text',
                      }}
                    >
                      {privateDesc}
                    </button>
                  )}
                  <div
                    style={{
                      marginTop: 14,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: SugarV3.cardSubtle,
                      color: SugarV3.muted,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <SgIcon name="lock" size={10} stroke={SugarV3.muted} sw={2} />
                    Visible uniquement par l'équipe MEGGA · jamais publié
                  </div>
                </div>
              )}
            </BdCard>

            {/* Deals liés */}
            {dealsForBien.length > 0 && (
              <BdCard>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <BdEyebrow>
                      Pipeline · {dealsForBien.length} deal
                      {dealsForBien.length > 1 ? 's' : ''} sur ce bien
                    </BdEyebrow>
                    <h2
                      style={{
                        margin: '10px 0 0',
                        fontSize: 22,
                        fontWeight: 700,
                        color: SugarV3.ink,
                        letterSpacing: -0.4,
                      }}
                    >
                      Acheteurs en cours
                    </h2>
                  </div>
                  <SgGhostPill
                    icon={
                      <SgIcon
                        name="arrowR"
                        size={14}
                        stroke={SugarV3.inkSoft}
                      />
                    }
                    onClick={() => navigate('/dashboard/pipeline')}
                  >
                    Pipeline
                  </SgGhostPill>
                </div>
                <div
                  style={{
                    marginTop: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {dealsForBien.map((d) => {
                    const buyerContact =
                      d.contact_buyer_id ? contactsById.get(d.contact_buyer_id) : null
                    const initials = buyerContact
                      ? `${buyerContact.first_name[0] ?? ''}${buyerContact.last_name[0] ?? ''}`.toUpperCase()
                      : '?'
                    return (
                      <button
                        key={d.id}
                        onClick={() =>
                          navigate(`/dashboard/transactions/${d.id}`)
                        }
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '14px 18px',
                          background: SugarV3.cardSubtle,
                          border: 0,
                          borderRadius: 18,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          transition: 'all .15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = SugarV3.card
                          e.currentTarget.style.boxShadow = SugarV3.shadow
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = SugarV3.cardSubtle
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 999,
                            background: SugarV3.ink,
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: SugarV3.ink,
                              marginBottom: 2,
                            }}
                          >
                            {buyerContact
                              ? `${buyerContact.first_name} ${buyerContact.last_name}`
                              : 'Acheteur'}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: SugarV3.muted,
                              fontWeight: 500,
                            }}
                          >
                            {BD_STAGE_LABEL[d.stage] ?? d.stage}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: SugarV3.ink,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {bdFmtCHF(d.price_offered ?? d.price_final)}
                        </div>
                        <SgIcon
                          name="arrowR"
                          size={16}
                          stroke={SugarV3.muted}
                        />
                      </button>
                    )
                  })}
                </div>
              </BdCard>
            )}
          </div>

          {/* SIDEBAR */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              minWidth: 0,
            }}
          >
            {/* Mandat */}
            <BdCard padding={24}>
              <BdEyebrow>Mandat</BdEyebrow>
              {editing ? (
                <div
                  style={{
                    marginTop: 10,
                    marginBottom: 16,
                    display: 'flex',
                    gap: 6,
                    padding: 4,
                    background: SugarV3.cardSubtle,
                    borderRadius: 999,
                  }}
                >
                  {[
                    { v: 'exclusive', l: 'Exclusif' },
                    { v: 'simple', l: 'Simple' },
                    { v: 'semi_exclusive', l: 'Co-mandat' },
                  ].map((o) => {
                    const a = draft.mandate_type === o.v
                    return (
                      <button
                        key={o.v}
                        onClick={() => setField('mandate_type', o.v)}
                        style={{
                          flex: 1,
                          height: 32,
                          borderRadius: 999,
                          border: 0,
                          background: a ? SugarV3.card : 'transparent',
                          color: a ? SugarV3.ink : SugarV3.muted,
                          fontFamily: 'inherit',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: a ? SugarV3.shadowSm : 'none',
                        }}
                      >
                        {o.l}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <h3
                  style={{
                    margin: '10px 0 16px',
                    fontSize: 18,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.3,
                    textTransform: 'capitalize',
                  }}
                >
                  Mandat {bien.mandate_type ?? '—'}
                </h3>
              )}
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {(
                  [
                    {
                      l: 'Commission',
                      edit: editing ? (
                        <BdEditInput
                          type="number"
                          value={draft.mandate_commission_pct}
                          onChange={(v) => setField('mandate_commission_pct', v)}
                          suffix="%"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            width: 60,
                            textAlign: 'right',
                          }}
                        />
                      ) : null,
                      v: bien.mandate_commission_pct
                        ? `${bien.mandate_commission_pct} %`
                        : '—',
                    },
                    {
                      l: 'Signé le',
                      edit: null,
                      v: bien.mandate_signed_at
                        ? fmtDateShort(bien.mandate_signed_at)
                        : '—',
                    },
                    {
                      l: 'Expire le',
                      edit: editing ? (
                        <BdEditInput
                          type="date"
                          value={draft.mandate_expires_at}
                          onChange={(v) => setField('mandate_expires_at', v)}
                          style={{ fontSize: 13, fontWeight: 600, width: 150 }}
                        />
                      ) : null,
                      v: bien.mandate_expires_at
                        ? `${fmtDateShort(bien.mandate_expires_at)}${
                            daysToExp != null
                              ? ` · ${
                                  daysToExp > 0
                                    ? `dans ${daysToExp}j`
                                    : `${Math.abs(daysToExp)}j de retard`
                                }`
                              : ''
                          }`
                        : '—',
                      warn:
                        daysToExp != null && daysToExp <= 30 && daysToExp >= 0,
                      err: daysToExp != null && daysToExp < 0,
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.l}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: SugarV3.muted,
                        fontWeight: 600,
                      }}
                    >
                      {row.l}
                    </div>
                    {row.edit ?? (
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            'err' in row && row.err
                              ? SugarV3.err
                              : 'warn' in row && row.warn
                                ? SugarV3.warn
                                : SugarV3.ink,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {row.v}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </BdCard>

            {/* Publication */}
            <BdCard padding={24}>
              <BdEyebrow>Publication</BdEyebrow>
              <h3
                style={{
                  margin: '10px 0 16px',
                  fontSize: 18,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.3,
                }}
              >
                {bien.published_at ? 'Diffusé' : 'Non publié'}
              </h3>
              {bien.published_at ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {['Homegate', 'ImmoScout'].map((p) => (
                    <div
                      key={p}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 14,
                        background: SugarV3.cardSubtle,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 13,
                          fontWeight: 600,
                          color: SugarV3.ink,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            background: SugarV3.ok,
                          }}
                        />
                        {p}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: SugarV3.muted,
                          fontWeight: 600,
                        }}
                      >
                        actif
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: SugarV3.cardSubtle,
                    fontSize: 12.5,
                    color: SugarV3.muted,
                    fontWeight: 500,
                  }}
                >
                  Ce bien n'est pas encore publié.
                </div>
              )}
            </BdCard>

            {/* Historique */}
            <BdCard padding={24}>
              <BdEyebrow>Historique</BdEyebrow>
              <h3
                style={{
                  margin: '10px 0 18px',
                  fontSize: 18,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.3,
                }}
              >
                Évènements récents
              </h3>
              <div style={{ position: 'relative', paddingLeft: 18 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 6,
                    top: 6,
                    bottom: 6,
                    width: 2,
                    background: SugarV3.cardSubtle,
                    borderRadius: 999,
                  }}
                />
                {[
                  { at: bien.created_at, text: 'Bien créé dans le CRM' },
                  bien.published_at
                    ? { at: bien.published_at, text: 'Annonce publiée' }
                    : null,
                  bien.updated_at && bien.updated_at !== bien.created_at
                    ? { at: bien.updated_at, text: 'Annonce mise à jour' }
                    : null,
                ]
                  .filter(
                    (e): e is { at: string; text: string } => e !== null,
                  )
                  .map((e, i, arr) => (
                    <div
                      key={i}
                      style={{
                        position: 'relative',
                        marginBottom: i === arr.length - 1 ? 0 : 16,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: -18,
                          top: 4,
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          background: SugarV3.ink,
                          border: `3px solid ${SugarV3.card}`,
                          boxShadow: SugarV3.shadowSm,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 11,
                          color: SugarV3.muted,
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        {fmtDateShort(e.at)}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: SugarV3.inkSoft,
                          lineHeight: 1.5,
                          fontWeight: 500,
                        }}
                      >
                        {e.text}
                      </div>
                    </div>
                  ))}
              </div>
            </BdCard>
          </div>
        </div>
      </main>

      {/* TOAST */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            zIndex: 300,
            width: 380,
            maxWidth: 'calc(100vw - 64px)',
            padding: 22,
            borderRadius: 20,
            background: SugarV3.ink,
            color: '#fff',
            boxShadow:
              '0 24px 60px rgba(11,12,14,0.30), 0 8px 24px rgba(11,12,14,0.20)',
            animation: 'bdToastIn .35s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: SugarV3.ok,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <SgIcon name="check" size={18} stroke="#fff" sw={2.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                {toast.title}
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {toast.actions.map((a, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 12.5,
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.45,
                      fontWeight: 500,
                      display: 'flex',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        color: SugarV3.ok,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setToast(null)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: 0,
                background: 'rgba(255,255,255,0.10)',
                color: '#fff',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              <SgIcon name="close" size={13} stroke="#fff" sw={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
