// MEGGA CRM — Modale Offre / Contre-offre « Sugar » — PAGE UNIQUE
// ─────────────────────────────────────────────────────────────────────
// Port fidèle du handoff Claude Design (crm-offer-modal-sugar.jsx) :
//   - Plus de wizard 3 étapes → une seule page scrollable (3 sections + récap).
//   - Thème bento clair/sombre (OM_LIGHT / OM_DARK, fond sombre unifié #0A0B0D).
//   - `contained` = épouse le bento parent (position absolue) ; sinon plein écran.
//   - Submit BRANCHÉ : useCreateOffer → insert crm_offers (statut 'pending'),
//     trigger DB AuditEvent, puis onSubmit(newOffer) + onClose().
//
// Contrat de props (identique au handoff) :
//   dealId, kind='offer'|'counter', parentOffer, dark, contained, onSubmit, onClose
//
// Réutilisé par :
//   - OfferModalSugarV3Page (route /dashboard/transactions/:id/offre/:kind, plein écran)
//   - DealDetailSugarV4Page (embarquée `contained` dans le bento de la fiche)

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SgIcon, type SgIconName } from '@/components/crm-sugar-v3/icons'
import { useTransaction } from '@/hooks/useTransactions'
import { useProperty } from '@/hooks/useProperties'
import { useContact } from '@/hooks/useContacts'
import { useCreateOffer, suggestedOfferAmount } from '@/hooks/useOffers'
import { useAuth } from '@/hooks/useAuth'
import { EMPTY_OFFER_CONDITIONS, countActiveConditions } from '@/types/offer'
import type { Offer, OfferConditions, OfferKind } from '@/types/offer'
import type { Contact } from '@/types/contact'
import type { Property } from '@/types/listing'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

// ─── Palettes (bento immersif) ──────────────────────────────────────────
export interface OmPalette {
  bg: string
  card: string
  cardSubtle: string
  cardBorder: string | null
  black: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  onAccent: string
  shadowSm: string
  shadow: string
  shadowLg: string
  ok: string
  warn: string
  err: string
  /** couleurs du récap inversé (texte sur fond = ink) */
  recapMut: string
  recapMut2: string
  recapLine: string
  swapBg: string
}

const OM_LIGHT: OmPalette = {
  bg: '#EDEFF3',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  cardBorder: null,
  black: '#0B0C0E',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  onAccent: '#FFFFFF',
  shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
  shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
  shadowLg: '0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  recapMut: 'rgba(255,255,255,0.60)',
  recapMut2: 'rgba(255,255,255,0.70)',
  recapLine: 'rgba(255,255,255,0.10)',
  swapBg: '#FFFFFF',
}

// Aligné sur le cockpit Today (fond unifié #0A0B0D, cards ton « frame »).
// Surfaces en GETTERS : la palette est montée une fois, les getters la gardent
// vivante quand la teinte sombre change.
const OM_DARK: OmPalette = {
  bg: MXC_COLOR.n100,
  card: MXC_COLOR.n300,
  cardSubtle: MXC_COLOR.n200,
  cardBorder: 'rgba(255,255,255,0.07)',
  black: '#ECEDF3',
  ink: '#ECEDF3',
  inkSoft: '#B5B7C4',
  muted: '#797D90',
  ghost: '#363646',
  onAccent: MXC_COLOR.n1000,
  shadowSm: '0 1px 2px rgba(0,0,0,.40), 0 6px 18px -10px rgba(0,0,0,.60)',
  shadow: '0 1px 2px rgba(0,0,0,.45), 0 10px 28px -12px rgba(0,0,0,.65)',
  shadowLg: '0 24px 60px rgba(0,0,0,.60), 0 4px 16px rgba(0,0,0,.45)',
  ok: '#34C796',
  warn: '#F2B855',
  err: '#F26B65',
  recapMut: 'rgba(10,11,13,0.60)',
  recapMut2: 'rgba(10,11,13,0.72)',
  recapLine: 'rgba(10,11,13,0.14)',
  swapBg: '#373B49',
}

function omFmt(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—'
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return `CHF ${num.toLocaleString('fr-CH').replace(/[\u00A0\u202F,]/g, "'")}`
}

const omInputStyle = (pal: OmPalette): CSSProperties => ({
  width: '100%',
  height: 54,
  padding: '0 var(--crm-space-4xl)',
  background: pal.cardSubtle,
  border: pal.cardBorder ? `1px solid ${pal.cardBorder}` : 0,
  borderRadius: 'var(--crm-radius-xl)',
  fontFamily: 'inherit',
  fontSize: 'var(--crm-text-3xl)',
  fontWeight: 600,
  color: pal.ink,
  outline: 'none',
  boxSizing: 'border-box',
  fontVariantNumeric: 'tabular-nums',
})

// ─── Primitives (module-level — jamais définies dans le composant, sinon les
//     inputs perdent le focus à chaque frappe via un remount) ───────────────

function OmField({
  label,
  hint,
  pal,
  children,
}: {
  label: string
  hint?: string | null
  pal: OmPalette
  children: ReactNode
}) {
  return (
    <div style={{ width: '100%' }}>
      <label
        style={{
          display: 'block',
          fontSize: 'var(--crm-text-sm)',
          fontWeight: 600,
          color: pal.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>{children}</div>
      {hint && (
        <div style={{ marginTop: 6, fontSize: 'var(--crm-text-sm)', color: pal.muted, fontWeight: 500 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function OmSectionHead({ index, title, pal }: { index: number; title: string; pal: OmPalette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', marginBottom: 20 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 'var(--crm-radius-pill)',
          flexShrink: 0,
          background: pal.ink,
          color: pal.onAccent,
          fontSize: 'var(--crm-text-md)',
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {index}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--crm-text-5xl)',
          fontWeight: 700,
          color: pal.ink,
          letterSpacing: -0.5,
          lineHeight: 1.15,
        }}
      >
        {title}
      </h2>
    </div>
  )
}

function OmConditionToggle({
  active,
  onToggle,
  icon,
  title,
  pal,
  children,
}: {
  active: boolean
  onToggle: () => void
  icon: SgIconName
  title: string
  pal: OmPalette
  children?: ReactNode
}) {
  return (
    <div
      style={{
        padding: 'var(--crm-space-6xl)',
        borderRadius: 'var(--crm-radius-4xl)',
        background: active ? pal.card : pal.cardSubtle,
        boxShadow: active
          ? `0 0 0 2px ${pal.ink} inset, ${pal.shadow}`
          : pal.cardBorder
            ? `0 0 0 1px ${pal.cardBorder} inset`
            : 'none',
        transition: 'all .2s ease',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--crm-radius-lg)',
            background: active ? pal.ink : pal.card,
            color: active ? pal.onAccent : pal.inkSoft,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            boxShadow: active ? 'none' : pal.shadowSm,
            transition: 'all .2s ease',
          }}
        >
          <SgIcon name={icon} size={18} stroke={active ? pal.onAccent : pal.inkSoft} sw={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: pal.ink }}>{title}</div>
        </div>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 'var(--crm-radius-pill)',
            flexShrink: 0,
            background: active ? pal.ink : pal.card,
            boxShadow: active ? 'none' : `0 0 0 2px ${pal.cardSubtle} inset`,
            display: 'grid',
            placeItems: 'center',
            transition: 'all .15s ease',
          }}
        >
          {active && <SgIcon name="check" size={13} stroke={pal.onAccent} sw={3} />}
        </div>
      </div>
      {active && children && <div style={{ marginTop: 16, paddingLeft: 54 }}>{children}</div>}
    </div>
  )
}

function OmGhostPill({ children, onClick, pal }: { children: ReactNode; onClick: () => void; pal: OmPalette }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: 50,
        padding: '0 var(--crm-space-7xl)',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: h ? pal.card : 'transparent',
        color: pal.inkSoft,
        fontFamily: 'inherit',
        fontSize: 'var(--crm-text-xl)',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-md)',
        whiteSpace: 'nowrap',
        boxShadow: h ? pal.shadow : 'none',
        transition: 'all .18s ease',
      }}
    >
      {children}
    </button>
  )
}

function OmBlackPill({
  children,
  onClick,
  disabled,
  pal,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  pal: OmPalette
}) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: 50,
        padding: '0 28px',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: disabled ? pal.ghost : h ? '#1F2024' : '#0B0C0E',
        color: '#FFFFFF',
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: 'var(--crm-text-xl)',
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-md)',
        whiteSpace: 'nowrap',
        boxShadow: disabled ? 'none' : h ? '0 12px 30px rgba(11,12,14,0.25)' : '0 6px 16px rgba(11,12,14,0.18)',
        transform: h && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .18s ease',
      }}
    >
      {children}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   MODALE OFFRE / CONTRE-OFFRE
// ═══════════════════════════════════════════════════════════════════════
export interface OfferModalSugarProps {
  dealId: string
  kind?: OfferKind
  /** Offre à laquelle on répond (contre-offre). */
  parentOffer?: Offer | null
  dark?: boolean
  /** true = épouse le bento parent (position absolue) ; false = plein écran. */
  contained?: boolean
  /** appelé APRÈS insert crm_offers (statut 'pending'). */
  onSubmit?: (offer: Offer) => void
  onClose: () => void
  /**
   * Substitution d'aperçu (`/dev/pipeline`). Cette modale porte ses PROPRES
   * sources — `useTransaction`, `useProperty`, `useContact` —, toutes gatées sur
   * la session : sans banc elle rend son formulaire mais SANS prix demandé, donc
   * sans montant suggéré ni écart calculé, c'est-à-dire sans la moitié qui
   * distingue une offre d'une saisie libre.
   *
   * Elle ne lit que quatre champs : la projection les nomme tous. L'ÉCRITURE est
   * déjà bloquée par la garde `!user` de `submit` — seule la donnée manquait.
   */
  banc?: OfferModalBanc
}

export interface OfferModalBanc {
  deal: TxLite
  bien: Pick<Property, 'title' | 'price'> | null
  buyer: Pick<Contact, 'first_name' | 'last_name'> | null
}

type TxLite = {
  id: string
  contact_buyer_id: string | null
  property_id: string
}

export default function OfferModalSugar({
  dealId,
  kind = 'offer',
  parentOffer,
  dark = false,
  contained = false,
  onSubmit,
  onClose,
  banc,
}: OfferModalSugarProps) {
  const { t } = useTranslation('pipeline')
  const pal = dark ? OM_DARK : OM_LIGHT
  const isCounter = kind === 'counter'

  const { user } = useAuth()
  const { data: dealRaw } = useTransaction(dealId)
  const liveDeal = dealRaw as TxLite | undefined
  const deal = banc ? banc.deal : liveDeal
  const { data: liveBien } = useProperty(liveDeal?.property_id)
  const { data: liveBuyer } = useContact(liveDeal?.contact_buyer_id ?? undefined)
  const bien = banc ? banc.bien : liveBien
  const buyer = banc ? banc.buyer : liveBuyer
  const { mutate: createOffer, isPending: isSaving, error: saveError } = useCreateOffer()

  const askingPrice = bien?.price ?? null
  const defaultAmount = useMemo(
    () => suggestedOfferAmount(parentOffer ?? undefined, askingPrice),
    [parentOffer, askingPrice],
  )

  const [amount, setAmount] = useState<number>(defaultAmount)
  const [deposit, setDeposit] = useState<number>(parentOffer?.deposit ?? Math.round(defaultAmount * 0.1))
  const [closingDate, setClosingDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 90)
    return d.toISOString().slice(0, 10)
  })
  const [expDate, setExpDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [expTime, setExpTime] = useState('18:00')
  const [conditions, setConditions] = useState<OfferConditions>(() => ({
    ...EMPTY_OFFER_CONDITIONS,
    financing: { active: !isCounter, days: 45, note: '' },
  }))

  // Re-sync des défauts quand la donnée DB arrive (montant/acompte encore à 0).
  useEffect(() => {
    if (defaultAmount && amount === 0) setAmount(defaultAmount)
    if (defaultAmount && deposit === 0) setDeposit(Math.round(defaultAmount * 0.1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAmount])

  // ESC ferme
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleCond = (key: keyof OfferConditions) => {
    if (key === 'other') return
    setConditions((c) => ({
      ...c,
      [key]: { ...(c[key] as object), active: !(c[key] as { active: boolean }).active },
    }))
  }
  const setCondField = (key: keyof OfferConditions, field: 'days' | 'note', value: number | string) => {
    if (key === 'other') return
    setConditions((c) => ({ ...c, [key]: { ...(c[key] as object), [field]: value } }))
  }

  const submit = () => {
    if (!deal || !user) return
    // Garde-fou : champ date vidé → Date invalide → toISOString() throw. On bloque
    // (le bouton Enregistrer est aussi désactivé quand expDate est vide).
    const exp = new Date(`${expDate}T${expTime || '18:00'}:00`)
    if (Number.isNaN(exp.getTime())) return
    const expiresAt = exp.toISOString()
    const byLabel = isCounter
      ? 'MEGGA · Agent'
      : buyer
        ? `${buyer.first_name ?? ''} ${buyer.last_name ?? ''}`.trim() || t('offerModal.label.buyerFallback')
        : t('offerModal.label.buyerFallback')
    createOffer(
      {
        dealId: deal.id,
        parentOfferId: parentOffer?.id ?? null,
        kind,
        fromParty: isCounter ? 'seller' : 'buyer',
        byId: isCounter ? user.id : deal.contact_buyer_id,
        byLabel,
        amount,
        conditions,
        deposit,
        closingDate,
        expiresAt,
      },
      {
        onSuccess: (offer) => {
          onSubmit?.(offer)
          onClose()
        },
      },
    )
  }

  const ecart =
    askingPrice && askingPrice > 0
      ? `${amount >= askingPrice ? '+' : ''}${(((amount - askingPrice) / askingPrice) * 100).toFixed(1)}%`
      : '—'
  const ecartColor =
    askingPrice == null
      ? pal.ink
      : amount >= askingPrice
        ? pal.ok
        : amount >= askingPrice * 0.95
          ? pal.ink
          : pal.warn

  const activeConds = countActiveConditions(conditions)

  return (
    <div
      style={{
        position: contained ? 'absolute' : 'fixed',
        inset: 0,
        zIndex: contained ? 40 : 200,
        borderRadius: contained ? 'inherit' : 0,
        overflow: 'hidden',
        background: pal.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        animation: 'omFadeIn .25s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <style>{`
        @keyframes omFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sgFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* HEADER — titre = bien, bouton fermer à droite (pas d'eyebrow, pas de stepper) */}
      <header
        style={{ padding: '22px 40px 18px', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-5xl)', flexShrink: 0 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 700, color: pal.ink, letterSpacing: -0.4 }}>
            {bien?.title || t('offerModal.header.fallback')}
          </div>
        </div>
        <button
          onClick={onClose}
          title={t('offerModal.cta.close')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--crm-radius-pill)',
            border: 0,
            background: pal.cardSubtle,
            color: pal.inkSoft,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: pal.shadowSm,
          }}
        >
          <SgIcon name="close" size={18} stroke={pal.inkSoft} />
        </button>
      </header>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 40px 40px' }}>
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 44,
            animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          {/* ── 1 · Montant ── */}
          <section>
            <OmSectionHead
              index={1}
              pal={pal}
              title={isCounter ? t('offerModal.section.amountCounter') : t('offerModal.section.amount')}
            />
            <div
              style={{
                background: pal.card,
                borderRadius: 'var(--crm-radius-5xl)',
                border: pal.cardBorder ? `1px solid ${pal.cardBorder}` : 'none',
                boxShadow: pal.shadowLg,
                padding: 32,
              }}
            >
              {parentOffer && (
                <div
                  style={{
                    padding: 'var(--crm-space-3xl)',
                    marginBottom: 28,
                    borderRadius: 'var(--crm-radius-2xl)',
                    background: pal.cardSubtle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--crm-space-2xl)',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--crm-radius-pill)',
                      background: pal.swapBg,
                      color: pal.inkSoft,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: pal.shadowSm,
                    }}
                  >
                    <SgIcon name="swap" size={17} stroke={pal.inkSoft} sw={2.2} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 'var(--crm-text-3xl)',
                        fontWeight: 700,
                        color: pal.ink,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {omFmt(parentOffer.amount)}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-6xl)' }}>
                <OmField
                  label={t('offerModal.field.amount')}
                  hint={askingPrice ? t('offerModal.field.askingPriceHint', { price: omFmt(askingPrice) }) : null}
                  pal={pal}
                >
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(+e.target.value)}
                    style={omInputStyle(pal)}
                  />
                </OmField>
                <OmField label={t('offerModal.field.deposit')} hint={t('offerModal.field.depositHint')} pal={pal}>
                  <input
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(+e.target.value)}
                    style={omInputStyle(pal)}
                  />
                </OmField>
                <OmField label={t('offerModal.field.closingDate')} pal={pal}>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    style={{ ...omInputStyle(pal), fontSize: 'var(--crm-text-xl)' }}
                  />
                </OmField>
                <OmField label={t('offerModal.field.gap')} pal={pal}>
                  <div style={{ ...omInputStyle(pal), display: 'flex', alignItems: 'center', fontSize: 'var(--crm-text-2xl)', color: ecartColor }}>
                    {ecart}
                    <span style={{ marginLeft: 10, fontSize: 'var(--crm-text-md)', color: pal.muted, fontWeight: 500 }}>
                      {t('offerModal.field.gapVsAsking')}
                    </span>
                  </div>
                </OmField>
              </div>
            </div>
          </section>

          {/* ── 2 · Conditions suspensives ── */}
          <section>
            <OmSectionHead index={2} pal={pal} title={t('offerModal.section.conditions')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
              <OmConditionToggle
                active={conditions.financing.active}
                onToggle={() => toggleCond('financing')}
                icon="building"
                title={t('offerModal.condition.financing.title')}
                pal={pal}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--crm-space-2xl)' }}>
                  <OmField label={t('offerModal.condition.financing.daysLabel')} pal={pal}>
                    <input
                      type="number"
                      value={conditions.financing.days ?? 45}
                      onChange={(e) => setCondField('financing', 'days', +e.target.value)}
                      style={{ ...omInputStyle(pal), height: 46, fontSize: 'var(--crm-text-xl)' }}
                    />
                  </OmField>
                  <OmField label={t('offerModal.condition.financing.noteLabel')} pal={pal}>
                    <input
                      type="text"
                      value={conditions.financing.note ?? ''}
                      placeholder={t('offerModal.condition.financing.notePlaceholder')}
                      onChange={(e) => setCondField('financing', 'note', e.target.value)}
                      style={{ ...omInputStyle(pal), height: 46, fontSize: 'var(--crm-text-xl)' }}
                    />
                  </OmField>
                </div>
              </OmConditionToggle>

              <OmConditionToggle
                active={conditions.sale.active}
                onToggle={() => toggleCond('sale')}
                icon="home"
                title={t('offerModal.condition.sale.title')}
                pal={pal}
              />

              <OmConditionToggle
                active={conditions.diagnostic.active}
                onToggle={() => toggleCond('diagnostic')}
                icon="file"
                title={t('offerModal.condition.diagnostic.title')}
                pal={pal}
              >
                <OmField label={t('offerModal.condition.diagnostic.noteLabel')} pal={pal}>
                  <input
                    type="text"
                    value={conditions.diagnostic.note ?? ''}
                    placeholder={t('offerModal.condition.diagnostic.notePlaceholder')}
                    onChange={(e) => setCondField('diagnostic', 'note', e.target.value)}
                    style={{ ...omInputStyle(pal), height: 46, fontSize: 'var(--crm-text-xl)' }}
                  />
                </OmField>
              </OmConditionToggle>

              <OmConditionToggle
                active={conditions.occupancy.active}
                onToggle={() => toggleCond('occupancy')}
                icon="cal"
                title={t('offerModal.condition.occupancy.title')}
                pal={pal}
              >
                <OmField label={t('offerModal.condition.occupancy.dateLabel')} pal={pal}>
                  <input
                    type="date"
                    value={conditions.occupancy.note ?? ''}
                    onChange={(e) => setCondField('occupancy', 'note', e.target.value)}
                    style={{ ...omInputStyle(pal), height: 46, fontSize: 'var(--crm-text-xl)' }}
                  />
                </OmField>
              </OmConditionToggle>

              <div
                style={{
                  padding: 'var(--crm-space-6xl)',
                  borderRadius: 'var(--crm-radius-4xl)',
                  background: pal.card,
                  boxShadow: pal.shadow,
                  border: pal.cardBorder ? `1px solid ${pal.cardBorder}` : 'none',
                }}
              >
                <OmField label={t('offerModal.condition.noteTitle')} pal={pal}>
                  <textarea
                    value={conditions.other}
                    onChange={(e) => setConditions((c) => ({ ...c, other: e.target.value }))}
                    placeholder={t('offerModal.condition.other.placeholder')}
                    rows={3}
                    style={{
                      ...omInputStyle(pal),
                      height: 'auto',
                      padding: 'var(--crm-space-3xl)',
                      fontSize: 'var(--crm-text-xl)',
                      fontWeight: 500,
                      lineHeight: 1.55,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </OmField>
              </div>
            </div>
          </section>

          {/* ── 3 · Validité de l'offre ── */}
          <section>
            <OmSectionHead index={3} pal={pal} title={t('offerModal.section.validity')} />
            <div
              style={{
                background: pal.card,
                borderRadius: 'var(--crm-radius-5xl)',
                border: pal.cardBorder ? `1px solid ${pal.cardBorder}` : 'none',
                boxShadow: pal.shadowLg,
                padding: 32,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-6xl)' }}>
                <OmField label={t('offerModal.field.expiryDate')} pal={pal}>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    style={{ ...omInputStyle(pal), fontSize: 'var(--crm-text-xl)' }}
                  />
                </OmField>
                <OmField label={t('offerModal.field.expiryTime')} pal={pal}>
                  <input
                    type="time"
                    value={expTime}
                    onChange={(e) => setExpTime(e.target.value)}
                    style={{ ...omInputStyle(pal), fontSize: 'var(--crm-text-xl)' }}
                  />
                </OmField>
              </div>
              <div style={{ marginTop: 22, display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                {[
                  { l: t('offerModal.delay.h48'), d: 2 },
                  { l: t('offerModal.delay.days', { count: 5 }), d: 5 },
                  { l: t('offerModal.delay.days', { count: 10 }), d: 10 },
                  { l: t('offerModal.delay.days', { count: 30 }), d: 30 },
                ].map((p) => (
                  <button
                    key={p.d}
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + p.d)
                      setExpDate(d.toISOString().split('T')[0])
                    }}
                    style={{
                      height: 36,
                      padding: '0 var(--crm-space-2xl)',
                      borderRadius: 'var(--crm-radius-pill)',
                      border: 0,
                      background: pal.cardSubtle,
                      color: pal.inkSoft,
                      fontFamily: 'inherit',
                      fontSize: 'var(--crm-text-md)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + {p.l}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Récapitulatif (inversé) ── */}
          <section>
            <div style={{ background: pal.ink, color: pal.onAccent, borderRadius: 'var(--crm-radius-5xl)', padding: 32, boxShadow: pal.shadow }}>
              <div
                style={{
                  fontSize: 'var(--crm-text-sm)',
                  fontWeight: 600,
                  color: pal.recapMut,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 18,
                }}
              >
                {t('offerModal.summary.title')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 500, color: pal.recapMut2 }}>
                  {isCounter ? t('offerModal.summary.counterLabel') : t('offerModal.summary.offerLabel')}
                </div>
                <div
                  style={{
                    fontSize: 'var(--crm-text-8xl)',
                    fontWeight: 700,
                    color: pal.onAccent,
                    letterSpacing: -0.8,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {omFmt(amount)}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--crm-space-lg)',
                  paddingTop: 'var(--crm-space-4xl)',
                  borderTop: `1px solid ${pal.recapLine}`,
                }}
              >
                {[
                  { id: 'deposit', l: t('offerModal.summary.deposit'), v: omFmt(deposit) },
                  {
                    id: 'closing',
                    l: t('offerModal.summary.closing'),
                    v: new Date(closingDate).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' }),
                  },
                  { id: 'conds', l: t('offerModal.summary.activeConditions'), v: String(activeConds) },
                  {
                    id: 'expires',
                    l: t('offerModal.summary.expires'),
                    v: t('offerModal.summary.expiresValue', {
                      date: new Date(expDate).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long' }),
                      time: expTime,
                    }),
                  },
                ].map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 'var(--crm-text-lg)', color: pal.recapMut, fontWeight: 500 }}>{r.l}</span>
                    <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: pal.onAccent, fontVariantNumeric: 'tabular-nums' }}>
                      {r.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* FOOTER — Annuler (ghost) · Enregistrer (pilule noire, sans icône) */}
      <footer style={{ padding: '18px 40px 22px', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', flexShrink: 0 }}>
        <OmGhostPill onClick={onClose} pal={pal}>
          {t('offerModal.cta.cancel')}
        </OmGhostPill>
        <div style={{ flex: 1 }} />
        {saveError && (
          <div role="alert" style={{ fontSize: 'var(--crm-text-md)', color: pal.err, fontWeight: 600, marginRight: 12 }}>
            {saveError.message}
          </div>
        )}
        <OmBlackPill onClick={submit} disabled={isSaving || !expDate} pal={pal}>
          {isSaving ? t('offerModal.cta.saving') : t('offerModal.cta.save')}
        </OmBlackPill>
      </footer>
    </div>
  )
}
