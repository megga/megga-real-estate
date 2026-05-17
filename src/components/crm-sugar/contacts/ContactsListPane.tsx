// MEGGA CRM Sugar v2 — Contacts list pane (segments + search + sort + rows)
// 1:1 port from `crm-screen-contacts-sugar.jsx` (CtSegment, CtRow, CtListPane).

import { useMemo, useState, type CSSProperties } from 'react'
import CRMIcon from '../CRMIcon'
import { type CrmContact, type CrmDeal } from '../mockData'
import { CRM_STAGES } from '../tokens'
import { crmInitials } from '../tokens'
import type { SugarPalette } from '../tokens'
import {
  CT_SEGMENTS,
  ctRelativeTime,
  ctScoreColor,
  ctTypeLabel,
  type SegmentId,
  type SortMode,
} from './helpers'

// ─── Segment chip ─────────────────────────────────────────────────────
interface CtSegmentProps {
  label: string
  count: number
  active: boolean
  onClick: () => void
  sp: SugarPalette
}

function CtSegment({ label, count, active, onClick, sp }: CtSegmentProps) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 30,
        padding: '0 12px',
        borderRadius: 999,
        border: `1px solid ${active ? sp.ink : sp.cardBorder}`,
        background: active ? sp.ink : sp.cardBg,
        color: active ? sp.pageBg : sp.ink,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          background: active ? 'rgba(255,255,255,.2)' : sp.cardSubBg,
          color: active ? sp.pageBg : sp.sub,
          padding: '1px 6px',
          borderRadius: 999,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
    </button>
  )
}

// ─── Contact row ───────────────────────────────────────────────────────
interface CtRowProps {
  contact: CrmContact
  deal?: CrmDeal
  selected: boolean
  onSelect: () => void
  sp: SugarPalette
  dark: boolean
}

function CtRow({ contact, deal, selected, onSelect, sp, dark }: CtRowProps) {
  const [hov, setHov] = useState(false)
  const score = contact.score || 0
  const scoreColor = ctScoreColor(score)
  const kycMap = {
    none: { color: '#F59E0B' },
    pending: { color: '#F59E0B' },
    verified: { color: '#0E9F6E' },
    stale: { color: '#F59E0B' },
  } as const
  const kyc = kycMap[contact.kyc?.status || 'none']
  const stage = deal ? CRM_STAGES[deal.stage] : null

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        background: selected
          ? dark
            ? 'rgba(255,255,255,.06)'
            : 'rgba(0,65,217,.06)'
          : hov
            ? sp.cardSubBg
            : 'transparent',
        border: 0,
        borderLeft: `3px solid ${selected ? '#0041D9' : 'transparent'}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background .12s, border-color .12s',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: contact.avatarBg || '#0041D9',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
          border: `2px solid ${sp.avatarBorder}`,
          flexShrink: 0,
        }}
      >
        {crmInitials(contact.firstName + ' ' + contact.lastName)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: sp.ink,
              letterSpacing: -0.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
          >
            {contact.firstName} {contact.lastName}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: scoreColor,
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            {score}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: sp.sub,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              color:
                contact.type === 'buyer'
                  ? '#0041D9'
                  : contact.type === 'seller'
                    ? '#B45309'
                    : sp.soft,
              fontWeight: 600,
            }}
          >
            {ctTypeLabel(contact.type)}
          </span>
          <span style={{ color: sp.sub }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: kyc.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: sp.sub }}>{ctRelativeTime(contact.lastActivityAt)}</span>
          </span>
        </div>
        {stage && (
          <div
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10.5,
              color: sp.soft,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: stage.color,
              }}
            />
            {stage.label}
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Liste pane ────────────────────────────────────────────────────────
interface ContactsListPaneProps {
  contacts: CrmContact[]
  /** Total des contacts AVANT filtrage (pour les compteurs de segments). */
  allContacts?: CrmContact[]
  /** True pendant le premier fetch Supabase — affiche un état "Chargement…". */
  isLoading?: boolean
  /** Mapping contactId → premier deal (pour le badge sur chaque ligne). */
  dealsByContactId?: Record<string, CrmDeal | undefined>
  selectedId: string | null
  onSelect: (id: string) => void
  segment: SegmentId
  setSegment: (s: SegmentId) => void
  search: string
  setSearch: (s: string) => void
  sort: SortMode
  setSort: (s: SortMode) => void
  sp: SugarPalette
  dark: boolean
  onNewContact: () => void
  /** Sprint 3 — ouvre Import Lead IA pré-rempli avec returnTo /dashboard/contacts. */
  onImportLead?: () => void
  style?: CSSProperties
}

export function ContactsListPane({
  contacts,
  allContacts,
  isLoading,
  dealsByContactId,
  selectedId,
  onSelect,
  segment,
  setSegment,
  search,
  setSearch,
  sort,
  setSort,
  sp,
  dark,
  onNewContact,
  onImportLead,
  style,
}: ContactsListPaneProps) {
  // Source pour les compteurs : `allContacts` (avant filtrage) si fournie,
  // sinon fallback sur `contacts` (suffit quand le composant n'a pas de filtres
  // externes au-dessus, ex: cas isolé en démo).
  const countsSource = allContacts ?? contacts
  const segmentCounts = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    return {
      all: countsSource.length,
      buyer: countsSource.filter(c => c.type === 'buyer').length,
      seller: countsSource.filter(c => c.type === 'seller').length,
      tenant: countsSource.filter(
        c => c.type === 'tenant' || c.criteria?.transaction === 'location',
      ).length,
      hot: countsSource.filter(c => (c.score || 0) >= 75).length,
      kyc: countsSource.filter(
        c => !c.kyc || c.kyc.status === 'none' || c.kyc.status === 'stale',
      ).length,
      stale: countsSource.filter(
        c => c.lastActivityAt && new Date(c.lastActivityAt) < cutoff,
      ).length,
    } as const
  }, [countsSource])

  const nextSort = (current: SortMode): SortMode =>
    current === 'activity' ? 'score' : current === 'score' ? 'name' : 'activity'

  return (
    <aside
      style={{
        width: 360,
        flexShrink: 0,
        position: 'sticky',
        top: 32,
        maxHeight: 'calc(100vh - 64px - 56px)',
        display: 'flex',
        flexDirection: 'column',
        background: sp.cardBg,
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 20,
        boxShadow: sp.shadowSm,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ padding: '20px 20px 14px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: sp.ink,
              letterSpacing: -0.6,
              lineHeight: 1,
            }}
          >
            Contacts
          </h2>
          <span
            style={{
              fontSize: 12,
              color: sp.sub,
              fontWeight: 600,
              marginBottom: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {contacts.length}
          </span>
          <div style={{ flex: 1 }} />
          {/* Sprint 3 — Bouton rond ✨ Importer un lead (ghost, à gauche du +) */}
          {onImportLead && (
            <button
              onClick={onImportLead}
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                border: `1px solid ${sp.cardBorder}`,
                background: sp.cardBg,
                color: sp.ink,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'inherit',
                marginRight: 6,
              }}
              title="Importer un lead via MEGGA AI"
            >
              <CRMIcon name="spark" size={13} stroke={sp.ink} />
            </button>
          )}
          <button
            onClick={onNewContact}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: 0,
              background: sp.ink,
              color: sp.pageBg,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'inherit',
              boxShadow: sp.focusShadow,
            }}
            title="Nouveau contact"
          >
            <CRMIcon name="plus" size={13} stroke={sp.pageBg} />
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            height: 38,
            padding: '0 12px',
            background: dark ? 'rgba(255,255,255,0.04)' : sp.pageBg,
            border: `1px solid ${sp.cardBorder}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <CRMIcon name="search" size={13} stroke={sp.sub} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, email, tag…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: sp.ink,
              fontSize: 12.5,
              fontFamily: 'inherit',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none',
                border: 0,
                cursor: 'pointer',
                color: sp.sub,
                fontFamily: 'inherit',
                fontSize: 14,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Segments scrollable */}
        <div
          className="ct-seg-row"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`.ct-seg-row::-webkit-scrollbar { display: none; }`}</style>
          {CT_SEGMENTS.map(s => (
            <CtSegment
              key={s.id}
              label={s.label}
              count={segmentCounts[s.id]}
              active={segment === s.id}
              onClick={() => setSegment(s.id)}
              sp={sp}
            />
          ))}
        </div>

        {/* Sort + count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            fontSize: 11,
            color: sp.sub,
            fontWeight: 600,
          }}
        >
          <span>
            {contacts.length} résultat{contacts.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSort(nextSort(sort))}
            style={{
              background: 'transparent',
              border: 0,
              color: sp.soft,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Tri : {sort === 'activity' ? 'Activité' : sort === 'score' ? 'Score' : 'Nom'}
            <CRMIcon name="chevronUD" size={10} stroke={sp.soft} />
          </button>
        </div>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 8px 12px',
          borderTop: `1px solid ${sp.cardBorder}`,
        }}
      >
        {contacts.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: sp.sub,
              fontSize: 12.5,
            }}
          >
            {isLoading
              ? 'Chargement des contacts…'
              : 'Aucun contact ne correspond aux filtres.'}
          </div>
        ) : (
          contacts.map(c => {
            const deal = dealsByContactId?.[c.id]
            return (
              <CtRow
                key={c.id}
                contact={c}
                deal={deal}
                selected={selectedId === c.id}
                onSelect={() => onSelect(c.id)}
                sp={sp}
                dark={dark}
              />
            )
          })
        )}
      </div>
    </aside>
  )
}
