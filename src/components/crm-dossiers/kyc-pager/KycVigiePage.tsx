// MEGGA CRM — KYC Pager · Page 1 « Vigie »
// Port fidèle de `KypVigiePage` (kyc-pager-proto.jsx), branché sur la
// dérivation LIVE `useKycVigie()`. Deux colonnes volume-adaptatives :
//   • Côté client       (pièces à collecter)
//   • Côté conformité   (contrôles & échéances)
// Charge « forte » (list.length > 5) → urgences en cartes + file dense.

import type { CrmPalette } from '@/components/crm/tokens'
import { useKycVigie, type KycVigieItem } from '@/hooks/useKycVigie'
import { KYP_FONT, type KypSurf } from './kypTokens'
import { KypAvatar, KypCta, KypIcon } from './kypAtoms'
import EtatVide from '@/components/crm/EtatVide'

function KypLatePill({ surf }: { surf: KypSurf }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        padding: '0 var(--crm-space-md)',
        borderRadius: 'var(--crm-radius-pill)',
        background: surf.late,
        color: '#fff',
        fontSize: 'var(--crm-text-sm)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      En retard
    </span>
  )
}

// Sous-carte : fait saillant d'abord, la personne en support
function KypVigieCard({
  it,
  sp,
  surf,
  onOpen,
}: {
  it: KycVigieItem
  sp: CrmPalette
  surf: KypSurf
  onOpen: (dossierId: string) => void
}) {
  return (
    <div style={{ background: surf.cardSub, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-xl) var(--crm-space-3xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
        <span
          style={{
            fontSize: 'var(--crm-text-xl)',
            fontWeight: 600,
            color: sp.ink,
            letterSpacing: -0.2,
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {it.title}
        </span>
        {it.late ? (
          <KypLatePill surf={surf} />
        ) : (
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {it.whenLabel}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 8, minWidth: 0 }}>
        <KypAvatar firstName={it.firstName} lastName={it.lastName} size={22} avatarBg={surf.avatar} ring={surf.cardSub} />
        <span
          style={{
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
            color: sp.soft,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {it.firstName} {it.lastName}
          </span>{' '}
          — {it.meta}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)', marginTop: 11 }}>
        <KypCta sp={sp} h={28} onClick={() => onOpen(it.dossierId)}>
          {it.cta}
        </KypCta>
      </div>
    </div>
  )
}

// Ligne dense — file au-delà des urgences (charge forte)
function KypDenseRow({
  it,
  last,
  sp,
  surf,
  onOpen,
}: {
  it: KycVigieItem
  last: boolean
  sp: CrmPalette
  surf: KypSurf
  onOpen: (dossierId: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--crm-space-lg)',
        padding: 'var(--crm-space-md) var(--crm-space-xl)',
        borderBottom: last ? '0' : `1px solid ${surf.hairline}`,
      }}
    >
      <KypAvatar firstName={it.firstName} lastName={it.lastName} size={26} avatarBg={surf.avatar} ring={surf.card} />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)' }}>
        <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap' }}>{it.title}</span>
        <span
          style={{
            fontSize: 'var(--crm-text-md)',
            color: sp.sub,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {it.firstName} {it.lastName}
        </span>
      </div>
      <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {it.whenLabel}
      </span>
      <span
        onClick={() => onOpen(it.dossierId)}
        style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 }}
      >
        {it.cta} ›
      </span>
    </div>
  )
}

function KypVigieCol({
  title,
  sub,
  list,
  sp,
  surf,
  onOpen,
}: {
  title: string
  sub: string
  list: KycVigieItem[]
  sp: CrmPalette
  surf: KypSurf
  onOpen: (dossierId: string) => void
}) {
  const heavy = list.length > 5
  const urgent = heavy ? list.filter((i) => i.late).slice(0, 2) : list
  const rest = heavy ? list.filter((i) => !urgent.includes(i)) : []
  const shown = rest.slice(0, 6)
  const hidden = rest.length - shown.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <div style={{ margin: '0 4px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
          <span style={{ fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: -0.5, color: sp.ink }}>{title}</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 26,
              height: 26,
              padding: '0 var(--crm-space-md)',
              borderRadius: 'var(--crm-radius-pill)',
              background: sp.focusBg,
              color: sp.focusInk,
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {list.length}
          </span>
        </div>
        <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 500 }}>
          {sub}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: surf.card,
          borderRadius: 'var(--crm-radius-4xl)',
          boxShadow: sp.shadow,
          padding: 'var(--crm-space-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--crm-space-lg)',
          overflow: 'hidden',
        }}
      >
        {/* ⚠ REGISTRE NEUTRE, pas « à jour ». La colonne ne reçoit qu'une liste :
            elle ne peut pas distinguer « tout a été traité » — une bonne
            nouvelle — de « il n'y a jamais rien eu à traiter ». Peindre en vert
            un écran qui n'a jamais rien porté inventerait une information que la
            donnée ne contient pas. Le libellé, lui, ne bouge pas. */}
        {list.length === 0 && (
          <EtatVide
            dark={surf.dark}
            registre="neutre"
            glyphe={<KypIcon name="checkAll" size={24} />}
            titre="Rien en attente ici."
          />
        )}
        {urgent.map((it) => (
          <KypVigieCard key={it.key} it={it} sp={sp} surf={surf} onOpen={onOpen} />
        ))}
        {heavy && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {shown.map((it, i) => (
              <KypDenseRow key={it.key} it={it} last={i === shown.length - 1 && hidden <= 0} sp={sp} surf={surf} onOpen={onOpen} />
            ))}
            {hidden > 0 && (
              <div style={{ marginTop: 'auto', paddingTop: 'var(--crm-space-md)' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 32,
                    padding: '0 var(--crm-space-2xl)',
                    borderRadius: 'var(--crm-radius-pill)',
                    background: surf.cardSub,
                    color: sp.soft,
                    fontSize: 'var(--crm-text-md)',
                    fontWeight: 600,
                  }}
                >
                  Voir les {hidden} autres ›
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  sp: CrmPalette
  surf: KypSurf
  onOpen: (dossierId: string) => void
}

export function KycVigiePage({ sp, surf, onOpen }: Props) {
  const { data, isLoading } = useKycVigie()
  const client = data?.client ?? []
  const agent = data?.agent ?? []
  const nLate = data?.nLate ?? 0
  const heavy = client.length > 5 || agent.length > 5

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '28px 56px 26px 36px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--crm-space-2xl)',
        overflow: 'hidden',
        background: sp.pageBg,
        fontFamily: KYP_FONT,
      }}
    >
      {heavy && nLate > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 'var(--crm-text-7xl)',
                fontWeight: 600,
                color: surf.late,
                letterSpacing: -1,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {nLate}
            </div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, marginTop: 6 }}>
              en retard
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--crm-space-4xl)',
          paddingTop: heavy ? 0 : 8,
        }}
      >
        <KypVigieCol title="Côté client" sub={isLoading ? 'chargement…' : 'pièces à collecter'} list={client} sp={sp} surf={surf} onOpen={onOpen} />
        <KypVigieCol title="Côté conformité" sub={isLoading ? 'chargement…' : 'contrôles et échéances'} list={agent} sp={sp} surf={surf} onOpen={onOpen} />
      </div>
    </div>
  )
}
