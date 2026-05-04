// MEGGA — Mandate signing modal (Swisscom Sign QES, 3 steps)
// Port from `megga-mandate-modal.jsx` du bundle (822l).
//
// 3 steps : Review mandate document + accept terms → Identification SMS OTP →
// Apply qualified electronic signature (QES) → success state.
//
// Conforme art. 412 ss CO + SCSE (signature électronique qualifiée). Mandat
// gratuit pour le vendeur (rémunération MEGGA via accord commercial distinct).

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// ─── Tokens ──────────────────────────────────────────────────────────────

const M = {
  ink: '#0E1410',
  border: '#DDE2EA',
  section: '#F6F8F4',
  muted: '#7A8079',
  soft: '#3F4640',
}
const FF = '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
const BLUE = '#0041D9'
const BLUE_SOFT = '#E8EFFE'
const RED = '#E53935'

// ─── Listing shape (porté pour ce composant) ─────────────────────────────

export interface MandateListing {
  id: string
  dossier: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: string
    city: string
    npa: string
    canton?: string
    surface: number
  }
  estimation?: { low?: number; mid?: number; high?: number; isRent?: boolean }
  agent: { name: string; agency?: string }
}

// ─── Icons ───────────────────────────────────────────────────────────────

const MSIcon = {
  close: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  ),
  doc: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 1.5h6.5L13 5v9.5H3V1.5z M9.5 1.5V5H13" />
    </svg>
  ),
  shield: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5l5.5 1.8v4.4c0 3.3-2.4 5.6-5.5 6.8-3.1-1.2-5.5-3.5-5.5-6.8V3.3L8 1.5z M5.8 8l1.6 1.6L10.5 6.4" />
    </svg>
  ),
  phone: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 1.5h6v13H5z M7 12.5h2" />
    </svg>
  ),
  sign: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13.5c2-1 4-4 6-6s4-3 5-2-1 3-3 5-5 4-6 4 1-1 1-1" />
      <path d="M2 14.5h12" />
    </svg>
  ),
  arrow: (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h8M7 3l4 4-4 4" />
    </svg>
  ),
  arrowBack: (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 7H3M7 3L3 7l4 4" />
    </svg>
  ),
  download: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5v9 M5 7.5l3 3 3-3 M2.5 13.5h11" />
    </svg>
  ),
}

// ─── Stepper ─────────────────────────────────────────────────────────────

function MSStepper({ step }: { step: number }) {
  const steps = [
    { n: 1, label: 'Réviser', sub: 'Le mandat' },
    { n: 2, label: "S'identifier", sub: 'Code SMS' },
    { n: 3, label: 'Signer', sub: 'Signature QES' },
  ]
  return (
    <div
      style={{
        display: 'flex', alignItems: 'stretch', gap: 0,
        padding: '20px 32px 22px', borderBottom: `1px solid ${M.border}`,
      }}
    >
      {steps.map((s, i) => {
        const done = step > s.n
        const active = step === s.n
        return (
          <Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? BLUE : active ? M.ink : '#fff',
                  color: done || active ? '#fff' : M.muted,
                  border: done || active ? 'none' : `1.5px solid ${M.border}`,
                  fontFamily: FF, fontSize: 13, fontWeight: 700,
                  transition: 'all 0.2s ease',
                }}
              >
                {done ? MSIcon.check : s.n}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: FF, fontSize: 13, fontWeight: 700,
                    color: active || done ? M.ink : M.muted, letterSpacing: -0.1, lineHeight: 1.2,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontFamily: FF, fontSize: 11, color: M.muted, letterSpacing: 0.2, marginTop: 2 }}>
                  {s.sub}
                </div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1, alignSelf: 'center', height: 1.5,
                  background: done ? BLUE : M.border,
                  margin: '0 16px', transition: 'background 0.2s ease',
                }}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

// ─── Step 1 — Review mandate ─────────────────────────────────────────────

function MSStep1Review({
  listing, accepted, setAccepted,
}: {
  listing: MandateListing
  accepted: boolean
  setAccepted: (v: boolean) => void
}) {
  const d = listing.dossier
  const e = listing.estimation || {}
  const agent = listing.agent
  const fmt = (n: number) => 'CHF ' + n.toLocaleString('fr-CH')
  const isRent = !!e.isRent
  const today = new Date().toLocaleDateString('fr-CH', { year: 'numeric', month: 'long', day: 'numeric' })
  const durationMonths = isRent ? 3 : 6

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          border: `1px solid ${M.border}`, borderRadius: 14,
          background: '#fff', overflow: 'hidden',
          boxShadow: '0 8px 24px -12px rgba(14,20,16,0.10)',
        }}
      >
        {/* Doc chrome */}
        <div
          style={{
            padding: '12px 18px', borderBottom: `1px solid ${M.border}`,
            background: '#FAFBFD',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: 7, background: BLUE_SOFT, color: BLUE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {MSIcon.doc}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FF, fontSize: 12, fontWeight: 700, color: M.ink }}>
              Mandat_{d.address.replace(/[^A-Za-z0-9]/g, '_').slice(0, 20)}.pdf
            </div>
            <div style={{ fontFamily: FF, fontSize: 10, color: M.muted, letterSpacing: 0.2 }}>
              4 pages · 187 Ko
            </div>
          </div>
          <button
            style={{
              height: 30, padding: '0 12px', borderRadius: 7,
              background: '#fff', border: `1px solid ${M.border}`,
              fontFamily: FF, fontSize: 11, fontWeight: 600, color: M.ink,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {MSIcon.download} Télécharger le brouillon
          </button>
        </div>

        {/* Doc body */}
        <div
          style={{
            padding: '26px 32px',
            maxHeight: 280, overflowY: 'auto',
            fontFamily: FF, color: M.ink, fontSize: 11.5, lineHeight: 1.7,
            background: '#fff',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div
              style={{
                fontSize: 9, letterSpacing: 2, color: M.muted, fontWeight: 700,
                textTransform: 'uppercase', marginBottom: 6,
              }}
            >
              République et Canton de {d.canton || 'Genève'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>
              MANDAT DE COURTAGE {isRent ? 'POUR LOCATION' : 'EXCLUSIF DE VENTE'}
            </div>
            <div style={{ fontSize: 10, color: M.muted, marginTop: 4 }}>
              Conforme à l'art. 412 ss CO
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
                color: M.muted, marginBottom: 6,
              }}
            >
              Entre les soussignés
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ padding: 10, background: M.section, borderRadius: 8 }}>
                <div
                  style={{
                    fontSize: 9, color: M.muted, fontWeight: 700, marginBottom: 3,
                    textTransform: 'uppercase', letterSpacing: 0.4,
                  }}
                >
                  Mandant
                </div>
                <div style={{ fontWeight: 700 }}>{d.firstName} {d.lastName}</div>
                <div style={{ fontSize: 10.5, color: M.soft, marginTop: 2 }}>{d.email}</div>
                <div style={{ fontSize: 10.5, color: M.soft }}>{d.phone}</div>
              </div>
              <div style={{ padding: 10, background: M.section, borderRadius: 8 }}>
                <div
                  style={{
                    fontSize: 9, color: M.muted, fontWeight: 700, marginBottom: 3,
                    textTransform: 'uppercase', letterSpacing: 0.4,
                  }}
                >
                  Mandataire
                </div>
                <div style={{ fontWeight: 700 }}>{agent.agency || 'MEGGA Partners SA'}</div>
                <div style={{ fontSize: 10.5, color: M.soft, marginTop: 2 }}>
                  Représentée par {agent.name}
                </div>
                <div style={{ fontSize: 10.5, color: M.soft }}>Rue du Rhône 14, 1204 Genève</div>
              </div>
            </div>
          </div>

          <Article title="Article 1 — Objet du mandat">
            Le Mandant confie au Mandataire le mandat {isRent ? 'de mise en location' : 'exclusif de vente'} du
            bien immobilier sis à <strong>{d.address}, {d.npa} {d.city}</strong> ({d.surface} m²),
            désigné ci-après « le Bien ».
          </Article>

          <Article title={`Article 2 — ${isRent ? 'Loyer' : 'Prix'} de référence`}>
            Sur la base de l'estimation transmise au Mandant, le {isRent ? 'loyer mensuel' : 'prix de vente'} de
            référence est fixé à <strong>{fmt(e.mid || 0)}{isRent ? ' /mois' : ''}</strong> (fourchette acceptée :
            {' '}{fmt(e.low || 0)} – {fmt(e.high || 0)}).
          </Article>

          <Article title="Article 3 — Gratuité du service">
            Le présent mandat est conclu <strong>à titre entièrement gratuit pour le Mandant</strong>. Aucune
            commission, aucun honoraire, aucun frais de quelque nature que ce soit n'est dû par le Mandant au
            Mandataire, ni avant, ni pendant, ni après la {isRent ? 'conclusion du bail' : 'conclusion de la vente'}.
            La rémunération du Mandataire est assurée exclusivement par MEGGA dans le cadre d'un accord commercial
            distinct, sans incidence sur les conditions financières offertes au Mandant.
          </Article>

          <Article title="Article 4 — Durée">
            Le présent mandat est conclu pour une durée de <strong>{durationMonths} mois</strong> à compter de la
            date de signature ({today}), renouvelable par tacite reconduction de 3 mois. Résiliable à tout moment
            moyennant un préavis écrit de 30 jours.
          </Article>

          <Article title="Article 5 — Engagements du Mandataire">
            Le Mandataire s'engage à : (a) réaliser un reportage photographique professionnel,
            (b) rédiger l'annonce et la diffuser sur MEGGA et les portails partenaires,
            (c) qualifier les acquéreurs/locataires,
            (d) organiser et accompagner les visites,
            (e) négocier au mieux des intérêts du Mandant,
            (f) rendre compte mensuellement de l'activité.
          </Article>

          <Article title="Article 6 — Signature électronique">
            Les parties conviennent que la signature du présent mandat s'opère par signature électronique
            qualifiée (SEQ) au sens de la loi fédérale sur la signature électronique (SCSE), via le service
            certifié <strong>Swisscom Sign</strong>. Cette signature a la même valeur juridique qu'une signature
            manuscrite (art. 14 al. 2bis CO).
          </Article>

          <div
            style={{
              marginTop: 22, paddingTop: 14, borderTop: `1px dashed ${M.border}`,
              fontSize: 10, color: M.muted, textAlign: 'center',
            }}
          >
            — Page 1 sur 4 — Faites défiler pour lire la suite —
          </div>
        </div>
      </div>

      {/* Accept terms */}
      <label
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 16px', borderRadius: 12,
          border: `1.5px solid ${accepted ? BLUE : M.border}`,
          background: accepted ? BLUE_SOFT : '#fff',
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={e => setAccepted(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 1, accentColor: BLUE, cursor: 'pointer', flex: '0 0 auto' }}
        />
        <div style={{ fontFamily: FF, fontSize: 12.5, color: M.ink, lineHeight: 1.5 }}>
          J'ai lu et j'accepte les termes du <strong>mandat de courtage{' '}
          {isRent ? 'pour location' : 'exclusif de vente'}</strong> ci-dessus. Je confirme que ce service est{' '}
          <strong>entièrement gratuit</strong> pour moi en tant que mandant. Je consens à signer électroniquement
          ce document via Swisscom Sign.
        </div>
      </label>
    </div>
  )
}

function Article({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  )
}

// ─── Step 2 — Identification (SMS OTP) ───────────────────────────────────

interface Step2Props {
  listing: MandateListing
  otpSent: boolean
  otpCode: string
  setOtpCode: (v: string) => void
  otpError: boolean
  resendIn: number
  onResend: () => void
}

function MSStep2Identify({ listing, otpSent, otpCode, setOtpCode, otpError, resendIn, onResend }: Step2Props) {
  const d = listing.dossier
  const phone = d.phone || '+41 79 ••• •• 47'
  const masked = phone.replace(/(\+41\s?\d{2})\s?\d{3}\s?\d{2}\s?(\d{2})/, '$1 ••• •• $2')
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (otpSent && inputsRef.current[0]) {
      setTimeout(() => inputsRef.current[0]?.focus(), 100)
    }
  }, [otpSent])

  const updateDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const next = otpCode.split('')
    while (next.length < 6) next.push('')
    next[i] = v
    setOtpCode(next.join('').slice(0, 6))
    if (v && i < 5) inputsRef.current[i + 1]?.focus()
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[i] && i > 0) inputsRef.current[i - 1]?.focus()
  }

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const txt = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    if (txt) setOtpCode(txt)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Swisscom Sign branded card */}
      <div
        style={{
          padding: '20px 22px', borderRadius: 14,
          background: 'linear-gradient(135deg, #fff 0%, #FAFBFD 100%)',
          border: `1px solid ${M.border}`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <div
          style={{
            width: 52, height: 52, borderRadius: 12,
            background: '#0019A0', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: M.ink, letterSpacing: -0.2 }}>
              Swisscom Sign
            </div>
            <span
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
                padding: '3px 7px', borderRadius: 5, background: '#0019A0', color: '#fff',
              }}
            >
              QES
            </span>
          </div>
          <div style={{ fontFamily: FF, fontSize: 12, color: M.muted, lineHeight: 1.4 }}>
            Signature électronique qualifiée certifiée selon SCSE — équivalente à une signature manuscrite.
          </div>
        </div>
      </div>

      {/* Phone display */}
      <div>
        <div
          style={{
            fontFamily: FF, fontSize: 11, fontWeight: 700, color: M.muted,
            textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
          }}
        >
          Numéro de téléphone vérifié
        </div>
        <div
          style={{
            padding: '14px 16px', borderRadius: 12,
            border: `1px solid ${M.border}`, background: '#fff',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div
            style={{
              width: 32, height: 32, borderRadius: 8, background: M.section,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: M.ink,
            }}
          >
            {MSIcon.phone}
          </div>
          <div
            style={{
              fontFamily: FF, fontSize: 15, fontWeight: 700, color: M.ink,
              letterSpacing: -0.2, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {masked}
          </div>
          <span
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: FF, fontSize: 11, fontWeight: 700, color: BLUE,
            }}
          >
            {MSIcon.shield} Certifié
          </span>
        </div>
      </div>

      {/* OTP zone */}
      {!otpSent ? (
        <div
          style={{
            padding: '18px 18px', borderRadius: 12,
            background: M.section,
            fontFamily: FF, fontSize: 12.5, color: M.soft, lineHeight: 1.5,
          }}
        >
          Cliquez sur <strong style={{ color: M.ink }}>« Envoyer le code »</strong> pour recevoir un code de
          vérification à 6 chiffres par SMS. Cette étape valide votre identité auprès de l'autorité de
          certification suisse.
        </div>
      ) : (
        <div>
          <div
            style={{
              fontFamily: FF, fontSize: 11, fontWeight: 700, color: M.muted,
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
            }}
          >
            Code de vérification
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <input
                key={i}
                ref={el => { inputsRef.current[i] = el }}
                type="text" inputMode="numeric" maxLength={1}
                value={otpCode[i] || ''}
                onChange={e => updateDigit(i, e.target.value)}
                onKeyDown={e => onKeyDown(i, e)}
                onPaste={onPaste}
                style={{
                  flex: 1, height: 56,
                  borderRadius: 10,
                  border: `1.5px solid ${otpError ? RED : otpCode[i] ? M.ink : M.border}`,
                  background: '#fff',
                  fontFamily: FF, fontSize: 24, fontWeight: 700, color: M.ink,
                  textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                  outline: 'none', transition: 'border-color 0.15s ease',
                }}
              />
            ))}
          </div>
          {otpError && (
            <div style={{ fontFamily: FF, fontSize: 12, color: RED, marginTop: 8 }}>
              Code invalide. Vérifiez les chiffres reçus par SMS.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontFamily: FF, fontSize: 11.5, color: M.muted }}>
              Code envoyé au {masked}
            </span>
            {resendIn > 0 ? (
              <span style={{ fontFamily: FF, fontSize: 11.5, color: M.muted, fontVariantNumeric: 'tabular-nums' }}>
                Renvoyer dans {resendIn}s
              </span>
            ) : (
              <button
                onClick={onResend}
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  fontFamily: FF, fontSize: 11.5, fontWeight: 700, color: BLUE,
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Renvoyer le code
              </button>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          fontFamily: FF, fontSize: 11, color: M.muted,
          lineHeight: 1.5, textAlign: 'center',
        }}
      >
        Pour modifier votre numéro, contactez votre agent dans la messagerie.
      </div>
    </div>
  )
}

// ─── Step 3 — Sign + Success ─────────────────────────────────────────────

function MSStep3Sign({ listing, signing, signed }: { listing: MandateListing; signing: boolean; signed: boolean }) {
  const d = listing.dossier
  const fileName = `Mandat_${d.address.replace(/[^A-Za-z0-9]/g, '_').slice(0, 20)}_signe.pdf`
  const signedAt = signed
    ? new Date().toLocaleString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null
  const txId = useMemo(() => `SC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, [])

  if (signing) {
    return (
      <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${M.border}` }} />
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid transparent', borderTopColor: BLUE,
              animation: 'msSpin 0.9s linear infinite',
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: BLUE,
            }}
          >
            {MSIcon.sign}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FF, fontSize: 18, fontWeight: 700, color: M.ink,
              letterSpacing: -0.3, marginBottom: 6,
            }}
          >
            Application de la signature qualifiée…
          </div>
          <div
            style={{
              fontFamily: FF, fontSize: 13, color: M.muted, lineHeight: 1.5,
              maxWidth: 380, margin: '0 auto',
            }}
          >
            Swisscom Sign appose votre certificat numérique et l'horodatage légal sur le mandat. Cela prend
            quelques secondes.
          </div>
        </div>
      </div>
    )
  }

  // Success
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: BLUE, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <svg width="30" height="30" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l3.5 3.5L13 5" />
          </svg>
        </div>
        <div
          style={{
            fontFamily: FF, fontSize: 22, fontWeight: 700, color: M.ink,
            letterSpacing: -0.4, marginBottom: 6,
          }}
        >
          Mandat signé électroniquement
        </div>
        <div
          style={{
            fontFamily: FF, fontSize: 13, color: M.muted, lineHeight: 1.5,
            maxWidth: 420, margin: '0 auto',
          }}
        >
          Votre signature qualifiée a été appliquée avec succès. Le document a la même valeur juridique qu'une
          signature manuscrite.
        </div>
      </div>

      <div style={{ border: `1px solid ${M.border}`, borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        <div
          style={{
            padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: `1px solid ${M.border}`,
          }}
        >
          <div
            style={{
              width: 40, height: 40, borderRadius: 9, background: BLUE_SOFT, color: BLUE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {MSIcon.doc}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: M.ink, letterSpacing: -0.1 }}>
              {fileName}
            </div>
            <div
              style={{
                fontFamily: FF, fontSize: 11, color: M.muted,
                marginTop: 2, fontVariantNumeric: 'tabular-nums',
              }}
            >
              Signé le {signedAt} · 4 pages · 192 Ko
            </div>
          </div>
          <button
            style={{
              height: 36, padding: '0 14px', borderRadius: 8,
              background: M.ink, color: '#fff', border: 'none',
              fontFamily: FF, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {MSIcon.download} Télécharger
          </button>
        </div>

        <div style={{ padding: '14px 18px', background: '#FAFBFD', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <SignMeta label="Signataire" value={`${d.firstName} ${d.lastName}`} />
          <SignMeta label="Autorité de certification" value="Swisscom (Schweiz) AG" />
          <SignMeta label="Type de signature" value="QES — Qualifiée (SCSE)" />
          <SignMeta label="Identifiant transaction" value={txId} mono />
        </div>
      </div>

      <div
        style={{
          padding: '12px 14px', borderRadius: 10,
          background: BLUE_SOFT, color: BLUE,
          fontFamily: FF, fontSize: 12, lineHeight: 1.5,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}
      >
        <span style={{ flex: '0 0 auto', marginTop: 1 }}>{MSIcon.shield}</span>
        <span>
          Une copie du mandat signé a été envoyée à votre adresse email et à votre agent. L'annonce sera mise
          en ligne dans les prochains jours.
        </span>
      </div>
    </div>
  )
}

function SignMeta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontFamily: FF, fontSize: 9.5, color: M.muted, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FF, fontSize: 12, fontWeight: 700, color: M.ink,
          fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ─── Main shell ──────────────────────────────────────────────────────────

export interface MandateSignModalProps {
  listing: MandateListing
  open: boolean
  onClose: () => void
  /** Callback déclenché après signature finale réussie (avant le « Voir mes annonces » final) */
  onSigned?: (listingId: string) => void
}

export function MandateSignModal({ listing, open, onClose, onSigned }: MandateSignModalProps) {
  const [step, setStep] = useState(1)
  const [accepted, setAccepted] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1); setAccepted(false); setOtpSent(false); setOtpCode('')
      setOtpError(false); setResendIn(0); setSigning(false); setSigned(false)
    }
  }, [open])

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !signing) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, signing, onClose])

  if (!open) return null

  const sendOtp = () => {
    setOtpSent(true); setOtpCode(''); setOtpError(false); setResendIn(30)
  }

  const goNext = () => {
    if (step === 1) {
      if (!accepted) return
      setStep(2)
      setTimeout(() => sendOtp(), 200)
    } else if (step === 2) {
      if (otpCode.length !== 6) {
        setOtpError(true)
        return
      }
      setStep(3)
      setSigning(true)
      setTimeout(() => {
        setSigning(false)
        setSigned(true)
        onSigned?.(listing.id)
      }, 2400)
    }
  }

  const goBack = () => {
    if (step === 1) onClose()
    else if (step === 2) setStep(1)
  }

  const primaryDisabled = (step === 1 && !accepted) || (step === 2 && !otpSent)
  const primaryLabel =
    step === 1 ? 'Continuer vers la signature'
    : step === 2 ? (otpSent ? 'Valider et signer' : 'Envoyer le code SMS')
    : 'Voir mes annonces'

  const onPrimary = () => {
    if (step === 2 && !otpSent) { sendOtp(); return }
    if (step === 3) { onClose(); return }
    goNext()
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(14,20,16,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={() => { if (!signing) onClose() }}
    >
      <style>{`@keyframes msSpin { to { transform: rotate(360deg); } }`}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 680, maxHeight: '92vh',
          background: '#fff', borderRadius: 22,
          boxShadow: '0 24px 80px -20px rgba(14,20,16,0.45)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 32px 0',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
                  padding: '4px 9px', borderRadius: 5,
                  background: BLUE_SOFT, color: BLUE,
                }}
              >
                Signature électronique
              </span>
            </div>
            <div style={{ fontFamily: FF, fontSize: 22, fontWeight: 700, color: M.ink, letterSpacing: -0.5 }}>
              {step === 3 && signed ? 'Mandat signé' : 'Signer le mandat de courtage'}
            </div>
            <div style={{ fontFamily: FF, fontSize: 13, color: M.muted, marginTop: 4, letterSpacing: -0.1 }}>
              {listing.dossier.address}, {listing.dossier.city}
            </div>
          </div>
          {!signing && (
            <button
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: 999,
                background: M.section, border: 'none', color: M.ink,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              {MSIcon.close}
            </button>
          )}
        </div>

        <div style={{ padding: '20px 32px 0' }}>
          <MSStepper step={step} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 32px 28px' }}>
          {step === 1 && <MSStep1Review listing={listing} accepted={accepted} setAccepted={setAccepted} />}
          {step === 2 && (
            <MSStep2Identify
              listing={listing}
              otpSent={otpSent}
              otpCode={otpCode}
              setOtpCode={v => { setOtpCode(v); setOtpError(false) }}
              otpError={otpError}
              resendIn={resendIn}
              onResend={sendOtp}
            />
          )}
          {step === 3 && <MSStep3Sign listing={listing} signing={signing} signed={signed} />}
        </div>

        {!signing && (
          <div
            style={{
              padding: '16px 32px 22px', borderTop: `1px solid ${M.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              background: '#FAFBFD',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: FF, fontSize: 11.5, color: M.muted,
              }}
            >
              <span style={{ color: BLUE }}>{MSIcon.shield}</span>
              Sécurisé par Swisscom Sign · QES
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {step < 3 && (
                <button
                  onClick={goBack}
                  style={{
                    height: 44, padding: '0 18px', borderRadius: 999,
                    background: '#fff', color: M.ink, border: `1px solid ${M.border}`,
                    fontFamily: FF, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {MSIcon.arrowBack}
                  {step === 1 ? 'Annuler' : 'Précédent'}
                </button>
              )}
              <button
                onClick={onPrimary}
                disabled={primaryDisabled}
                style={{
                  height: 44, padding: '0 22px', borderRadius: 999,
                  background: primaryDisabled ? '#C8CDD5' : BLUE,
                  color: '#fff', border: 'none',
                  fontFamily: FF, fontSize: 13, fontWeight: 700,
                  cursor: primaryDisabled ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.15s ease',
                }}
              >
                {primaryLabel}
                {!primaryDisabled && step !== 3 && MSIcon.arrow}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
