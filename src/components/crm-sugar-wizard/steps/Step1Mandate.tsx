// MEGGA CRM Sugar v2 Wizard — Step 1b : Mandat
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step1.jsx — `SgStepMandate`).

import { useState } from 'react'
import { SugarV2, sgOn, sgAcc, type WizardData } from '../tokens'
import { CRM_CONTACTS } from '@/components/crm-sugar/mockData'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

interface ExtractedField {
  key: string
  label: string
  value: string
  apply: () => void
}

export function Step1Mandate({ data, set }: StepProps) {
  const m = data.mandate
  const setM = (patch: Partial<typeof m>) => set({ mandate: { ...m, ...patch } })

  const [importMode, setImportMode] = useState<'manual' | 'uploading' | 'extracting' | 'imported'>(m.importedFile ? 'imported' : 'manual')
  const [fileName, setFileName] = useState<string>(m.importedFile || '')
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([])
  const [extractStep, setExtractStep] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const triggerFilePicker = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf'
    input.style.position = 'fixed'
    input.style.top = '-999px'
    input.style.left = '-999px'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.addEventListener('change', e => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (f) handleFile(f)
      document.body.removeChild(input)
    })
    input.click()
  }

  const MOCK_EXTRACTION: ExtractedField[] = [
    { key: 'type',       label: 'Type de mandat',     value: 'Mandat exclusif',         apply: () => setM({ type: 'exclusive', commission: 3.5 }) },
    { key: 'duration',   label: 'Durée',              value: '6 mois',                  apply: () => setM({ duration: 6 }) },
    { key: 'commission', label: 'Commission',         value: '3,5 %',                   apply: () => setM({ commission: 3.5 }) },
    { key: 'fees',       label: 'Honoraires',         value: 'À charge du vendeur',     apply: () => setM({ fees: 'owner' }) },
    { key: 'signedAt',   label: 'Date de signature',  value: '14 mars 2026',            apply: () => setM({ signed: true, signedAt: '2026-03-14' }) },
    { key: 'vendor',     label: 'Vendeur identifié',  value: 'Jean-Marc Aebischer',     apply: () => {} },
  ]

  const handleFile = (file: File) => {
    if (!file) return
    setFileName(file.name)
    setImportMode('uploading')
    setTimeout(() => {
      setImportMode('extracting')
      setExtractStep(0)
      MOCK_EXTRACTION.forEach((field, idx) => {
        setTimeout(() => {
          field.apply()
          setExtractedFields(prev => [...prev, field])
          setExtractStep(idx + 1)
          if (idx === MOCK_EXTRACTION.length - 1) {
            setTimeout(() => {
              setImportMode('imported')
              set({
                mandate: {
                  ...m, importedFile: file.name,
                  extractedFields: MOCK_EXTRACTION.map(f => ({ key: f.key, label: f.label, value: f.value })),
                  type: 'exclusive', duration: 6, commission: 3.5, fees: 'owner', signed: true, signedAt: '2026-03-14',
                },
              })
            }, 350)
          }
        }, 350 + idx * 280)
      })
    }, 400)
  }

  const cancelImport = () => {
    setImportMode('manual')
    setFileName('')
    setExtractedFields([])
    setExtractStep(0)
    set({ mandate: { ...m, importedFile: null, extractedFields: null } })
  }

  const TYPES = [
    { v: 'exclusive' as const, title: 'Mandat exclusif',
      sub: 'Vous êtes seul mandataire. Commission garantie, meilleur engagement.',
      hint: 'Recommandé', defaultCom: 3.5 },
    { v: 'simple' as const, title: 'Mandat simple',
      sub: 'Le vendeur peut mandater plusieurs agences. Commission au premier qui vend.',
      hint: null, defaultCom: 3.0 },
    { v: 'co' as const, title: 'Co-mandat',
      sub: 'Mandat partagé entre 2 agences. Commission à diviser selon entente.',
      hint: null, defaultCom: 4.0 },
  ]

  const choose = (v: 'exclusive' | 'simple' | 'co') => {
    const t = TYPES.find(x => x.v === v)!
    setM({ type: v, commission: t.defaultCom })
  }

  const allContacts = CRM_CONTACTS
  const linkedOwner = data.ownerContactId
    ? (allContacts.find(c => c.id === data.ownerContactId) || data._newContact)
    : null

  return (
    <div style={{ maxWidth: 980, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      {/* Header */}
      <div style={{ marginBottom: 28, maxWidth: 720 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>Étape 2 sur 8 · Mandat (2/2)</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>Quel type de mandat&nbsp;?</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {importMode === 'imported'
            ? 'MEGGA AI a extrait les informations de votre mandat. Vérifiez et ajustez si nécessaire.'
            : 'Importez un mandat signé pour gagner du temps, ou configurez-le manuellement.'}
        </p>

        {linkedOwner && (
          <div style={{
            marginTop: 18,
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '8px 8px 8px 14px', borderRadius: 999,
            background: SugarV2.card, boxShadow: SugarV2.shadowSm,
            animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 999,
              background: linkedOwner.avatarBg || '#3B82F6',
              color: sgOn(), display: 'grid', placeItems: 'center',
              fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>{(linkedOwner.firstName?.[0] || '') + (linkedOwner.lastName?.[0] || '')}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: SugarV2.ink }}>
              Pour {linkedOwner.firstName} {linkedOwner.lastName}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: SugarV2.muted }}>
              · {data.fromSubmissionId ? 'via soumission' : 'vendeur lié'}
            </span>
          </div>
        )}
      </div>

      {/* ZONE IMPORT */}
      {importMode === 'manual' && (
        <div
          onClick={triggerFilePicker}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          style={{
            background: dragOver ? sgOn() : SugarV2.card,
            borderRadius: 24, padding: '28px 32px',
            boxShadow: dragOver ? `0 0 0 2px ${SugarV2.black}, 0 24px 60px rgba(0,0,0,0.18)` : SugarV2.shadow,
            marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 22,
            transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
            transform: dragOver ? 'scale(1.01)' : 'scale(1)',
            cursor: 'pointer',
          }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: SugarV2.cardSubtle,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={SugarV2.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6M9 13h6M9 17h4"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.2 }}>
                Importer un mandat signé
              </span>
              <span style={{
                padding: '3px 9px', borderRadius: 999,
                background: SugarV2.black, color: sgOn(),
                fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>MEGGA AI</span>
            </div>
            <div style={{ fontSize: 13.5, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
              Glissez votre PDF ici. MEGGA AI extrait automatiquement le type, la durée, la commission et la date de signature.
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); triggerFilePicker() }} style={{
            height: 46, padding: '0 22px', borderRadius: 999,
            background: SugarV2.black, color: sgOn(),
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: 0,
            boxShadow: '0 6px 16px rgba(0,0,0,0.18)', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sgOn()} strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Choisir le PDF
          </button>
        </div>
      )}

      {/* EN COURS */}
      {(importMode === 'uploading' || importMode === 'extracting') && (
        <div style={{
          background: SugarV2.card, borderRadius: 24, padding: 32,
          boxShadow: SugarV2.shadow, marginBottom: 28,
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: SugarV2.black, color: sgOn(),
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
              animation: 'sgPulse 1.4s ease-in-out infinite',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sgOn()} strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.2, marginBottom: 2 }}>
                {importMode === 'uploading' ? 'Lecture du fichier…' : 'MEGGA AI analyse votre mandat'}
              </div>
              <div style={{ fontSize: 12.5, color: SugarV2.muted, fontWeight: 500 }}>
                {fileName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {extractedFields.map(f => (
              <div key={f.key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                background: SugarV2.cardSubtle,
                animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
              }}>
                <span style={{ color: SugarV2.ok, fontSize: 14, fontWeight: 700 }}>✓</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: SugarV2.muted,
                  letterSpacing: 0.4, textTransform: 'uppercase', minWidth: 130,
                }}>{f.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: SugarV2.ink, flex: 1 }}>
                  {f.value}
                </span>
              </div>
            ))}
            {extractStep < MOCK_EXTRACTION.length && (
              <div style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'transparent', border: `1px dashed ${SugarV2.ghost}`,
                fontSize: 12.5, color: SugarV2.muted, fontStyle: 'italic',
              }}>
                Recherche du champ suivant…
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMPORTÉ */}
      {importMode === 'imported' && (
        <div style={{
          background: SugarV2.card, borderRadius: 24, padding: 28,
          boxShadow: SugarV2.shadow, marginBottom: 28,
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(16,185,129,0.12)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SugarV2.ok} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.2 }}>
                  Mandat importé et analysé
                </span>
                <span style={{
                  padding: '3px 9px', borderRadius: 999,
                  background: SugarV2.black, color: sgOn(),
                  fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>MEGGA AI</span>
              </div>
              <div style={{ fontSize: 12.5, color: SugarV2.muted, fontWeight: 500 }}>{fileName}</div>
            </div>
            <button onClick={cancelImport} style={{
              height: 36, padding: '0 16px', borderRadius: 999, border: 0,
              background: SugarV2.cardSubtle, color: SugarV2.inkSoft,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Saisir manuellement</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { label: 'Type de mandat', value: ({ exclusive: 'Mandat exclusif', simple: 'Mandat simple', co: 'Co-mandat' } as Record<string, string>)[m.type] || m.type },
              { label: 'Durée', value: `${m.duration} mois` },
              { label: 'Commission', value: `${m.commission.toFixed(1)} %` },
              { label: 'Honoraires', value: m.fees === 'owner' ? 'À charge du vendeur' : "À charge de l'acheteur" },
              { label: 'Date de signature', value: '14 mars 2026' },
              { label: 'Statut', value: m.signed ? 'Signé' : 'Non signé', accent: m.signed ? SugarV2.ok : SugarV2.warn },
            ].map((f, i) => (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 14,
                background: SugarV2.cardSubtle,
              }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, color: SugarV2.muted,
                  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
                }}>{f.label}</div>
                <div style={{
                  fontSize: 15, fontWeight: 600, color: f.accent || SugarV2.ink,
                  letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {f.accent && <span style={{ width: 7, height: 7, borderRadius: 999, background: f.accent }} />}
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 18, fontSize: 12.5, color: SugarV2.muted,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>Pour modifier ces valeurs, cliquez sur</span>
            <button onClick={cancelImport} style={{
              border: 0, background: 'transparent', color: SugarV2.ink,
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
              textDecoration: 'underline', cursor: 'pointer', padding: 0,
            }}>« Saisir manuellement »</button>
          </div>
        </div>
      )}

      {/* 3 TUILES + PARAMÈTRES (manuels) */}
      {importMode === 'manual' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, margin: '4px 0 22px',
          }}>
            <div style={{ flex: 1, height: 1, background: SugarV2.ghost }} />
            <span style={{
              fontSize: 11, fontWeight: 600, color: SugarV2.muted,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>ou configurez à la main</span>
            <div style={{ flex: 1, height: 1, background: SugarV2.ghost }} />
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 18, marginBottom: 32,
          }}>
            {TYPES.map(t => {
              const sel = m.type === t.v
              return (
                <button key={t.v} onClick={() => choose(t.v)}
                  style={{
                    position: 'relative',
                    padding: '26px 22px', borderRadius: 24,
                    background: sel ? SugarV2.black : SugarV2.card,
                    color: sel ? sgOn() : SugarV2.ink,
                    border: 0, fontFamily: 'inherit', textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: sel
                      ? '0 20px 48px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.15)'
                      : SugarV2.shadow,
                    transform: sel ? 'translateY(-2px)' : 'translateY(0)',
                    transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                  {t.hint && (
                    <span style={{
                      position: 'absolute', top: 16, right: 16,
                      padding: '4px 10px', borderRadius: 999,
                      background: sel ? sgAcc(0.15) : SugarV2.cardSubtle,
                      color: sel ? sgOn() : SugarV2.inkSoft,
                      fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}>{t.hint}</span>
                  )}
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{t.title}</h3>
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.5,
                    color: sel ? sgAcc(0.75) : SugarV2.inkSoft,
                  }}>{t.sub}</p>
                  <div style={{
                    marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 12, fontWeight: 600,
                    color: sel ? sgAcc(0.6) : SugarV2.muted,
                  }}>
                    <span>Commission proposée</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: sel ? sgOn() : SugarV2.ink }}>{t.defaultCom}%</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Paramètres détaillés */}
          {m.type && (
            <div style={{
              background: SugarV2.card, borderRadius: 24, padding: 28,
              boxShadow: SugarV2.shadow,
              animation: 'sgScaleIn .4s cubic-bezier(.2,.8,.2,1) both',
            }}>
              <div style={{ marginBottom: 22 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: SugarV2.muted,
                  letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
                }}>Paramètres</div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3 }}>
                  Ajustez les conditions du mandat
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 22 }}>
                {/* Durée */}
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: SugarV2.muted,
                    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12,
                  }}>Durée</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[3, 6, 9, 12].map(d => (
                      <button key={d} onClick={() => setM({ duration: d })} style={{
                        height: 40, padding: '0 16px', borderRadius: 999, border: 0,
                        background: m.duration === d ? SugarV2.black : SugarV2.cardSubtle,
                        color: m.duration === d ? sgOn() : SugarV2.inkSoft,
                        fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        boxShadow: m.duration === d ? '0 4px 12px rgba(0,0,0,0.18)' : 'none',
                        transition: 'all .18s ease',
                      }}>{d} mois</button>
                    ))}
                  </div>
                </div>

                {/* Commission */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: SugarV2.muted,
                      letterSpacing: 0.6, textTransform: 'uppercase',
                    }}>Commission</span>
                    <span style={{ fontSize: 17, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3 }}>
                      {m.commission.toFixed(1)}%
                    </span>
                  </div>
                  <input type="range" min="2" max="6" step="0.1" value={m.commission}
                    onChange={e => setM({ commission: parseFloat(e.target.value) })}
                    className="sg-range"
                    style={{
                      width: '100%', appearance: 'none', WebkitAppearance: 'none',
                      height: 4, borderRadius: 999,
                      background: `linear-gradient(to right, ${SugarV2.black} 0%, ${SugarV2.black} ${((m.commission - 2) / 4) * 100}%, ${SugarV2.cardSubtle} ${((m.commission - 2) / 4) * 100}%, ${SugarV2.cardSubtle} 100%)`,
                      outline: 'none',
                    }} />
                </div>

                {/* Honoraires */}
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: SugarV2.muted,
                    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12,
                  }}>Honoraires</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { v: 'owner' as const, l: 'À charge du vendeur' },
                      { v: 'buyer' as const, l: "À charge de l'acheteur" },
                    ].map(o => (
                      <button key={o.v} onClick={() => setM({ fees: o.v })} style={{
                        height: 40, padding: '0 14px', borderRadius: 12, border: 0,
                        background: m.fees === o.v ? SugarV2.black : SugarV2.cardSubtle,
                        color: m.fees === o.v ? sgOn() : SugarV2.inkSoft,
                        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all .15s',
                      }}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Récap commission */}
              <div style={{
                marginTop: 24, padding: '16px 20px', borderRadius: 16,
                background: SugarV2.cardSubtle,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: SugarV2.card,
                  display: 'grid', placeItems: 'center',
                  boxShadow: SugarV2.shadowSm,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SugarV2.ink} strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
                  <span style={{ color: SugarV2.ink, fontWeight: 600 }}>Sur un bien à 1'500'000 CHF</span>,
                  la commission s'élèverait à{' '}
                  <span style={{ color: SugarV2.ink, fontWeight: 700 }}>
                    {Math.round(1500000 * m.commission / 100).toLocaleString('fr-CH').replace(/,/g, "'")} CHF
                  </span>{' '}
                  ({m.fees === 'owner' ? 'à charge du vendeur' : "à charge de l'acheteur"}).
                </div>
              </div>

              {/* Statut signature */}
              <div style={{
                marginTop: 14, display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', borderRadius: 14,
                background: m.signed ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: m.signed ? SugarV2.ok : SugarV2.warn,
                }} />
                <span style={{ fontSize: 12.5, fontWeight: 500, color: SugarV2.inkSoft, flex: 1 }}>
                  {m.signed
                    ? 'Mandat marqué comme signé.'
                    : "Mandat non signé — vous pourrez l'envoyer pour signature après publication."}
                </span>
                <button onClick={() => setM({ signed: !m.signed })} style={{
                  height: 32, padding: '0 14px', borderRadius: 999, border: 0,
                  background: m.signed ? SugarV2.cardSubtle : SugarV2.black,
                  color: m.signed ? SugarV2.inkSoft : sgOn(),
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  {m.signed ? 'Marquer comme non signé' : 'Marquer comme signé'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
