// MEGGA Contacts V3 — fiche détail, heros adaptés par audience.
// Port 1:1 de `refonte-contacts-detail-audience.jsx`.
// Le hero remonte ce qui compte vraiment pour ce type de contact.

import type { ReactNode } from 'react'
import RcIcon, { type RcIconName } from './RcIcon'
import {
  RcAvatar,
  RcKycPill,
  RcInlineEdit,
  RcKpi,
} from './RcPrimitives'
import type { RcPalette } from './palette'
import {
  rcRelative,
  rcFmtCHF,
  type RcContact,
  type RcContactPatch,
  RC_NOW,
} from './helpers'
import { CRM_DEALS } from '../mockData'

// ─── Helpers de navigation (deep-link via window globals) ─────────────
// En prod : à remplacer par un store de routing (route params, etc.).
// Le pattern reste : set context globaux → navigate.
declare global {
  interface Window {
    __bdBienId?: string
    __bdFocus?: 'mandat' | 'diffusion'
    __ddDealId?: string
    __matchingContactId?: string
    __calFocusDate?: string
    __kycContactId?: string
  }
}

const rcGoBien = (
  onNavigate: ((id: string) => void) | undefined,
  bienId?: string,
  focus?: 'mandat' | 'diffusion',
) => {
  if (bienId) window.__bdBienId = bienId
  if (focus) window.__bdFocus = focus
  onNavigate?.('bien-detail')
}
const rcGoDeal = (
  onNavigate: ((id: string) => void) | undefined,
  dealId?: string,
) => {
  if (dealId) window.__ddDealId = dealId
  onNavigate?.('deal-detail')
}
const rcGoMatching = (
  onNavigate: ((id: string) => void) | undefined,
  contactId?: string,
) => {
  if (contactId) window.__matchingContactId = contactId
  onNavigate?.('matching')
}
const rcGoCalendar = (
  onNavigate: ((id: string) => void) | undefined,
  iso?: string | null,
) => {
  if (iso) window.__calFocusDate = iso
  onNavigate?.('calendar')
}
const rcGoKyc = (
  onNavigate: ((id: string) => void) | undefined,
  contactId?: string,
) => {
  if (contactId) window.__kycContactId = contactId
  onNavigate?.('kyc')
}
const rcOpenWizardMandat = (onNavigate: ((id: string) => void) | undefined) => {
  // "biens-new" est intercepté par le host → ouvre le wizard mandat.
  onNavigate?.('biens-new')
}

// ─── Types CTA ─────────────────────────────────────────────────────────
export interface RcHeroAction {
  label: string
  icon: RcIconName
  onAction: () => void
}

// ─── Hero shell commun (identité + KPIs + CTA) ─────────────────────────
interface RcHeroShellProps {
  contact: RcContact
  action: RcHeroAction
  onUpdate?: (patch: RcContactPatch) => void
  onOpenRdv?: () => void
  children: ReactNode
  sp: RcPalette
}
function RcHeroShell({
  contact,
  action,
  onUpdate,
  onOpenRdv,
  children,
  sp,
}: RcHeroShellProps) {
  return (
    <div
      style={{
        background: sp.card,
        borderRadius: 24,
        padding: 24,
        boxShadow: sp.shadow,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Identité */}
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <RcAvatar contact={contact} size={64} sp={sp} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                color: sp.ink,
                letterSpacing: -0.5,
                lineHeight: 1.1,
              }}
            >
              {contact.firstName} {contact.lastName}
            </h2>
            <RcKycPill status={contact.kyc} />
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 14px',
              fontSize: 13.5,
              color: sp.inkSoft,
              fontWeight: 500,
            }}
          >
            <RcInlineEdit
              value={contact.email}
              onChange={v => onUpdate?.({ email: String(v) })}
              prefix={
                <RcIcon
                  name="mail"
                  size={13}
                  stroke={sp.muted}
                  sw={1.7}
                />
              }
              style={{ fontSize: 13.5, fontWeight: 500 }}
              sp={sp}
            />
            <RcInlineEdit
              value={contact.phone}
              onChange={v => onUpdate?.({ phone: String(v) })}
              mono
              prefix={
                <RcIcon
                  name="phone"
                  size={13}
                  stroke={sp.muted}
                  sw={1.7}
                />
              }
              style={{ fontSize: 13.5, fontWeight: 500 }}
              sp={sp}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              color: sp.muted,
              marginTop: 8,
              fontWeight: 500,
            }}
          >
            {contact.sourceLabel} · {contact.assignedToLabel} ·{' '}
            {rcRelative(contact.lastActivityAt)}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexShrink: 0,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: 0,
              background: sp.cardSubtle,
              color: sp.inkSoft,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              boxShadow: sp.shadowSm,
            }}
          >
            <RcIcon name="phone" size={15} stroke={sp.inkSoft} />
          </button>
          <button
            type="button"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: 0,
              background: sp.cardSubtle,
              color: sp.inkSoft,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              boxShadow: sp.shadowSm,
            }}
          >
            <RcIcon name="mail" size={15} stroke={sp.inkSoft} />
          </button>
          {onOpenRdv && (
            <button
              type="button"
              onClick={onOpenRdv}
              style={{
                height: 40,
                padding: '0 16px',
                borderRadius: 999,
                border: 0,
                background: sp.cardSubtle,
                color: sp.inkSoft,
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: sp.shadowSm,
              }}
            >
              <RcIcon name="cal" size={13} stroke={sp.inkSoft} sw={1.8} />
              Planifier RDV
            </button>
          )}
          <button
            type="button"
            onClick={action.onAction}
            style={{
              height: 40,
              padding: '0 18px',
              borderRadius: 999,
              border: 0,
              background: sp.black,
              color: sp.inkInverse,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
            }}
          >
            <RcIcon name={action.icon} size={13} stroke={sp.inkInverse} />
            {action.label}
          </button>
        </div>
      </header>

      {/* KPIs personnalisés */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

// ─── RcHeroBuyer ───────────────────────────────────────────────────────
interface HeroProps {
  contact: RcContact
  sp: RcPalette
  onUpdate?: (patch: RcContactPatch) => void
  onNavigate?: (id: string) => void
  onOpenRdv?: () => void
  setTab?: (id: string) => void
}

const fmtK = (n: number): string =>
  n >= 1e6
    ? (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace('.', ',') + 'M'
    : Math.round(n / 1e3) + 'k'

export function RcHeroBuyer({
  contact,
  sp,
  onUpdate,
  onNavigate,
  onOpenRdv,
}: HeroProps) {
  const c = contact.criteria
  const budget =
    c?.budgetMin && c?.budgetMax
      ? `${fmtK(c.budgetMin)}–${fmtK(c.budgetMax)}`
      : c?.budgetMax
        ? `≤ ${fmtK(c.budgetMax)}`
        : '—'
  const nextVisit = contact.visitNext
    ? new Date(contact.visitNext).toLocaleDateString('fr-CH', {
        day: 'numeric',
        month: 'short',
      })
    : null

  let action: RcHeroAction
  if (contact.stage === 'offer') {
    const deals = CRM_DEALS.filter(d => d.contactId === contact.id)
    const offer = deals.find(d => d.stage === 'offer') || deals[0]
    action = {
      label: "Suivre l'offre",
      icon: 'flame',
      onAction: () => rcGoDeal(onNavigate, offer?.id),
    }
  } else if (nextVisit) {
    action = {
      label: 'Préparer la visite',
      icon: 'cal',
      onAction: () => rcGoCalendar(onNavigate, contact.visitNext),
    }
  } else if ((contact.matchesSent || 0) === 0) {
    action = {
      label: 'Envoyer 3 matchs',
      icon: 'sparkle',
      onAction: () => rcGoMatching(onNavigate, contact.id),
    }
  } else {
    action = {
      label: 'Relancer',
      icon: 'sparkle',
      onAction: () => onOpenRdv?.(),
    }
  }

  const scoreAccent =
    (contact.score ?? 0) >= 80
      ? sp.ok
      : (contact.score ?? 0) >= 60
        ? sp.ink
        : sp.warn

  return (
    <RcHeroShell
      contact={contact}
      onUpdate={onUpdate}
      action={action}
      onOpenRdv={onOpenRdv}
      sp={sp}
    >
      <RcKpi value={budget} label="Budget CHF" sp={sp} />
      <RcKpi value={contact.matchesSent ?? 0} label="Matchs envoyés" sp={sp} />
      <RcKpi value={contact.score ?? 0} label="Score IA" accent={scoreAccent} sp={sp} />
      {nextVisit && (
        <RcKpi
          value={nextVisit}
          label="Prochaine visite"
          mono={false}
          accent={sp.ink}
          sp={sp}
        />
      )}
    </RcHeroShell>
  )
}

// ─── RcHeroSeller ──────────────────────────────────────────────────────
export function RcHeroSeller({
  contact,
  sp,
  onUpdate,
  onNavigate,
  onOpenRdv,
}: HeroProps) {
  const m = contact.mandates[0]
  if (!m) {
    const action: RcHeroAction = {
      label: 'Créer un mandat',
      icon: 'plus',
      onAction: () => rcOpenWizardMandat(onNavigate),
    }
    return (
      <RcHeroShell
        contact={contact}
        onUpdate={onUpdate}
        action={action}
        onOpenRdv={onOpenRdv}
        sp={sp}
      >
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            background: sp.cardSubtle,
            fontSize: 13,
            color: sp.muted,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          Aucun mandat actif. Démarrez la prise de mandat pour publier un bien.
        </div>
      </RcHeroShell>
    )
  }
  const action: RcHeroAction = !m.signed
    ? {
        label: 'Signer le mandat',
        icon: 'pencil',
        onAction: () => rcGoBien(onNavigate, m.ref, 'mandat'),
      }
    : {
        label: 'Voir la diffusion',
        icon: 'eye',
        onAction: () => rcGoBien(onNavigate, m.ref, 'diffusion'),
      }
  return (
    <RcHeroShell
      contact={contact}
      onUpdate={onUpdate}
      action={action}
      onOpenRdv={onOpenRdv}
      sp={sp}
    >
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 14,
          background: sp.cardSubtle,
          flex: '1 1 240px',
          minWidth: 200,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: sp.muted,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Mandat {m.type}
        </div>
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {m.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: sp.inkSoft,
            fontWeight: 500,
            marginTop: 4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rcFmtCHF(m.price)} · commission {m.commission}%
        </div>
      </div>
      <RcKpi value={m.viewsThisWeek} label="Vues 7j" sp={sp} />
      <RcKpi value={m.visitRequests} label="Demandes visite" sp={sp} />
      {m.expiresInDays != null && (
        <RcKpi
          value={`${m.expiresInDays} j`}
          label="Avant échéance"
          accent={m.expiresInDays < 30 ? sp.warn : sp.ink}
          mono={false}
          sp={sp}
        />
      )}
    </RcHeroShell>
  )
}

// ─── RcHeroTenant ──────────────────────────────────────────────────────
export function RcHeroTenant({
  contact,
  sp,
  onUpdate,
  onNavigate,
  onOpenRdv,
}: HeroProps) {
  const c = contact.criteria
  const noMatch = (contact.matchesSent || 0) === 0
  const action: RcHeroAction = noMatch
    ? {
        label: 'Envoyer 3 matchs',
        icon: 'sparkle',
        onAction: () => rcGoMatching(onNavigate, contact.id),
      }
    : {
        label: 'Planifier visite',
        icon: 'cal',
        onAction: () => onOpenRdv?.(),
      }
  return (
    <RcHeroShell
      contact={contact}
      onUpdate={onUpdate}
      action={action}
      onOpenRdv={onOpenRdv}
      sp={sp}
    >
      <RcKpi
        value={c?.budgetMax ? `${c.budgetMax}.-` : '—'}
        label="Loyer max"
        sp={sp}
      />
      <RcKpi value={c?.roomsMin ?? '—'} label="Pièces min" sp={sp} />
      <RcKpi value={contact.matchesSent ?? 0} label="Matchs envoyés" sp={sp} />
      <RcKpi
        value={(c?.cantons || []).join('/') || '—'}
        label="Cantons"
        mono={false}
        sp={sp}
      />
    </RcHeroShell>
  )
}

// ─── RcHeroWatch ───────────────────────────────────────────────────────
export function RcHeroWatch({
  contact,
  sp,
  onUpdate,
  onNavigate,
  onOpenRdv,
  setTab,
}: HeroProps) {
  // Raison du flag — la plus prioritaire d'abord
  let reason = {
    l: 'À surveiller',
    cta: 'Choisir une action',
    icon: 'flame' as RcIconName,
    tone: sp.warn,
    onAction: () => onOpenRdv?.(),
  }
  if (contact.stage === ('dormant' as never)) {
    reason = {
      l: 'Aucune interaction depuis 30j+',
      cta: 'Tenter une relance',
      icon: 'moon',
      tone: sp.muted,
      onAction: () => onOpenRdv?.(),
    }
  } else if (contact.stage === ('nouveau' as never)) {
    reason = {
      l: 'Nouveau contact — à qualifier sous 24h',
      cta: 'Qualifier maintenant',
      icon: 'sparkle',
      tone: sp.ink,
      onAction: () => onOpenRdv?.(),
    }
  } else if (contact.kyc === 'none' || contact.kyc === 'stale') {
    reason = {
      l:
        contact.kyc === 'stale'
          ? 'KYC à rafraîchir'
          : 'KYC bloquant pour avancer',
      cta: 'Lancer le KYC',
      icon: 'shield',
      tone: sp.warn,
      onAction: () => rcGoKyc(onNavigate, contact.id),
    }
  } else if ((contact.score || 100) < 50) {
    reason = {
      l: 'Score MEGGA AI bas — engagement faible',
      cta: 'Revoir les critères',
      icon: 'flame',
      tone: sp.warn,
      onAction: () => setTab?.('criteria'),
    }
  }
  const action: RcHeroAction = {
    label: reason.cta,
    icon: reason.icon,
    onAction: reason.onAction,
  }
  const lastDays = Math.round(
    (RC_NOW.getTime() - new Date(contact.lastActivityAt).getTime()) /
      86400000,
  )
  const scoreAccent =
    (contact.score || 0) < 50 ? sp.warn : sp.ink
  return (
    <RcHeroShell
      contact={contact}
      onUpdate={onUpdate}
      action={action}
      onOpenRdv={onOpenRdv}
      sp={sp}
    >
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 14,
          background: sp.cardSubtle,
          flex: '1 1 280px',
          minWidth: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: sp.card,
            boxShadow: sp.shadowSm,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <RcIcon name={reason.icon} size={16} stroke={reason.tone} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: sp.muted,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Raison du flag
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: sp.ink,
              letterSpacing: -0.2,
              marginTop: 2,
            }}
          >
            {reason.l}
          </div>
        </div>
      </div>
      <RcKpi
        value={`${lastDays} j`}
        label="Sans contact"
        mono={false}
        accent={lastDays > 30 ? sp.warn : sp.ink}
        sp={sp}
      />
      <RcKpi
        value={contact.score ?? 0}
        label="Score IA"
        accent={scoreAccent}
        sp={sp}
      />
    </RcHeroShell>
  )
}
