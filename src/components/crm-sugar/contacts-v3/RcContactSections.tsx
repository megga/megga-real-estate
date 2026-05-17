// MEGGA Contacts V3 — sous-nav interne + sections (Critères, Mandats, Matchs, Activité, KYC, Docs).
// Port 1:1 de `refonte-contacts-detail-audience.jsx` (RcContactSections + RcSec*).

import { useEffect, useState } from 'react'
import RcIcon from './RcIcon'
import { RcInlineEdit, RcPill, RcSubNav, type RcSubNavItem } from './RcPrimitives'
import type { RcPalette } from './palette'
import {
  rcFmtCHF,
  rcRelative,
  type RcContact,
  type RcContactPatch,
} from './helpers'

// ─── RcSecCriteria ─────────────────────────────────────────────────────
function RcSecCriteria({
  contact,
  onUpdate,
  sp,
}: {
  contact: RcContact
  onUpdate?: (
    patch: RcContactPatch,
  ) => void
  sp: RcPalette
}) {
  const c = contact.criteria
  const parseList = (v: string) =>
    String(v || '')
      .split(/\s*,\s*/)
      .filter(Boolean)

  type F = {
    label: string
    k: string
    v: string | number | null | undefined
    prefix?: string
    suffix?: string
    mono?: boolean
    parse: (v: string) => unknown
  }
  const fields: F[] = [
    {
      label: 'Budget min',
      k: 'budgetMin',
      v: c?.budgetMin,
      prefix: 'CHF',
      mono: true,
      parse: v => Number(v) || null,
    },
    {
      label: 'Budget max',
      k: 'budgetMax',
      v: c?.budgetMax,
      prefix: 'CHF',
      mono: true,
      parse: v => Number(v) || null,
    },
    {
      label: 'Surface min',
      k: 'areaMin',
      v: c?.areaMin,
      suffix: 'm²',
      mono: true,
      parse: v => Number(v) || null,
    },
    {
      label: 'Pièces min',
      k: 'roomsMin',
      v: c?.roomsMin,
      mono: true,
      parse: v => Number(v) || null,
    },
    {
      label: 'Types',
      k: 'types',
      v: (c?.types || []).join(', '),
      parse: parseList,
    },
    {
      label: 'Cantons',
      k: 'cantons',
      v: (c?.cantons || []).join(', '),
      parse: parseList,
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
      }}
    >
      {fields.map(f => {
        const displayValue =
          f.v != null && f.v !== ''
            ? f.mono && typeof f.v === 'number'
              ? f.v.toLocaleString('fr-CH').replace(/ |,/g, "'")
              : String(f.v)
            : ''
        return (
          <div
            key={f.label}
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: sp.cardSubtle,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: sp.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {f.label}
            </div>
            <RcInlineEdit
              value={displayValue}
              onChange={v =>
                onUpdate?.({ criteria: { [f.k]: f.parse(String(v)) } })
              }
              placeholder="—"
              prefix={f.prefix}
              suffix={f.suffix}
              mono={f.mono}
              block
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: sp.ink,
                letterSpacing: -0.3,
              }}
              sp={sp}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── RcSecMandates ─────────────────────────────────────────────────────
function RcSecMandates({
  contact,
  sp,
}: {
  contact: RcContact
  sp: RcPalette
}) {
  const list = contact.mandates
  if (list.length === 0)
    return (
      <div
        style={{
          padding: '32px 16px',
          borderRadius: 16,
          background: sp.cardSubtle,
          textAlign: 'center',
          color: sp.muted,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Aucun mandat actif.
      </div>
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map(m => (
        <div
          key={m.ref}
          style={{
            padding: '16px 18px',
            borderRadius: 16,
            background: sp.cardSubtle,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              flexShrink: 0,
              background: sp.card,
              boxShadow: sp.shadowSm,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <RcIcon name="home" size={20} stroke={sp.ink} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: sp.ink,
                letterSpacing: -0.2,
              }}
            >
              {m.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: sp.muted,
                fontWeight: 500,
                marginTop: 3,
              }}
            >
              {m.ref} · {m.type} · {m.commission}% · {rcFmtCHF(m.price)}
            </div>
          </div>
          <RcPill tone={m.signed ? 'ok' : 'warn'}>
            {m.signed ? 'Signé' : 'À signer'}
          </RcPill>
        </div>
      ))}
    </div>
  )
}

// ─── RcSecMatches ──────────────────────────────────────────────────────
function RcSecMatches({ sp }: { contact: RcContact; sp: RcPalette }) {
  // Sample data — port 1:1 de la maquette
  const sample: {
    ref: string
    title: string
    score: number
    price: number
    status: 'Vu' | 'Envoyé' | 'À envoyer'
  }[] = [
    {
      ref: 'b-103',
      title: '5 pièces familial Carouge',
      score: 94,
      price: 1100000,
      status: 'Vu',
    },
    {
      ref: 'b-101',
      title: '4 pièces lumineux Eaux-Vives',
      score: 78,
      price: 850000,
      status: 'Envoyé',
    },
    {
      ref: 'b-118',
      title: 'Loft contemporain Plainpalais',
      score: 71,
      price: 1180000,
      status: 'À envoyer',
    },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sample.map(m => (
        <div
          key={m.ref}
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            background: sp.cardSubtle,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: sp.card,
              color: sp.ink,
              display: 'grid',
              placeItems: 'center',
              fontSize: 16,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              boxShadow: sp.shadowSm,
              flexShrink: 0,
            }}
          >
            {m.score}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: sp.ink,
              }}
            >
              {m.title}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: sp.muted,
                fontWeight: 500,
                marginTop: 3,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {m.ref} · {rcFmtCHF(m.price)}
            </div>
          </div>
          <RcPill
            tone={
              m.status === 'Vu'
                ? 'ok'
                : m.status === 'Envoyé'
                  ? 'info'
                  : 'neutral'
            }
          >
            {m.status}
          </RcPill>
        </div>
      ))}
    </div>
  )
}

// ─── RcSecActivity ─────────────────────────────────────────────────────
function RcSecActivity({ sp }: { contact: RcContact; sp: RcPalette }) {
  type Kind = 'note' | 'visit' | 'call' | 'match'
  const items: { at: string; kind: Kind; text: string }[] = [
    {
      at: '2026-05-16T15:32:00',
      kind: 'note',
      text: "A apprécié l'exposition mais souhaite revoir la cuisine.",
    },
    {
      at: '2026-05-15T11:00:00',
      kind: 'visit',
      text: 'Visite b-103 — Carouge, 60 min.',
    },
    {
      at: '2026-05-12T10:11:00',
      kind: 'call',
      text: 'Appel de qualification — 12 min.',
    },
    {
      at: '2026-05-04T09:00:00',
      kind: 'match',
      text: '3 nouveaux biens envoyés par matching IA.',
    },
  ]
  const iconFor = (k: Kind) =>
    (({ note: 'pencil', visit: 'home', call: 'phone', match: 'sparkle' }) as const)[k]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((a, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              flexShrink: 0,
              background: sp.cardSubtle,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <RcIcon name={iconFor(a.kind)} size={13} stroke={sp.inkSoft} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                color: sp.ink,
                fontWeight: 500,
                lineHeight: 1.45,
              }}
            >
              {a.text}
            </div>
            <div
              style={{
                fontSize: 11,
                color: sp.muted,
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              {rcRelative(a.at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── RcSecKyc ──────────────────────────────────────────────────────────
function RcSecKyc({
  contact,
  sp,
}: {
  contact: RcContact
  sp: RcPalette
}) {
  const STEPS = [
    'Identité',
    'Bénéficiaires',
    'Fonds',
    'Screening',
    'Risque',
    'Validation',
  ]
  const active = (
    { none: 0, pending: 3, stale: 5, verified: 6 } as const
  )[contact.kyc || 'none']
  return (
    <div
      style={{
        padding: '14px 18px',
        borderRadius: 16,
        background: sp.cardSubtle,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {STEPS.map((s, i) => {
          const done = i < active
          const cur = i === active && contact.kyc !== 'verified'
          return (
            <span
              key={s}
              style={{
                display: 'contents',
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: done ? sp.ok : cur ? sp.ink : sp.card,
                    color: done || cur ? sp.inkInverse : sp.muted,
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: cur
                      ? `0 0 0 4px ${sp.cardSubtle}`
                      : sp.shadowSm,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: done || cur ? sp.ink : sp.muted,
                    textAlign: 'center',
                  }}
                >
                  {s}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 0.5,
                    height: 2,
                    marginTop: 10,
                    background: i < active - 1 ? sp.ok : sp.ghost,
                  }}
                />
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── RcSecDocs ─────────────────────────────────────────────────────────
function RcSecDocs({ sp }: { sp: RcPalette }) {
  return (
    <div
      style={{
        padding: '36px 16px',
        borderRadius: 16,
        background: sp.cardSubtle,
        textAlign: 'center',
        color: sp.muted,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      Documents liés au contact — brochures, mandat, KYC, signatures.
    </div>
  )
}

// ─── RcContactSections — sous-nav interne + corps + notes ──────────────
type SectionTab =
  | 'criteria'
  | 'matches'
  | 'mandates'
  | 'activity'
  | 'kyc'
  | 'docs'

interface RcContactSectionsProps {
  contact: RcContact
  onUpdate?: (patch: RcContactPatch) => void
  tab?: SectionTab
  onTab?: (id: SectionTab) => void
  sp: RcPalette
}

export function RcContactSections({
  contact,
  onUpdate,
  tab: tabProp,
  onTab,
  sp,
}: RcContactSectionsProps) {
  const defaultTab: SectionTab =
    contact.type === 'seller'
      ? 'mandates'
      : contact.type === 'tenant'
        ? 'criteria'
        : 'criteria'
  const [tabLocal, setTabLocal] = useState<SectionTab>(defaultTab)
  const tab = tabProp != null ? tabProp : tabLocal
  const setTab = onTab ?? setTabLocal
  const [notes, setNotes] = useState<string>(contact.notes || '')

  useEffect(() => {
    if (tabProp == null) setTabLocal(defaultTab)
    setNotes(contact.notes || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id])

  const commitNotes = (v: string | number) => {
    const next = String(v)
    setNotes(next)
    onUpdate?.({ notes: next })
  }

  const tabs: RcSubNavItem[] =
    contact.type === 'seller'
      ? [
          { id: 'mandates', label: 'Mandats & diffusion' },
          { id: 'activity', label: 'Activité' },
          { id: 'docs', label: 'Documents' },
          { id: 'kyc', label: 'Conformité' },
        ]
      : [
          { id: 'criteria', label: 'Critères' },
          { id: 'matches', label: 'Matchs' },
          { id: 'activity', label: 'Activité' },
          { id: 'kyc', label: 'Conformité' },
        ]

  return (
    <div
      style={{
        background: sp.card,
        borderRadius: 24,
        padding: 24,
        boxShadow: sp.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <RcSubNav
        variant="tabs"
        items={tabs}
        value={tab}
        onChange={id => setTab(id as SectionTab)}
        sp={sp}
      />

      <div style={{ minHeight: 180 }}>
        {tab === 'criteria' && (
          <RcSecCriteria contact={contact} onUpdate={onUpdate} sp={sp} />
        )}
        {tab === 'mandates' && <RcSecMandates contact={contact} sp={sp} />}
        {tab === 'matches' && <RcSecMatches contact={contact} sp={sp} />}
        {tab === 'activity' && <RcSecActivity contact={contact} sp={sp} />}
        {tab === 'kyc' && <RcSecKyc contact={contact} sp={sp} />}
        {tab === 'docs' && <RcSecDocs sp={sp} />}
      </div>

      <div
        style={{
          padding: '16px 18px',
          borderRadius: 16,
          background: sp.cardSubtle,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: sp.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Notes internes
        </div>
        <RcInlineEdit
          value={notes}
          onChange={commitNotes}
          placeholder="Ajouter une note…"
          block
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: sp.inkSoft,
            lineHeight: 1.55,
          }}
          sp={sp}
        />
      </div>
    </div>
  )
}

export type { SectionTab }
