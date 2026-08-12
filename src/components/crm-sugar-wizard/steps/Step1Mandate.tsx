// MEGGA CRM Sugar v2 Wizard — Step 1b : Mandat
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step1.jsx — `SgStepMandate`).

import { Trans, useTranslation } from 'react-i18next'
import { SugarV2, sgOn, sgAcc, type WizardData } from '../tokens'
import { crmContactById } from '@/components/crm-sugar/mockData'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

export function Step1Mandate({ data, set }: StepProps) {
  // `t` est déjà utilisé localement (const t = TYPES.find…) → alias `tr`.
  const { t: tr } = useTranslation('listings')
  const m = data.mandate
  const setM = (patch: Partial<typeof m>) => set({ mandate: { ...m, ...patch } })



  const TYPES = [
    { v: 'exclusive' as const, title: tr('wizard.step1.mandate.type.exclusive.title'),
      sub: tr('wizard.step1.mandate.type.exclusive.sub'),
      hint: tr('wizard.step1.mandate.recommended'), defaultCom: 3.5 },
    { v: 'simple' as const, title: tr('wizard.step1.mandate.type.simple.title'),
      sub: tr('wizard.step1.mandate.type.simple.sub'),
      hint: null, defaultCom: 3.0 },
    { v: 'co' as const, title: tr('wizard.step1.mandate.type.co.title'),
      sub: tr('wizard.step1.mandate.type.co.sub'),
      hint: null, defaultCom: 4.0 },
  ]

  const choose = (v: 'exclusive' | 'simple' | 'co') => {
    const t = TYPES.find(x => x.v === v)!
    setM({ type: v, commission: t.defaultCom })
  }

  // Brouillon inline → snapshot du vendeur existant (figé) → fallback registry.
  const linkedOwner = data.ownerContactId
    ? (data._newContact ?? data._ownerContact ?? crmContactById(data.ownerContactId))
    : null

  return (
    <div style={{ maxWidth: 980, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      {/* Header */}
      <div style={{ marginBottom: 28, maxWidth: 720 }}>
        <h1 style={{
          margin: 0, fontSize: 'var(--crm-text-9xl)', fontWeight: 500,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{tr('wizard.step1.mandate.title')}</h1>
        {/* Le sous-titre « MEGGA AI a extrait les informations de votre mandat »
            part avec l'import : plus rien n'extrait, donc plus rien à vérifier.
            Il était le seul sous-titre gardé du wizard, précisément parce qu'il
            signalait des champs remplis par une machine. */}

        {linkedOwner && (
          <div style={{
            marginTop: 18,
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
            padding: 'var(--crm-space-md) var(--crm-space-md) var(--crm-space-md) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
            background: SugarV2.card, boxShadow: SugarV2.shadowSm,
            animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 'var(--crm-radius-pill)',
              background: linkedOwner.avatarBg || '#3B82F6',
              color: sgOn(), display: 'grid', placeItems: 'center',
              fontSize: 'var(--crm-text-xs)', fontWeight: 600, flexShrink: 0,
            }}>{(linkedOwner.firstName?.[0] || '') + (linkedOwner.lastName?.[0] || '')}</div>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SugarV2.ink }}>
              {tr('wizard.forOwner', { name: `${linkedOwner.firstName} ${linkedOwner.lastName}` })}
            </span>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: SugarV2.muted }}>
              · {data.fromSubmissionId ? tr('wizard.ownerVia.submission') : tr('wizard.ownerVia.linked')}
            </span>
          </div>
        )}
      </div>

      {/* 3 TUILES + PARAMÈTRES
          ⛔ L'IMPORT DE MANDAT PAR PDF A ÉTÉ RETIRÉ le 12 août 2026. Il ne
          lisait aucun PDF : il jouait une animation d'extraction puis appliquait
          six valeurs ÉCRITES EN DUR — mandat exclusif, 6 mois, 3,5 %, à charge
          du vendeur, « signé le 14 mars 2026 », vendeur « Jean-Marc Aebischer » —
          affichées à côté du VRAI nom du fichier déposé par l'agent. À la
          publication, `wizardPayload` porte `mandate_type`,
          `mandate_commission_pct` et `mandate_signed_at` dans `properties` : la
          fabrication atteignait la base.

          C'est exactement ce que l'étape 0 refuse depuis toujours — sa porte
          « Importer un mandat » est désactivée avec ce motif écrit dans son
          en-tête. La porte honnête était fermée, celle qui fabriquait ouverte.

          ⚠ NE PAS LE « RÉTABLIR » EN BRANCHANT `extract-property-pdf` TEL QUEL :
          cette fonction extrait le BIEN (prix, pièces, adresse) et `mandate_type`,
          mais ni la commission, ni la durée, ni les honoraires, ni la date de
          signature — cinq des six champs que le mock inventait. La brancher
          demande de décider ce qu'on fait des champs qu'elle ne rend pas.

          Le séparateur « ou configurez à la main » part avec l'import : il ne
          séparait plus de rien. */}
      <>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--crm-space-4xl)', marginBottom: 32,
          }}>
            {TYPES.map(t => {
              const sel = m.type === t.v
              return (
                <button key={t.v} onClick={() => choose(t.v)}
                  style={{
                    position: 'relative',
                    padding: '26px 22px', borderRadius: 'var(--crm-radius-5xl)',
                    background: sel ? SugarV2.black : SugarV2.card,
                    color: sel ? sgOn() : SugarV2.ink,
                    border: 0, fontFamily: 'inherit', textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: sel
                      ? '0 20px 48px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.15)'
                      : SugarV2.shadow,
                    transform: sel ? 'translateY(-2px)' : 'translateY(0)',
                    transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
                    display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)',
                  }}>
                  {t.hint && (
                    <span style={{
                      position: 'absolute', top: 16, right: 16,
                      padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)',
                      background: sel ? sgAcc(0.15) : SugarV2.cardSubtle,
                      color: sel ? sgOn() : SugarV2.inkSoft,
                      fontSize: 'var(--crm-text-xs)', fontWeight: 600,
                    }}>{t.hint}</span>
                  )}
                  <h3 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.3 }}>{t.title}</h3>
                  <p style={{
                    margin: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.5,
                    color: sel ? sgAcc(0.75) : SugarV2.inkSoft,
                  }}>{t.sub}</p>
                  <div style={{
                    marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 'var(--crm-text-md)', fontWeight: 600,
                    color: sel ? sgAcc(0.6) : SugarV2.muted,
                  }}>
                    <span>{tr('wizard.step1.mandate.proposedCommission')}</span>
                    <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sel ? sgOn() : SugarV2.ink }}>{t.defaultCom}%</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Paramètres détaillés */}
          {m.type && (
            <div style={{
              background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)', padding: 28,
              boxShadow: SugarV2.shadow,
              animation: 'sgScaleIn .4s cubic-bezier(.2,.8,.2,1) both',
            }}>
              <div style={{ marginBottom: 22 }}>
                <div style={{
                  fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted,
                  marginBottom: 6,
                }}>{tr('wizard.step1.mandate.settings')}</div>
                <h3 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: SugarV2.ink, letterSpacing: -0.3 }}>
                  {tr('wizard.step1.mandate.settingsTitle')}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 'var(--crm-space-6xl)' }}>
                {/* Durée */}
                <div>
                  <div style={{
                    fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted,
                    marginBottom: 12,
                  }}>{tr('wizard.step1.mandate.field.duration')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
                    {[3, 6, 9, 12].map(d => (
                      <button key={d} onClick={() => setM({ duration: d })} style={{
                        height: 40, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                        background: m.duration === d ? SugarV2.black : SugarV2.cardSubtle,
                        color: m.duration === d ? sgOn() : SugarV2.inkSoft,
                        fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
                        boxShadow: m.duration === d ? '0 4px 12px rgba(0,0,0,0.18)' : 'none',
                        transition: 'all .18s ease',
                      }}>{tr('wizard.step1.mandate.months', { count: d })}</button>
                    ))}
                  </div>
                </div>

                {/* Commission */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{
                      fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted,
                    }}>{tr('wizard.step1.mandate.field.commission')}</span>
                    <span style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: SugarV2.ink, letterSpacing: -0.3 }}>
                      {m.commission.toFixed(1)}%
                    </span>
                  </div>
                  <input type="range" min="2" max="6" step="0.1" value={m.commission}
                    onChange={e => setM({ commission: parseFloat(e.target.value) })}
                    className="sg-range"
                    style={{
                      width: '100%', appearance: 'none', WebkitAppearance: 'none',
                      height: 4, borderRadius: 'var(--crm-radius-pill)',
                      background: `linear-gradient(to right, ${SugarV2.black} 0%, ${SugarV2.black} ${((m.commission - 2) / 4) * 100}%, ${SugarV2.cardSubtle} ${((m.commission - 2) / 4) * 100}%, ${SugarV2.cardSubtle} 100%)`,
                      outline: 'none',
                    }} />
                </div>

                {/* Honoraires */}
                <div>
                  <div style={{
                    fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted,
                    marginBottom: 12,
                  }}>{tr('wizard.step1.mandate.field.fees')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
                    {[
                      { v: 'owner' as const, l: tr('wizard.step1.mandate.feesOwner') },
                      { v: 'buyer' as const, l: tr('wizard.step1.mandate.feesBuyer') },
                    ].map(o => (
                      <button key={o.v} onClick={() => setM({ fees: o.v })} style={{
                        height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)', border: 0,
                        background: m.fees === o.v ? SugarV2.black : SugarV2.cardSubtle,
                        color: m.fees === o.v ? sgOn() : SugarV2.inkSoft,
                        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all .15s',
                      }}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Récap commission */}
              <div style={{
                marginTop: 24, padding: 'var(--crm-space-3xl) var(--crm-space-5xl)', borderRadius: 'var(--crm-radius-2xl)',
                background: SugarV2.cardSubtle,
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--crm-radius-md)',
                  background: SugarV2.card,
                  display: 'grid', placeItems: 'center',
                  boxShadow: SugarV2.shadowSm,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SugarV2.ink} strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <div style={{ fontSize: 'var(--crm-text-lg)', color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
                  <Trans
                    t={tr}
                    i18nKey="wizard.step1.mandate.commissionExample"
                    values={{
                      amount: `${Math.round(1500000 * m.commission / 100).toLocaleString('fr-CH').replace(/,/g, "'")} CHF`,
                      party: m.fees === 'owner' ? tr('wizard.step1.mandate.feesOwnerInline') : tr('wizard.step1.mandate.feesBuyerInline'),
                    }}
                    components={{
                      base: <span style={{ color: SugarV2.ink, fontWeight: 600 }} />,
                      amountStrong: <span style={{ color: SugarV2.ink, fontWeight: 600 }} />,
                    }}
                  />
                </div>
              </div>

              {/* Statut signature */}
              <div style={{
                marginTop: 14, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
                padding: 'var(--crm-space-xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-xl)',
                background: m.signed ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)',
                  background: m.signed ? SugarV2.ok : SugarV2.warn,
                }} />
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SugarV2.inkSoft, flex: 1 }}>
                  {m.signed
                    ? tr('wizard.step1.mandate.signedNote')
                    : tr('wizard.step1.mandate.notSignedNote')}
                </span>
                <button onClick={() => setM({ signed: !m.signed })} style={{
                  height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                  background: m.signed ? SugarV2.cardSubtle : SugarV2.black,
                  color: m.signed ? SugarV2.inkSoft : sgOn(),
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
                }}>
                  {m.signed ? tr('wizard.step1.mandate.markUnsigned') : tr('wizard.step1.mandate.markSigned')}
                </button>
              </div>
            </div>
          )}
      </>
    </div>
  )
}
