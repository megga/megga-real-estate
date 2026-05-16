// MEGGA CRM Sugar v3 — Wizard KYC Modal (orchestrateur)
// Port 1:1 de crm-kyc-wizard.jsx lignes 510-666 (CRMKycWizard).
//
// Structure :
//  - Modal portail position:fixed inset-0 z-9000 bg gradient
//  - Header : logo + label étape + KwStepper 3 cercles + bouton close
//  - Main : Step0/1/2 ou StepSuccess (animation key={step})
//  - Footer : Précédent + indicateur "n/3" + Continuer/Ouvrir le dossier
//
// Deep-link : si `initialContactId` fourni → préset step=2 (Vigilance), source='existing'.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import {
  KycBlackPill,
  KycCircleBtn,
  KycGhostPill,
  KycStepper,
} from '../primitives'
import { useAuth } from '@/hooks/useAuth'
import { useCreateKycDossier } from '@/hooks/useKycDossier'
import { useContacts } from '@/hooks/useContacts'
import { KwStepStart } from './KwStepStart'
import { KwStepContact } from './KwStepContact'
import { KwStepVigilance } from './KwStepVigilance'
import { KwStepSuccess } from './KwStepSuccess'
import { WIZARD_STEPS, type WizardData } from './types'
import type { KycType } from '@/types/kyc'

interface Props {
  onClose: () => void
  /** Si fourni, le wizard atterrit directement à l'étape Vigilance (step=2). */
  initialContactId?: string | null
}

export function KycWizardModal({ onClose, initialContactId }: Props) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { contacts = [] } = useContacts()
  const createDossier = useCreateKycDossier()

  const preset = !!initialContactId
  const [step, setStep] = useState<number>(preset ? 2 : 0)
  const [done, setDone] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState<WizardData>({
    source: preset ? 'existing' : null,
    contactId: initialContactId ?? null,
    vigilance: null,
    riskLevel: 'low',
    smartReco: 'standard',
  })
  const set = (patch: Partial<WizardData>) =>
    setData((p) => ({ ...p, ...patch }))

  // ESC ferme la modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canNext = useMemo(() => {
    if (step === 0) return !!data.source
    if (step === 1) return !!data.contactId
    if (step === 2) return !!data.vigilance
    return true
  }, [step, data])

  const inferKycType = (): KycType => {
    const c = data.contactId ? contacts.find((x) => x.id === data.contactId) : null
    if (!c) return 'buyer_pp'
    // Seul buyer/seller × PP/PM est connu de l'enum. Default: PP.
    if (c.type === 'seller' || c.type === 'landlord') return 'seller_pp'
    return 'buyer_pp'
  }

  const finish = async () => {
    if (!data.contactId || !data.vigilance || !profile?.agency_id) {
      setError('Contact et vigilance requis')
      return
    }
    try {
      const dossier = await createDossier.mutateAsync({
        contactId: data.contactId,
        agencyId: profile.agency_id,
        type: inferKycType(),
        vigilance: data.vigilance,
      })
      setCreatedId(dossier.id)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la création')
    }
  }

  const next = () => {
    setError(null)
    if (step === 2) {
      void finish()
      return
    }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }
  const prev = () => setStep((s) => Math.max(s - 1, 0))

  const handleOpenCreated = () => {
    if (createdId) navigate(`/dashboard/kyc/${createdId}`)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: SugarV3.bgGradient,
        fontFamily: SugarV3.font,
        color: SugarV3.ink,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* HEADER */}
      <header
        style={{
          flexShrink: 0,
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0,
          }}
        >
          <img
            src="/megga-logo.svg"
            alt="MEGGA"
            style={{
              height: 38,
              width: 'auto',
              display: 'block',
              flexShrink: 0,
            }}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
          <div
            style={{ width: 1, height: 28, background: 'rgba(11,12,14,0.10)' }}
          />
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: SugarV3.muted,
                letterSpacing: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Nouveau dossier KYC
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: SugarV3.ink,
                letterSpacing: -0.3,
              }}
            >
              {done ? 'Confirmation' : WIZARD_STEPS[step]?.label ?? ''}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {!done && (
            <KycStepper steps={WIZARD_STEPS} current={step} onJump={setStep} />
          )}
        </div>

        <KycCircleBtn
          icon={<SgIcon name="close" size={18} stroke={SugarV3.ink} />}
          onClick={onClose}
          title="Fermer"
        />
      </header>

      {/* BODY */}
      <main
        key={done ? 'success' : step}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: done ? '32px 32px 80px' : '40px 32px 140px',
        }}
      >
        {done ? (
          <KwStepSuccess data={data} onOpen={handleOpenCreated} onClose={onClose} />
        ) : (
          <>
            {step === 0 && <KwStepStart data={data} set={set} />}
            {step === 1 && <KwStepContact data={data} set={set} />}
            {step === 2 && <KwStepVigilance data={data} set={set} />}
          </>
        )}

        {error && (
          <div
            style={{
              maxWidth: 720,
              margin: '24px auto 0',
              padding: '12px 16px',
              background: SugarV3.errSoft,
              color: SugarV3.errDarker,
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}
      </main>

      {/* FOOTER */}
      {!done && (
        <footer
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '24px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            zIndex: 20,
            background:
              'linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.9) 60%, rgba(237,239,243,1) 100%)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            {step > 0 && (
              <KycGhostPill
                onClick={prev}
                icon={<SgIcon name="arrowL" size={16} stroke={SugarV3.inkSoft} />}
              >
                Précédent
              </KycGhostPill>
            )}
          </div>
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: SugarV3.muted,
                fontWeight: 500,
              }}
            >
              {step + 1} / {WIZARD_STEPS.length}
            </span>
            <KycBlackPill
              onClick={next}
              disabled={!canNext || createDossier.isPending}
              size="lg"
              icon={<SgIcon name="arrowR" size={16} stroke="#fff" />}
            >
              {createDossier.isPending
                ? 'Création…'
                : step === WIZARD_STEPS.length - 1
                  ? 'Ouvrir le dossier'
                  : 'Continuer'}
            </KycBlackPill>
          </div>
        </footer>
      )}
    </div>
  )
}
