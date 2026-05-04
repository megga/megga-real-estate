// MEGGA CRM Sugar v2 — KYC Wizard modal (Tier 4 — VariationA)
// 1:1 port from `megga-kyc-variations.jsx` VariationA (lines 129-365).
// Modal stepper 5 étapes (Contexte / Identité / Origine fonds / Screening / Validation).
// Le proto rend visuellement uniquement le contenu de l'étape Identité — les autres
// étapes sont représentées par un placeholder card "à compléter".

import { Fragment, useState } from 'react'
import { createPortal } from 'react-dom'
import { BlackBtn, GhostBtn, KycIcon, SectionLabel, SP } from './atoms'

const STEPS = ['Contexte', 'Identité', 'Origine fonds', 'Screening', 'Validation']

interface IdentityField {
  l: string
  v: string
  select?: boolean
  multi?: boolean
}

const IDENTITY_FIELDS: IdentityField[] = [
  { l: 'Nom de famille', v: 'Schmidt' },
  { l: 'Prénom(s)', v: 'Élodie Marie' },
  { l: 'Date de naissance', v: '14.03.1981' },
  { l: 'Nationalité(s)', v: 'Suisse · Française', multi: true },
  { l: 'Type de document', v: 'Passeport', select: true },
  { l: 'Numéro de document', v: 'X1234567' },
  { l: "Date d'expiration", v: '22.09.2031' },
  { l: 'Pays émetteur', v: 'Suisse', select: true },
]

interface VisualCheck {
  l: string
  on: boolean
}

const VISUAL_CHECKS: VisualCheck[] = [
  { l: 'Document officiel et non périmé', on: true },
  { l: 'Photo correspond à la personne', on: true },
  { l: 'Numéro de document lisible', on: true },
  { l: "Pas de signe d'altération", on: true },
  { l: 'Données saisies cohérentes avec le document', on: false },
]

interface VerifMethod {
  k: string
  label: string
  sub: string
}

const VERIF_METHODS: VerifMethod[] = [
  { k: 'person', label: 'En personne', sub: 'Au bureau' },
  { k: 'video', label: 'Visioconférence', sub: 'Lien sécurisé' },
  { k: 'lawyer', label: 'Attestation avocat / notaire', sub: 'Joindre attestation' },
]

const STEP_KICKERS: Record<number, string> = {
  0: 'Étape 1 sur 5 · LBA art. 3 — Contexte de la relation',
  1: 'Étape 2 sur 5 · LBA art. 3 — Identification du cocontractant',
  2: "Étape 3 sur 5 · LBA art. 4 — Origine des fonds",
  3: 'Étape 4 sur 5 · LBA art. 4 — Screening PEP & sanctions',
  4: "Étape 5 sur 5 · LBA — Validation conformité",
}

const STEP_TITLES: Record<number, string> = {
  0: 'Contexte — Élodie Schmidt',
  1: 'Identité — Élodie Schmidt',
  2: 'Origine des fonds — Élodie Schmidt',
  3: 'Screening PEP & sanctions',
  4: 'Validation finale du dossier',
}

const STEP_SUBS: Record<number, string> = {
  0: 'Précisez le contexte de la relation : type de transaction, lien préexistant, et les indicateurs de risque pertinents.',
  1: "Saisissez les données du document officiel et confirmez la vérification visuelle. Le screening sanctions/PEP est lancé en arrière-plan via Dilisense.",
  2: "Documentez l'origine des fonds (épargne, vente, héritage…) avec une attestation officielle.",
  3: 'Vérifiez les correspondances PEP et sanctions récupérées via les 4 sources interrogées.',
  4: 'Validation finale par le responsable conformité avant clôture du dossier.',
}

interface KycWizardModalProps {
  onClose: () => void
}

export function KycWizardModal({ onClose }: KycWizardModalProps) {
  const [step, setStep] = useState(1)
  const [methodKey, setMethodKey] = useState('person')
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(VISUAL_CHECKS.map(c => [c.l, c.on])),
  )

  const goBack = () => setStep(s => Math.max(0, s - 1))
  const goNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else onClose()
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(11,12,14,0.40)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        animation: 'kycFadeIn .25s ease both',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes kycFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes kycScaleIn { from { opacity: 0; transform: scale(.97) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 980,
          maxHeight: '92vh',
          background: SP.surface,
          borderRadius: 28,
          boxShadow: SP.shadowLg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'kycScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
          fontFamily: SP.font,
          color: SP.ink,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 30px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexShrink: 0,
          }}
        >
          <button
            onClick={goBack}
            disabled={step === 0}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: 0,
              background: SP.cardSubtle,
              color: SP.ink,
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.4 : 1,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <KycIcon name="chev" size={16} sw={2} />
          </button>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
            }}
          >
            {STEPS.map((s, i) => (
              <Fragment key={s}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: i <= step ? SP.black : SP.cardSubtle,
                      color: i <= step ? '#fff' : SP.muted,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      boxShadow: i === step ? '0 0 0 4px rgba(11,12,14,0.08)' : 'none',
                      transition: 'all .2s ease',
                    }}
                  >
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: i <= step ? SP.ink : SP.muted,
                      transition: 'color .2s ease',
                    }}
                  >
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      width: 24,
                      height: 2,
                      margin: '0 12px',
                      background: i < step ? SP.black : SP.cardSubtle,
                      transition: 'background .2s ease',
                    }}
                  />
                )}
              </Fragment>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: 0,
              background: SP.cardSubtle,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: SP.inkSoft,
            }}
          >
            <KycIcon name="x" size={16} sw={2} />
          </button>
        </div>

        {/* Title */}
        <div style={{ padding: '6px 30px 18px', flexShrink: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '.09em',
              textTransform: 'uppercase',
              color: SP.muted,
              marginBottom: 8,
            }}
          >
            {STEP_KICKERS[step]}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.6,
              lineHeight: 1.15,
            }}
          >
            {STEP_TITLES[step]}
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: SP.inkSoft,
              marginTop: 6,
              lineHeight: 1.5,
              maxWidth: 640,
            }}
          >
            {STEP_SUBS[step]}
          </div>
        </div>

        {/* Body — 2 colonnes */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 24,
            padding: '0 30px 18px',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflow: 'auto',
              paddingRight: 6,
            }}
          >
            {step === 1 ? (
              <IdentityStepBody
                methodKey={methodKey}
                onMethodChange={setMethodKey}
                checks={checks}
                onCheckToggle={l =>
                  setChecks(c => ({ ...c, [l]: !c[l] }))
                }
              />
            ) : (
              <PlaceholderStepBody />
            )}
          </div>

          {/* Side — AI assist */}
          <aside
            style={{
              background: SP.cardSubtle,
              borderRadius: 18,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: SP.ink,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <KycIcon name="spark" size={14} stroke="#fff" sw={2.2} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>MEGGA AI</div>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: SP.inkSoft,
                lineHeight: 1.55,
              }}
            >
              Les données saisies sont{' '}
              <strong style={{ color: SP.ink }}>cohérentes</strong> avec la fiche
              contact. Pour ce profil, une vérification en personne est généralement
              suffisante.
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: SP.muted,
                  marginTop: 4,
                }}
              >
                Screening Dilisense
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: SP.pending,
                  }}
                />
                <div style={{ fontSize: 12, color: SP.inkSoft }}>
                  En cours · 4 sources interrogées
                </div>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: '#fff',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '62%',
                    height: '100%',
                    background: SP.pending,
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: SP.muted,
                  lineHeight: 1.5,
                  marginTop: 4,
                }}
              >
                Lancé automatiquement à la saisie. Résultats à l'étape Screening.
              </div>
            </div>
            <div
              style={{
                marginTop: 'auto',
                padding: '12px 14px',
                borderRadius: 12,
                background: SP.surface,
                boxShadow: SP.shadowSm,
              }}
            >
              <div
                style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}
              >
                Conseil conformité
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: SP.muted,
                  lineHeight: 1.5,
                }}
              >
                Pensez à scanner aussi le verso si CI suisse — le numéro de document
                figure au dos.
              </div>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 30px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <GhostBtn onClick={goBack}>← Retour</GhostBtn>
          <div style={{ flex: 1 }} />
          <GhostBtn>Enregistrer brouillon</GhostBtn>
          <BlackBtn
            onClick={goNext}
            icon={
              step < STEPS.length - 1 ? (
                <KycIcon name="arrow" size={14} stroke="#fff" sw={2.2} />
              ) : (
                <KycIcon name="check" size={14} stroke="#fff" sw={2.4} />
              )
            }
          >
            {step < STEPS.length - 1 ? 'Étape suivante' : 'Terminer'}
          </BlackBtn>
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface IdentityStepBodyProps {
  methodKey: string
  onMethodChange: (k: string) => void
  checks: Record<string, boolean>
  onCheckToggle: (l: string) => void
}

function IdentityStepBody({
  methodKey,
  onMethodChange,
  checks,
  onCheckToggle,
}: IdentityStepBodyProps) {
  return (
    <>
      {/* Upload */}
      <SectionLabel>Document d'identité</SectionLabel>
      <div
        style={{
          padding: 18,
          borderRadius: 14,
          background: SP.cardSubtle,
          border: `2px dashed ${SP.ghost}`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: SP.surface,
            boxShadow: SP.shadowSm,
            display: 'grid',
            placeItems: 'center',
            color: SP.ink,
          }}
        >
          <KycIcon name="upload" size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            Glisser le passeport ou la carte d'identité
          </div>
          <div
            style={{ fontSize: 11.5, color: SP.muted, marginTop: 2 }}
          >
            PDF/JPG · 10 Mo max
          </div>
        </div>
        <GhostBtn
          style={{ height: 34, padding: '0 14px', fontSize: 12.5 }}
        >
          Parcourir
        </GhostBtn>
      </div>

      {/* Saisie manuelle */}
      <div style={{ height: 4 }} />
      <SectionLabel>Saisie manuelle</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {IDENTITY_FIELDS.map(f => (
          <div key={f.l}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: SP.muted,
                letterSpacing: '.05em',
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              {f.l}
            </div>
            <div
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 10,
                background: SP.surface,
                boxShadow: `0 0 0 1px ${SP.cardSubtle} inset`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12.5,
                fontWeight: 600,
                color: SP.ink,
              }}
            >
              <span>{f.v}</span>
              {(f.select || f.multi) && (
                <KycIcon name="chev" size={12} stroke={SP.muted} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Vérification visuelle */}
      <div style={{ height: 4 }} />
      <SectionLabel>Vérification visuelle</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {VISUAL_CHECKS.map(c => {
          const on = !!checks[c.l]
          return (
            <label
              key={c.l}
              onClick={() => onCheckToggle(c.l)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 10,
                background: on ? 'transparent' : SP.cardSubtle,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  background: on ? SP.ink : 'transparent',
                  boxShadow: on ? 'none' : `0 0 0 1.5px ${SP.ghost} inset`,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {on && <KycIcon name="check" size={11} stroke="#fff" sw={3} />}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: on ? SP.ink : SP.inkSoft,
                }}
              >
                {c.l}
              </div>
            </label>
          )
        })}
      </div>

      {/* Méthode de vérification */}
      <div style={{ height: 4 }} />
      <SectionLabel>Méthode de vérification</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
        }}
      >
        {VERIF_METHODS.map(o => {
          const on = methodKey === o.k
          return (
            <div
              key={o.k}
              onClick={() => onMethodChange(o.k)}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: on ? SP.surface : SP.cardSubtle,
                boxShadow: on
                  ? `0 0 0 2px ${SP.ink} inset, ${SP.shadowSm}`
                  : 'none',
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: on ? SP.ink : 'transparent',
                    boxShadow: on
                      ? 'none'
                      : `0 0 0 1.5px ${SP.ghost} inset`,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {on && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: '#fff',
                      }}
                    />
                  )}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{o.label}</div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: SP.muted,
                  marginTop: 4,
                  marginLeft: 24,
                }}
              >
                {o.sub}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function PlaceholderStepBody() {
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        padding: '40px 20px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: SP.cardSubtle,
            margin: '0 auto 16px',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <KycIcon name="lock" size={22} stroke={SP.muted} sw={1.8} />
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: SP.ink,
            marginBottom: 8,
          }}
        >
          Étape à compléter
        </div>
        <div
          style={{
            fontSize: 13,
            color: SP.muted,
            lineHeight: 1.55,
          }}
        >
          Le contenu de cette étape sera complété dans une prochaine itération du
          wizard.
        </div>
      </div>
    </div>
  )
}
