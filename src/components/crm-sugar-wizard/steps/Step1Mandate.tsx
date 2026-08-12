// MEGGA CRM Sugar v2 Wizard — Step 1b : Mandat
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step1.jsx — `SgStepMandate`).

import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { SugarV2, sgOn, sgAcc, type WizardData } from '../tokens'
import { crmContactById } from '@/components/crm-sugar/mockData'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

interface ExtractedField {
  key: string
  label: string
  value: string
  apply: () => void
}

export function Step1Mandate({ data, set }: StepProps) {
  // `t` est déjà utilisé localement (const t = TYPES.find…) → alias `tr`.
  const { t: tr } = useTranslation('listings')
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

  // Valeurs = données de démonstration simulées (extraction MEGGA AI) → NON traduites.
  // Seuls les libellés de champ (UI) sont i18n.
  const MOCK_EXTRACTION: ExtractedField[] = [
    { key: 'type',       label: tr('wizard.step1.mandate.field.type'),       value: 'Mandat exclusif',         apply: () => setM({ type: 'exclusive', commission: 3.5 }) },
    { key: 'duration',   label: tr('wizard.step1.mandate.field.duration'),   value: '6 mois',                  apply: () => setM({ duration: 6 }) },
    { key: 'commission', label: tr('wizard.step1.mandate.field.commission'), value: '3,5 %',                   apply: () => setM({ commission: 3.5 }) },
    { key: 'fees',       label: tr('wizard.step1.mandate.field.fees'),       value: 'À charge du vendeur',     apply: () => setM({ fees: 'owner' }) },
    { key: 'signedAt',   label: tr('wizard.step1.mandate.field.signedAt'),   value: '14 mars 2026',            apply: () => setM({ signed: true, signedAt: '2026-03-14' }) },
    { key: 'vendor',     label: tr('wizard.step1.mandate.field.vendor'),     value: 'Jean-Marc Aebischer',     apply: () => {} },
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
        {/* ⚠ Le SEUL sous-titre gardé du wizard, et il ne décrit pas l'écran : il
            dit que les valeurs affichées ont été EXTRAITES par MEGGA AI et qu'il
            faut les vérifier. Sans lui, des champs pré-remplis par une machine
            passeraient pour des champs saisis — la validation humaine ne se
            demande plus nulle part. */}
        {importMode === 'imported' && (
          <p style={{ margin: '14px 0 0', fontSize: 'var(--crm-text-xl)', color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
            {tr('wizard.step1.mandate.subtitleImported')}
          </p>
        )}

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
            borderRadius: 'var(--crm-radius-5xl)', padding: '28px 32px',
            boxShadow: dragOver ? `0 0 0 2px ${SugarV2.black}, 0 24px 60px rgba(0,0,0,0.18)` : SugarV2.shadow,
            marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-6xl)',
            transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
            transform: dragOver ? 'scale(1.01)' : 'scale(1)',
            cursor: 'pointer',
          }}>
          <div style={{
            width: 64, height: 64, borderRadius: 'var(--crm-radius-3xl)',
            background: SugarV2.cardSubtle,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={SugarV2.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6M9 13h6M9 17h4"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: SugarV2.ink, letterSpacing: -0.2 }}>
                {tr('wizard.step1.mandate.import.title')}
              </span>
              <span style={{
                padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
                background: SugarV2.black, color: sgOn(),
                fontSize: 'var(--crm-text-xs)', fontWeight: 600,
              }}>MEGGA AI</span>
            </div>
            <div style={{ fontSize: 'var(--crm-text-lg)', color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
              {tr('wizard.step1.mandate.import.hint')}
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); triggerFilePicker() }} style={{
            height: 46, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)',
            background: SugarV2.black, color: sgOn(),
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
            border: 0,
            boxShadow: '0 6px 16px rgba(0,0,0,0.18)', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sgOn()} strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            {tr('wizard.step1.mandate.import.choosePdf')}
          </button>
        </div>
      )}

      {/* EN COURS */}
      {(importMode === 'uploading' || importMode === 'extracting') && (
        <div style={{
          background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)', padding: 32,
          boxShadow: SugarV2.shadow, marginBottom: 28,
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', marginBottom: 22 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--crm-radius-lg)',
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
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: SugarV2.ink, letterSpacing: -0.2, marginBottom: 2 }}>
                {importMode === 'uploading' ? tr('wizard.step1.mandate.reading') : tr('wizard.step1.mandate.analyzing')}
              </div>
              <div style={{ fontSize: 'var(--crm-text-md)', color: SugarV2.muted, fontWeight: 500 }}>
                {fileName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
            {extractedFields.map(f => (
              <div key={f.key} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
                padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)',
                background: SugarV2.cardSubtle,
                animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
              }}>
                <span style={{ color: SugarV2.ok, fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>✓</span>
                <span style={{
                  fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SugarV2.muted,
                  minWidth: 130,
                }}>{f.label}</span>
                <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: SugarV2.ink, flex: 1 }}>
                  {f.value}
                </span>
              </div>
            ))}
            {extractStep < MOCK_EXTRACTION.length && (
              <div style={{
                padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)',
                background: 'transparent', border: `1px dashed ${SugarV2.ghost}`,
                fontSize: 'var(--crm-text-md)', color: SugarV2.muted, fontStyle: 'italic',
              }}>
                {tr('wizard.step1.mandate.searchingNextField')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMPORTÉ */}
      {importMode === 'imported' && (
        <div style={{
          background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)', padding: 28,
          boxShadow: SugarV2.shadow, marginBottom: 28,
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', marginBottom: 22 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--crm-radius-lg)',
              background: 'rgba(16,185,129,0.12)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SugarV2.ok} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 2 }}>
                <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: SugarV2.ink, letterSpacing: -0.2 }}>
                  {tr('wizard.step1.mandate.importedTitle')}
                </span>
                <span style={{
                  padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
                  background: SugarV2.black, color: sgOn(),
                  fontSize: 'var(--crm-text-xs)', fontWeight: 600,
                }}>MEGGA AI</span>
              </div>
              <div style={{ fontSize: 'var(--crm-text-md)', color: SugarV2.muted, fontWeight: 500 }}>{fileName}</div>
            </div>
            <button onClick={cancelImport} style={{
              height: 36, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: SugarV2.cardSubtle, color: SugarV2.inkSoft,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
            }}>{tr('wizard.step1.mandate.enterManually')}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--crm-space-xl)' }}>
            {[
              { label: tr('wizard.step1.mandate.field.type'), value: ({ exclusive: tr('wizard.step1.mandate.type.exclusive.title'), simple: tr('wizard.step1.mandate.type.simple.title'), co: tr('wizard.step1.mandate.type.co.title') } as Record<string, string>)[m.type] || m.type },
              { label: tr('wizard.step1.mandate.field.duration'), value: tr('wizard.step1.mandate.months', { count: m.duration }) },
              { label: tr('wizard.step1.mandate.field.commission'), value: `${m.commission.toFixed(1)} %` },
              { label: tr('wizard.step1.mandate.field.fees'), value: m.fees === 'owner' ? tr('wizard.step1.mandate.feesOwner') : tr('wizard.step1.mandate.feesBuyer') },
              { label: tr('wizard.step1.mandate.field.signedAt'), value: '14 mars 2026' },
              { label: tr('wizard.step1.mandate.statusLabel'), value: m.signed ? tr('wizard.step1.mandate.signed') : tr('wizard.step1.mandate.notSigned'), accent: m.signed ? SugarV2.ok : SugarV2.warn },
            ].map((f, i) => (
              <div key={i} style={{
                padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-xl)',
                background: SugarV2.cardSubtle,
              }}>
                <div style={{
                  fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: SugarV2.muted,
                  marginBottom: 6,
                }}>{f.label}</div>
                <div style={{
                  fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: f.accent || SugarV2.ink,
                  letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
                }}>
                  {f.accent && <span style={{ width: 7, height: 7, borderRadius: 'var(--crm-radius-pill)', background: f.accent }} />}
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 18, fontSize: 'var(--crm-text-md)', color: SugarV2.muted,
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
          }}>
            <span>{tr('wizard.step1.mandate.editHint')}</span>
            <button onClick={cancelImport} style={{
              border: 0, background: 'transparent', color: SugarV2.ink,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
              textDecoration: 'underline', cursor: 'pointer', padding: 0,
            }}>{tr('wizard.step1.mandate.enterManuallyQuoted')}</button>
          </div>
        </div>
      )}

      {/* 3 TUILES + PARAMÈTRES (manuels) */}
      {importMode === 'manual' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', margin: '4px 0 22px',
          }}>
            <div style={{ flex: 1, height: 1, background: SugarV2.ghost }} />
            <span style={{
              fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted,
            }}>{tr('wizard.step1.mandate.orManual')}</span>
            <div style={{ flex: 1, height: 1, background: SugarV2.ghost }} />
          </div>

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
      )}
    </div>
  )
}
