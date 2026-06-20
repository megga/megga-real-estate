// MEGGA CRM Sprint 2 — Modal Offre / Contre-offre Sugar Pure
// Port pixel-près de crm-offer-modal-sugar.jsx (handoff Sprint 2).
//
// Format : modal plein écran Sugar 3 étapes
//   1. Montant (amount + deposit + closingDate + écart vs prix demandé)
//   2. Conditions suspensives (4 cards toggles + texte libre)
//   3. Délai expiration + récap noir + bouton "Enregistrer & envoyer"
//
// Routes :
//   /dashboard/transactions/:id/offre/nouvelle   → offer (acheteur)
//   /dashboard/transactions/:id/offre/contre     → counter (vendeur, basé sur dernière offre)
//
// Au submit : useCreateOffer → trigger DB AuditEvent → close + back to fiche Deal.

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { SugarV3, SUGAR_V3_KEYFRAMES } from '@/components/crm-sugar-v3/tokens'
import { SgIcon } from '@/components/crm-sugar-v3/icons'
import { useTransaction } from '@/hooks/useTransactions'
import { useProperty } from '@/hooks/useProperties'
import { useContact } from '@/hooks/useContacts'
import {
  useOfferChain,
  useCreateOffer,
  lastOffer,
  suggestedOfferAmount,
} from '@/hooks/useOffers'
import { useAuth } from '@/hooks/useAuth'
import { EMPTY_OFFER_CONDITIONS, countActiveConditions } from '@/types/offer'
import type { OfferConditions, OfferKind } from '@/types/offer'

const STEP_KEYS = ['amount', 'conditions', 'delay'] as const

function fmt(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—'
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return `CHF ${num.toLocaleString('fr-CH').replace(/[  ,]/g, "'")}`
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 54,
  padding: '0 18px',
  background: SugarV3.cardSubtle,
  border: 0,
  borderRadius: 14,
  fontFamily: 'inherit',
  fontSize: 18,
  fontWeight: 600,
  color: SugarV3.ink,
  outline: 'none',
  boxSizing: 'border-box',
  fontVariantNumeric: 'tabular-nums',
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string | null
  children: React.ReactNode
}) {
  return (
    <div style={{ width: '100%' }}>
      <label
        style={{
          display: 'block',
          fontSize: 11.5,
          fontWeight: 600,
          color: SugarV3.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>{children}</div>
      {hint && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            color: SugarV3.muted,
            fontWeight: 500,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

function ConditionToggle({
  active,
  onToggle,
  icon,
  title,
  sub,
  children,
}: {
  active: boolean
  onToggle: () => void
  icon: string
  title: string
  sub: string
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: 22,
        borderRadius: 20,
        background: active ? SugarV3.card : SugarV3.cardSubtle,
        boxShadow: active
          ? `0 0 0 2px ${SugarV3.ink} inset, ${SugarV3.shadow}`
          : 'none',
        transition: 'all .2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: active ? SugarV3.ink : SugarV3.card,
            color: active ? '#fff' : SugarV3.inkSoft,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            boxShadow: active ? 'none' : SugarV3.shadowSm,
            transition: 'all .2s ease',
          }}
        >
          <SgIcon
            name={icon}
            size={18}
            stroke={active ? '#fff' : SugarV3.inkSoft}
            sw={1.8}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: SugarV3.ink,
              marginBottom: 3,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: SugarV3.muted,
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            {sub}
          </div>
        </div>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            flexShrink: 0,
            background: active ? SugarV3.ink : SugarV3.card,
            boxShadow: active ? 'none' : `0 0 0 2px ${SugarV3.cardSubtle} inset`,
            display: 'grid',
            placeItems: 'center',
            transition: 'all .15s ease',
          }}
        >
          {active && <SgIcon name="check" size={13} stroke="#fff" sw={3} />}
        </div>
      </div>
      {active && children && (
        <div style={{ marginTop: 16, paddingLeft: 54 }}>{children}</div>
      )}
    </div>
  )
}

export default function OfferModalSugarV3Page() {
  const { t } = useTranslation('pipeline')
  const { id, kind: rawKind } = useParams<{ id: string; kind: string }>()
  const navigate = useNavigate()
  const kind: OfferKind = rawKind === 'contre' ? 'counter' : 'offer'
  const isCounter = kind === 'counter'

  const { user } = useAuth()
  const { data: dealRaw } = useTransaction(id)
  type TxLite = {
    id: string
    contact_buyer_id: string | null
    property_id: string
  }
  const deal = dealRaw as TxLite | undefined
  const { data: bien } = useProperty(deal?.property_id)
  const { data: buyer } = useContact(deal?.contact_buyer_id ?? undefined)
  const { data: chain } = useOfferChain(deal?.id)
  const parentOffer = isCounter ? lastOffer(chain) : undefined
  const {
    mutate: createOffer,
    isPending: isSaving,
    error: saveError,
  } = useCreateOffer()

  const askingPrice = bien?.price ?? null
  const defaultAmount = useMemo(
    () => suggestedOfferAmount(parentOffer, askingPrice),
    [parentOffer, askingPrice],
  )

  const [step, setStep] = useState(0)
  const [amount, setAmount] = useState<number>(defaultAmount)
  const [deposit, setDeposit] = useState<number>(
    parentOffer?.deposit ?? Math.round(defaultAmount * 0.1),
  )
  // Default dates computed from today — the previous hardcoded literals
  // ('2026-07-31' closing, '2026-05-22' expiration) silently shipped
  // pre-expired offers any time the agent didn't manually override.
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

  // Re-sync defaults when DB data arrives
  useEffect(() => {
    if (defaultAmount && amount === 0) setAmount(defaultAmount)
    if (defaultAmount && deposit === 0)
      setDeposit(Math.round(defaultAmount * 0.1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAmount])

  // ESC close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    if (id) navigate(`/dashboard/transactions/${id}`)
    else navigate('/dashboard/pipeline')
  }

  const toggleCond = (key: keyof OfferConditions) => {
    if (key === 'other') return
    setConditions((c) => ({
      ...c,
      [key]: { ...(c[key] as object), active: !(c[key] as { active: boolean }).active },
    }))
  }
  const setCondField = <K extends keyof OfferConditions>(
    key: K,
    field: 'days' | 'note',
    value: number | string,
  ) => {
    if (key === 'other') return
    setConditions((c) => ({
      ...c,
      [key]: { ...(c[key] as object), [field]: value },
    }))
  }

  const submit = () => {
    if (!deal || !user) return
    const expiresAt = new Date(`${expDate}T${expTime}:00`).toISOString()
    const byLabel = isCounter
      ? 'MEGGA · Agent'
      : buyer
        ? `${buyer.first_name ?? ''} ${buyer.last_name ?? ''}`.trim()
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
      { onSuccess: () => close() },
    )
  }

  const ecart =
    askingPrice && askingPrice > 0
      ? `${amount >= askingPrice ? '+' : ''}${(
          ((amount - askingPrice) / askingPrice) *
          100
        ).toFixed(1)}%`
      : '—'
  const ecartColor =
    askingPrice == null
      ? SugarV3.ink
      : amount >= askingPrice
        ? SugarV3.ok
        : amount >= askingPrice * 0.95
          ? SugarV3.ink
          : SugarV3.warn

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: SugarV3.bgGradient,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: SugarV3.font,
      }}
    >
      <style>{SUGAR_V3_KEYFRAMES}</style>
      <style>{`@keyframes omFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* HEADER */}
      <header
        style={{
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexShrink: 0,
        }}
      >
        <button
          onClick={close}
          title={t('offerModal.cta.close')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 0,
            background: SugarV3.cardSubtle,
            color: SugarV3.inkSoft,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: SugarV3.shadowSm,
          }}
        >
          <SgIcon name="close" size={18} stroke={SugarV3.inkSoft} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: SugarV3.muted,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {isCounter
              ? t('offerModal.eyebrow.counter')
              : t('offerModal.eyebrow.offer')}
            {bien && <> · {bien.title}</>}
          </div>
        </div>
        {/* Stepper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {STEP_KEYS.map((s, i) => {
            const done = i < step
            const active = i === step
            return (
              <span
                key={s}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background:
                        active || done ? SugarV3.ink : SugarV3.cardSubtle,
                      color: active || done ? '#fff' : SugarV3.muted,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: active
                        ? '0 0 0 5px rgba(11,12,14,0.10), 0 4px 12px rgba(11,12,14,0.18)'
                        : 'none',
                    }}
                  >
                    {done ? (
                      <SgIcon name="check" size={13} stroke="#fff" sw={2.5} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: active || done ? 700 : 500,
                      color: active
                        ? SugarV3.ink
                        : done
                          ? SugarV3.inkSoft
                          : SugarV3.muted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(`offerModal.step.${s}`)}
                  </div>
                </div>
                {i < STEP_KEYS.length - 1 && (
                  <div
                    style={{
                      width: 48,
                      height: 2,
                      margin: '0 14px',
                      background: i < step ? SugarV3.ink : SugarV3.cardSubtle,
                    }}
                  />
                )}
              </span>
            )
          })}
        </div>
      </header>

      {/* CONTENT */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 40px 40px',
        }}
      >
        <div
          key={step}
          style={{
            maxWidth: 920,
            margin: '0 auto',
            animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          {/* STEP 0 — MONTANT */}
          {step === 0 && (
            <>
              <div style={{ marginBottom: 36, maxWidth: 720 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: SugarV3.muted,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    marginBottom: 14,
                  }}
                >
                  {t('offerModal.step0.eyebrow')}
                </div>
                <h1
                  style={{
                    margin: '0 0 14px',
                    fontSize: 38,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.8,
                    lineHeight: 1.1,
                  }}
                >
                  {isCounter
                    ? t('offerModal.step0.title.counter')
                    : t('offerModal.step0.title.offer')}
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: SugarV3.inkSoft,
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  {isCounter
                    ? t('offerModal.step0.subtitle.counter')
                    : t('offerModal.step0.subtitle.offer')}
                </p>
              </div>

              <div
                style={{
                  background: SugarV3.card,
                  borderRadius: 24,
                  boxShadow: SugarV3.shadowLg,
                  padding: 36,
                  maxWidth: 720,
                }}
              >
                {parentOffer && (
                  <div
                    style={{
                      padding: 16,
                      marginBottom: 28,
                      borderRadius: 16,
                      background: SugarV3.cardSubtle,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: SugarV3.ink,
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <SgIcon name="swap" size={15} stroke="#fff" sw={2} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: SugarV3.muted,
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        {t('offerModal.field.offerFrom', {
                          label: parentOffer.by_label,
                        })}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: SugarV3.ink,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmt(parentOffer.amount)}
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 22,
                  }}
                >
                  <Field
                    label={t('offerModal.field.amount')}
                    hint={
                      askingPrice
                        ? t('offerModal.field.askingPriceHint', {
                            price: fmt(askingPrice),
                          })
                        : null
                    }
                  >
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(+e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field
                    label={t('offerModal.field.deposit')}
                    hint={t('offerModal.field.depositHint')}
                  >
                    <input
                      type="number"
                      value={deposit}
                      onChange={(e) => setDeposit(+e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label={t('offerModal.field.closingDate')}>
                    <input
                      type="date"
                      value={closingDate}
                      onChange={(e) => setClosingDate(e.target.value)}
                      style={{ ...inputStyle, fontSize: 15 }}
                    />
                  </Field>
                  <Field label={t('offerModal.field.gap')}>
                    <div
                      style={{
                        ...inputStyle,
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: 16,
                        color: ecartColor,
                      }}
                    >
                      {ecart}
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 12,
                          color: SugarV3.muted,
                          fontWeight: 500,
                        }}
                      >
                        {t('offerModal.field.gapVsAsking')}
                      </span>
                    </div>
                  </Field>
                </div>
              </div>
            </>
          )}

          {/* STEP 1 — CONDITIONS */}
          {step === 1 && (
            <>
              <div style={{ marginBottom: 36, maxWidth: 720 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: SugarV3.muted,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    marginBottom: 14,
                  }}
                >
                  {t('offerModal.step1.eyebrow')}
                </div>
                <h1
                  style={{
                    margin: '0 0 14px',
                    fontSize: 38,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.8,
                    lineHeight: 1.1,
                  }}
                >
                  {t('offerModal.step1.title')}
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: SugarV3.inkSoft,
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  {t('offerModal.step1.subtitle')}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  maxWidth: 720,
                }}
              >
                <ConditionToggle
                  active={conditions.financing.active}
                  onToggle={() => toggleCond('financing')}
                  icon="shield"
                  title={t('offerModal.condition.financing.title')}
                  sub={t('offerModal.condition.financing.sub')}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '200px 1fr',
                      gap: 14,
                    }}
                  >
                    <Field label={t('offerModal.condition.financing.daysLabel')}>
                      <input
                        type="number"
                        value={conditions.financing.days ?? 45}
                        onChange={(e) =>
                          setCondField('financing', 'days', +e.target.value)
                        }
                        style={{ ...inputStyle, height: 46, fontSize: 15 }}
                      />
                    </Field>
                    <Field label={t('offerModal.condition.financing.noteLabel')}>
                      <input
                        type="text"
                        value={conditions.financing.note ?? ''}
                        placeholder={t('offerModal.condition.financing.notePlaceholder')}
                        onChange={(e) =>
                          setCondField('financing', 'note', e.target.value)
                        }
                        style={{ ...inputStyle, height: 46, fontSize: 15 }}
                      />
                    </Field>
                  </div>
                </ConditionToggle>

                <ConditionToggle
                  active={conditions.sale.active}
                  onToggle={() => toggleCond('sale')}
                  icon="home"
                  title={t('offerModal.condition.sale.title')}
                  sub={t('offerModal.condition.sale.sub')}
                />

                <ConditionToggle
                  active={conditions.diagnostic.active}
                  onToggle={() => toggleCond('diagnostic')}
                  icon="file"
                  title={t('offerModal.condition.diagnostic.title')}
                  sub={t('offerModal.condition.diagnostic.sub')}
                >
                  <Field label={t('offerModal.condition.diagnostic.noteLabel')}>
                    <input
                      type="text"
                      value={conditions.diagnostic.note ?? ''}
                      placeholder={t('offerModal.condition.diagnostic.notePlaceholder')}
                      onChange={(e) =>
                        setCondField('diagnostic', 'note', e.target.value)
                      }
                      style={{ ...inputStyle, height: 46, fontSize: 15 }}
                    />
                  </Field>
                </ConditionToggle>

                <ConditionToggle
                  active={conditions.occupancy.active}
                  onToggle={() => toggleCond('occupancy')}
                  icon="cal"
                  title={t('offerModal.condition.occupancy.title')}
                  sub={t('offerModal.condition.occupancy.sub')}
                >
                  <Field label={t('offerModal.condition.occupancy.dateLabel')}>
                    <input
                      type="date"
                      value={conditions.occupancy.note ?? ''}
                      onChange={(e) =>
                        setCondField('occupancy', 'note', e.target.value)
                      }
                      style={{ ...inputStyle, height: 46, fontSize: 15 }}
                    />
                  </Field>
                </ConditionToggle>

                <div
                  style={{
                    padding: 22,
                    borderRadius: 20,
                    background: SugarV3.card,
                    boxShadow: SugarV3.shadow,
                  }}
                >
                  <Field
                    label={t('offerModal.condition.other.label')}
                    hint={t('offerModal.condition.other.hint')}
                  >
                    <textarea
                      value={conditions.other}
                      onChange={(e) =>
                        setConditions((c) => ({ ...c, other: e.target.value }))
                      }
                      placeholder={t('offerModal.condition.other.placeholder')}
                      rows={3}
                      style={{
                        ...inputStyle,
                        height: 'auto',
                        padding: 16,
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: 1.55,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </Field>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 — DÉLAI & CONFIRMATION */}
          {step === 2 && (
            <>
              <div style={{ marginBottom: 36, maxWidth: 720 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: SugarV3.muted,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    marginBottom: 14,
                  }}
                >
                  {t('offerModal.step2.eyebrow')}
                </div>
                <h1
                  style={{
                    margin: '0 0 14px',
                    fontSize: 38,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.8,
                    lineHeight: 1.1,
                  }}
                >
                  {t('offerModal.step2.title')}
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: SugarV3.inkSoft,
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  {t('offerModal.step2.subtitle')}
                </p>
              </div>

              <div
                style={{
                  background: SugarV3.card,
                  borderRadius: 24,
                  boxShadow: SugarV3.shadowLg,
                  padding: 36,
                  maxWidth: 720,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 22,
                  }}
                >
                  <Field label={t('offerModal.field.expiryDate')}>
                    <input
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      style={{ ...inputStyle, fontSize: 15 }}
                    />
                  </Field>
                  <Field label={t('offerModal.field.expiryTime')}>
                    <input
                      type="time"
                      value={expTime}
                      onChange={(e) => setExpTime(e.target.value)}
                      style={{ ...inputStyle, fontSize: 15 }}
                    />
                  </Field>
                </div>
                <div
                  style={{
                    marginTop: 22,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
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
                        padding: '0 14px',
                        borderRadius: 999,
                        border: 0,
                        background: SugarV3.cardSubtle,
                        color: SugarV3.inkSoft,
                        fontFamily: 'inherit',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + {p.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Récap noir */}
              <div
                style={{
                  background: SugarV3.ink,
                  color: '#fff',
                  borderRadius: 24,
                  padding: 32,
                  maxWidth: 720,
                  boxShadow: SugarV3.shadow,
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.6)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 18,
                  }}
                >
                  {t('offerModal.summary.title')}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {isCounter
                      ? t('offerModal.summary.counterLabel')
                      : t('offerModal.summary.offerLabel')}
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: '#fff',
                      letterSpacing: -0.8,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt(amount)}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    paddingTop: 18,
                    borderTop: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  {[
                    { id: 'deposit', l: t('offerModal.summary.deposit'), v: fmt(deposit) },
                    {
                      id: 'closing',
                      l: t('offerModal.summary.closing'),
                      v: new Date(closingDate).toLocaleDateString('fr-CH', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      }),
                    },
                    {
                      id: 'activeConditions',
                      l: t('offerModal.summary.activeConditions'),
                      v: String(countActiveConditions(conditions)),
                    },
                    {
                      id: 'expires',
                      l: t('offerModal.summary.expires'),
                      v: t('offerModal.summary.expiresValue', {
                        date: new Date(expDate).toLocaleDateString('fr-CH', {
                          day: '2-digit',
                          month: 'long',
                        }),
                        time: expTime,
                      }),
                    },
                  ].map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: 'rgba(255,255,255,0.6)',
                          fontWeight: 500,
                        }}
                      >
                        {r.l}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#fff',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {r.v}
                      </span>
                    </div>
                  ))}
                </div>
                {/* "MEGGA AI peut générer le PDF + e-sign + notifier
                    automatiquement" tagline removed — none of those
                    actually wire. `submit()` only inserts the offer row.
                    Real PDF gen + e-sign + Resend notification are
                    tracked as separate chips. */}
              </div>
            </>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer
        style={{
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0,
          background: SugarV3.card,
          boxShadow: '0 -8px 24px rgba(15,23,42,0.04)',
        }}
      >
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : close())}
          style={{
            height: 50,
            padding: '0 24px',
            borderRadius: 999,
            border: 0,
            background: 'transparent',
            color: SugarV3.inkSoft,
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <SgIcon name="arrowL" size={15} stroke={SugarV3.inkSoft} />
          {step === 0 ? t('offerModal.cta.cancel') : t('offerModal.cta.back')}
        </button>
        <div style={{ flex: 1 }} />
        {saveError && (
          <div
            role="alert"
            style={{
              fontSize: 12.5,
              color: SugarV3.err,
              fontWeight: 600,
              marginRight: 12,
            }}
          >
            {saveError.message}
          </div>
        )}
        <div
          style={{
            fontSize: 12.5,
            color: SugarV3.muted,
            fontWeight: 600,
          }}
        >
          {t('offerModal.footer.stepCount', {
            current: step + 1,
            total: STEP_KEYS.length,
          })}
        </div>
        {step < STEP_KEYS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            style={{
              height: 50,
              padding: '0 28px',
              borderRadius: 999,
              border: 0,
              background: SugarV3.black,
              color: '#fff',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 14.5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
            }}
          >
            {t('offerModal.cta.continue')}
            <SgIcon name="arrowR" size={14} stroke="#fff" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={isSaving}
            style={{
              height: 50,
              padding: '0 28px',
              borderRadius: 999,
              border: 0,
              background: isSaving ? SugarV3.ghost : SugarV3.black,
              color: '#fff',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 14.5,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
            }}
          >
            <SgIcon name="check" size={14} stroke="#fff" sw={2.5} />
            {isSaving ? t('offerModal.cta.submitting') : t('offerModal.cta.submit')}
          </button>
        )}
      </footer>
    </div>
  )
}
