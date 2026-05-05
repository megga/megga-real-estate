// MEGGA CRM Sugar v2 Wizard — Shell.
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-v2.jsx — `CRMWizardSugarV2`).

import { useState } from 'react'
import {
  SugarV2, EMPTY_WIZARD, SG_STEPS, SG_KEYFRAMES, type WizardData,
} from './tokens'
import {
  SgIcon, SgCircleBtn, SgBlackPill, SgGhostPill, SgStepper,
} from './primitives'
import { Step0Start } from './steps/Step0Start'
import { Step1Vendor } from './steps/Step1Vendor'
import { Step1Mandate } from './steps/Step1Mandate'
import { Step2Address } from './steps/Step2Address'
import { Step3Specs } from './steps/Step3Specs'
import { Step4Photos } from './steps/Step4Photos'
import { Step5PriceDesc } from './steps/Step5PriceDesc'
import { Step6Options } from './steps/Step6Options'
import { Step7Publish } from './steps/Step7Publish'
import { Step8Success } from './steps/Step8Success'

interface WizardShellProps {
  onClose: () => void
}

export default function WizardShell({ onClose }: WizardShellProps) {
  const [step, setStep] = useState(0)
  const [subStep, setSubStep] = useState(0)        // 0 = Vendeur, 1 = Mandat
  const [published, setPublished] = useState(false)
  const [data, setDataRaw] = useState<WizardData>(EMPTY_WIZARD)
  const set = (patch: Partial<WizardData>) => setDataRaw(prev => ({ ...prev, ...patch }))

  const canNext = (() => {
    if (step === 0) {
      if (!data.source) return false
      if (data.source === 'submission' && !data.fromSubmissionId) return false
      return true
    }
    if (step === 1 && subStep === 0) return !!data.ownerContactId
    if (step === 1 && subStep === 1) return !!(data.mandate && data.mandate.type)
    return true
  })()

  const next = () => {
    if (step === 0 && data.source === 'import') { setStep(1); setSubStep(1); return }
    if (step === 0 && data.source === 'submission' && data.ownerContactId) { setStep(1); setSubStep(1); return }
    if (step === 1 && subStep === 0) { setSubStep(1); return }
    setSubStep(0)
    setStep(s => Math.min(s + 1, SG_STEPS.length - 1))
  }
  const prev = () => {
    if (step === 1 && subStep === 1) {
      if (data.source === 'import' || data.source === 'submission') {
        setStep(0); setSubStep(0); return
      }
      setSubStep(0); return
    }
    setSubStep(0)
    setStep(s => Math.max(s - 1, 0))
  }

  const headerLabel = published
    ? 'Publication'
    : (step === 1)
      ? (subStep === 0 ? 'Vendeur' : 'Mandat')
      : SG_STEPS[step].label

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: SugarV2.bgGradient,
      fontFamily: 'Manrope, system-ui, sans-serif', color: SugarV2.ink,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{SG_KEYFRAMES}</style>

      {/* TOP BAR */}
      <header style={{
        flexShrink: 0,
        padding: '20px 32px',
        display: 'flex', alignItems: 'center', gap: 18,
        position: 'relative', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {/* Logo MEGGA — utilisons le SVG inline du Today (cohérent) */}
          <svg viewBox="0 0 694.81 419.02" width="38" height="24" style={{ display: 'block' }} aria-label="MEGGA">
            <path fill={SugarV2.ink} d="M212.94,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92C-27.8,280.23-21.84,119.65,81.31,39.5,110.93,16.49,145.39,3.92,181.93,0h31.01Z"/>
            <path fill={SugarV2.ink} d="M511.94,419.01h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8h0Z"/>
            <path fill={SugarV2.ink} d="M511.94,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25C402.99,19.45,441.75,4.18,482.95.02h29-.01Z"/>
          </svg>
          <div style={{
            width: 1, height: 28, background: 'rgba(11,12,14,0.10)',
          }} />
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: SugarV2.muted,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>Nouveau bien</div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3,
            }}>{headerLabel}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {!published && <SgStepper steps={SG_STEPS} current={step} onJump={setStep} />}
        </div>

        <SgCircleBtn
          icon={<SgIcon name="close" size={18} stroke={SugarV2.ink} />}
          onClick={onClose}
          title="Fermer"
        />
      </header>

      {/* BODY */}
      <main key={(published ? 'success' : step + '-' + subStep)} style={{
        flex: 1, overflowY: 'auto',
        padding: published ? '32px 32px 80px' : '40px 32px 140px',
        position: 'relative', zIndex: 5,
      }}>
        {published ? (
          <Step8Success data={data} onClose={onClose} onBackToCRM={onClose} />
        ) : (
          <>
            {step === 0 && <Step0Start data={data} set={set} />}
            {step === 1 && subStep === 0 && <Step1Vendor data={data} set={set} />}
            {step === 1 && subStep === 1 && <Step1Mandate data={data} set={set} />}
            {step === 2 && <Step2Address data={data} set={set} />}
            {step === 3 && <Step3Specs data={data} set={set} />}
            {step === 4 && <Step4Photos data={data} set={set} />}
            {step === 5 && <Step5PriceDesc data={data} set={set} />}
            {step === 6 && <Step6Options data={data} set={set} />}
            {step === 7 && <Step7Publish data={data} set={set} onClose={onClose} />}
          </>
        )}
      </main>

      {/* FOOTER ACTIONS */}
      {!published && <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, zIndex: 20,
        background: 'linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.9) 60%, rgba(237,239,243,1) 100%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {step > 0 && (
            <SgGhostPill onClick={prev}
              icon={<SgIcon name="arrowL" size={16} stroke={SugarV2.inkSoft} />}>
              Précédent
            </SgGhostPill>
          )}
        </div>

        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: SugarV2.muted, fontWeight: 500 }}>
            {step + 1} / {SG_STEPS.length}
          </span>
          {step < SG_STEPS.length - 1 ? (
            <SgBlackPill onClick={next} disabled={!canNext}
              icon={<SgIcon name="arrowR" size={16} stroke="#fff" />}>
              Continuer
            </SgBlackPill>
          ) : (
            <SgBlackPill onClick={() => setPublished(true)}>
              {data.publishMode === 'schedule' ? 'Programmer la publication'
                : data.publishMode === 'draft' ? 'Enregistrer en brouillon'
                : 'Publier sur MEGGA'}
            </SgBlackPill>
          )}
        </div>
      </footer>}
    </div>
  )
}
