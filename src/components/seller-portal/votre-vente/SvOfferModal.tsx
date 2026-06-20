// MEGGA — Espace vendeur — modal de décision d'offre.
// 3 choix (Accepter / Contre-offrir / Refuser) → contexte agent → confirmation.
// L'agent reste copilote : rien ne part sans « transmettre à mon agent ».
// Phase 1 (visuel) : la transmission réelle est stubbée (prop onSubmit).
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useSP } from './theme'
import type { SellerSP } from './tokens'
import { sellerFmtCHF } from './tokens'
import { SvIcon } from './icons'
import { SvAvatarCircle } from './icons'
import SvModalShell from './SvModalShell'
import type { VenteOfferVM } from './viewModel'

export type OfferDecision = 'accept' | 'counter' | 'refuse'

interface Props {
  offer: VenteOfferVM
  askingPrice: number
  agentName: string
  agentPhoto?: string | null
  onClose: () => void
  /** Transmet la décision à l'agent (edge function token-scoped + audit). Peut être async. */
  onSubmit?: (payload: { decision: OfferDecision; counterAmount?: number }) => void | Promise<void>
}

export default function SvOfferModal({ offer, askingPrice, agentName, agentPhoto, onClose, onSubmit }: Props) {
  const SP = useSP()
  const { t } = useTranslation('common')
  const [choice, setChoice] = useState<OfferDecision | null>(null)
  const [counter, setCounter] = useState<number>(askingPrice)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ecart = offer.amount - askingPrice
  const ecartPct = Math.round((ecart / askingPrice) * 1000) / 10

  const CHOICES: { id: OfferDecision; title: string; desc: string; tone: string; icon: 'check' | 'arrowUpDown' | 'x' }[] = [
    { id: 'accept', title: t('portal.offer.choice.accept.title'), desc: t('portal.offer.choice.accept.desc'), tone: SP.forestGreen, icon: 'check' },
    { id: 'counter', title: t('portal.offer.choice.counter.title'), desc: t('portal.offer.choice.counter.desc'), tone: SP.burntOrange, icon: 'arrowUpDown' },
    { id: 'refuse', title: t('portal.offer.choice.refuse.title'), desc: t('portal.offer.choice.refuse.desc'), tone: '#DC2626', icon: 'x' },
  ]

  // ── Écran de confirmation ──────────────────────────────────────────────
  if (sent) {
    const msg: Record<OfferDecision, string> = {
      accept: t('portal.offer.sent.accept'),
      counter: t('portal.offer.sent.counter', { amount: sellerFmtCHF(counter) }),
      refuse: t('portal.offer.sent.refuse'),
    }
    return (
      <SvModalShell onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '14px 8px 6px' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 999,
              margin: '0 auto 22px',
              background: SP.accent,
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 10px 26px rgba(11,12,14,0.22)',
            }}
          >
            <SvIcon name="check" size={28} stroke={SP.onAccent} sw={2.4} />
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: 23, fontWeight: 700, color: SP.ink, letterSpacing: -0.5 }}>
            {t('portal.offer.sent.title')}
          </h2>
          <p style={{ margin: '0 auto 26px', maxWidth: 380, fontSize: 15, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.55 }}>
            {choice ? msg[choice] : ''}
          </p>
          <button
            onClick={onClose}
            style={blackBtn(SP, false)}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, blackBtnHover(SP))}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, blackBtn(SP, false))}
          >
            {t('portal.offer.sent.back')}
          </button>
        </div>
      </SvModalShell>
    )
  }

  // ── Écran principal ─────────────────────────────────────────────────────
  const canConfirm = !!choice && (choice !== 'counter' || counter > 0)
  const submit = async () => {
    if (!canConfirm || !choice || sending) return
    setError(null)
    setSending(true)
    try {
      await onSubmit?.({ decision: choice, counterAmount: choice === 'counter' ? counter : undefined })
      setSent(true)
    } catch {
      setError(t('portal.offer.error.send'))
    } finally {
      setSending(false)
    }
  }

  return (
    <SvModalShell onClose={onClose}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11.5,
            fontWeight: 700,
            color: SP.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          {t('portal.offer.eyebrow')}
        </span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: SP.ink, letterSpacing: -0.5 }}>
          {t('portal.offer.heading')}
        </h2>
      </div>

      {/* Récap offre */}
      <div
        style={{
          background: SP.cardSubtle,
          borderRadius: 18,
          padding: '20px 22px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: SP.muted, marginBottom: 5 }}>{t('portal.offer.recap.amount')}</div>
          <div className="sg-tnum" style={{ fontSize: 30, fontWeight: 700, color: SP.ink, letterSpacing: -0.8, lineHeight: 1 }}>
            {sellerFmtCHF(offer.amount)}
          </div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: SP.hairline, margin: '2px 0' }} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: SP.muted, marginBottom: 5 }}>{t('portal.offer.recap.gap')}</div>
          <div className="sg-tnum" style={{ fontSize: 17, fontWeight: 700, color: SP.inkSoft, letterSpacing: -0.3 }}>
            {ecart >= 0 ? '+' : '−'}
            {sellerFmtCHF(Math.abs(ecart))}
            <span style={{ fontSize: 13.5, fontWeight: 600, color: SP.muted, marginLeft: 7 }}>
              ({ecart >= 0 ? '+' : '−'}
              {Math.abs(ecartPct)} %)
            </span>
          </div>
        </div>
        <span className="sg-tnum" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, color: SP.muted, whiteSpace: 'nowrap' }}>
          {offer.date}
        </span>
      </div>

      {/* Choix */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {CHOICES.map((c) => {
          const active = choice === c.id
          return (
            <button
              key={c.id}
              onClick={() => setChoice(c.id)}
              style={{
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 18px',
                borderRadius: 16,
                border: 0,
                background: active ? SP.cardSubtle : SP.card,
                boxShadow: active ? `0 0 0 2px ${SP.accent} inset, ${SP.shadowSm}` : `0 0 0 1.5px ${SP.line} inset`,
                transition: 'box-shadow .18s ease, background .18s ease',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background: active ? c.tone : SP.cardSubtle,
                  color: active ? '#fff' : SP.muted,
                  transition: 'all .18s ease',
                }}
              >
                <SvIcon name={c.icon} size={18} stroke={active ? '#fff' : SP.muted} sw={2} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: SP.ink, letterSpacing: -0.2 }}>{c.title}</span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: SP.muted, marginTop: 2 }}>{c.desc}</span>
              </span>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background: active ? SP.accent : SP.card,
                  boxShadow: active ? 'none' : `inset 0 0 0 2px ${SP.line}`,
                }}
              >
                {active && <SvIcon name="check" size={13} stroke={SP.onAccent} sw={2.6} />}
              </span>
            </button>
          )
        })}
      </div>

      {/* Champ contre-offre */}
      {choice === 'counter' && (
        <div className="sg-enter" style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: SP.inkSoft, marginBottom: 8 }}>
            {t('portal.offer.counter.label')}
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 15,
                fontWeight: 600,
                color: SP.muted,
                pointerEvents: 'none',
              }}
            >
              CHF
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={counter.toLocaleString('fr-CH').replace(/[\s.,]/g, "'")}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
                setCounter(Number.isNaN(n) ? 0 : n)
              }}
              className="sg-tnum"
              style={{
                width: '100%',
                height: 52,
                paddingLeft: 58,
                paddingRight: 18,
                borderRadius: 12,
                border: 0,
                background: SP.cardSubtle,
                boxShadow: `inset 0 0 0 1.5px ${SP.line}`,
                fontSize: 18,
                fontWeight: 700,
                color: SP.ink,
                letterSpacing: -0.4,
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.boxShadow = `inset 0 0 0 2px ${SP.accent}`)}
              onBlur={(e) => (e.target.style.boxShadow = `inset 0 0 0 1.5px ${SP.line}`)}
            />
          </div>
        </div>
      )}

      {/* Rassurance agent */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 16px',
          borderRadius: 14,
          background: SP.cardSubtle,
          marginBottom: 24,
        }}
      >
        <SvAvatarCircle name={agentName} size={34} photo={agentPhoto} />
        <span style={{ fontSize: 13.5, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.45 }}>
          {t('portal.offer.reassurance', { name: agentName.split(' ')[0] })}
        </span>
      </div>

      {/* Erreur de transmission */}
      {error && (
        <div style={{ marginBottom: 14, fontSize: 13, fontWeight: 600, color: SP.err, textAlign: 'center', lineHeight: 1.45 }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onClose}
          style={ghostBtn(SP)}
          onMouseEnter={(e) => (e.currentTarget.style.background = SP.cardSubtle)}
          onMouseLeave={(e) => (e.currentTarget.style.background = SP.card)}
        >
          {t('portal.offer.cancel')}
        </button>
        <button
          disabled={!canConfirm || sending}
          onClick={submit}
          style={blackBtn(SP, !canConfirm || sending)}
          onMouseEnter={(e) => canConfirm && !sending && Object.assign(e.currentTarget.style, blackBtnHover(SP))}
          onMouseLeave={(e) => canConfirm && !sending && Object.assign(e.currentTarget.style, blackBtn(SP, false))}
        >
          {sending ? t('portal.offer.submitting') : t('portal.offer.submit')}
        </button>
      </div>
    </SvModalShell>
  )
}

// ── Styles boutons ─────────────────────────────────────────────────────
function blackBtn(SP: SellerSP, disabled: boolean): CSSProperties {
  return {
    flex: 1,
    height: 50,
    borderRadius: 999,
    border: 0,
    cursor: disabled ? 'default' : 'pointer',
    background: disabled ? SP.disabledBg : SP.accent,
    color: SP.onAccent,
    fontSize: 14.5,
    fontWeight: 700,
    fontFamily: 'inherit',
    boxShadow: disabled ? 'none' : '0 6px 16px rgba(11,12,14,0.18)',
    transform: 'translateY(0)',
    transition: 'all .18s ease',
  }
}
function blackBtnHover(SP: SellerSP): CSSProperties {
  return { background: SP.accentHover, transform: 'translateY(-1px)', boxShadow: '0 12px 30px rgba(11,12,14,0.25)' }
}
function ghostBtn(SP: SellerSP): CSSProperties {
  return {
    flex: '0 0 auto',
    minWidth: 120,
    height: 50,
    borderRadius: 999,
    cursor: 'pointer',
    border: 0,
    background: SP.card,
    color: SP.inkSoft,
    boxShadow: `inset 0 0 0 1.5px ${SP.line}`,
    fontSize: 14.5,
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'background .18s ease',
  }
}
