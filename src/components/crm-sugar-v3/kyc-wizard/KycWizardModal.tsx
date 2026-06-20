// MEGGA CRM Sugar v3 — Wizard KYC Modal (orchestrateur)
// Refonte visuelle (handoff KYC §1) : dark mode via la palette KYC partagée
// (useKycPalette — le wizard est monté dans le KycPaletteContext.Provider de la
// page KYC), stepper segmenté, header stable, scroll-lock du fond, scrollbar
// intégrée. AUCUNE logique métier modifiée (preset, finish, magic link, statuts).
//
// Deep-link : si `initialContactId` fourni → préset step=2 (Vigilance), source='existing'.

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { useKycPalette } from '../kyc/kycPalette'
import { KycBlackPill, KycCircleBtn, KycGhostPill } from '../kyc/kycPrimitives'
import { KwStepper } from './KwStepper'
import { useAuth } from '@/hooks/useAuth'
import { useCreateKycDossier } from '@/hooks/useKycDossier'
import { useContacts } from '@/hooks/useContacts'
import { KwStepStart } from './KwStepStart'
import { KwStepContact } from './KwStepContact'
import { KwStepVigilance } from './KwStepVigilance'
import { KwStepSuccess } from './KwStepSuccess'
import { MlkAgentModal } from './MlkAgentModal'
import { WIZARD_STEPS, type WizardData } from './types'
import type { KycType } from '@/types/kyc'

interface Props {
  onClose: () => void
  /** Si fourni, le wizard atterrit directement à l'étape Vigilance (step=2). */
  initialContactId?: string | null
}

export function KycWizardModal({ onClose, initialContactId }: Props) {
  const { t } = useTranslation('kyc')
  const navigate = useNavigate()
  const sp = useKycPalette()
  const { profile } = useAuth()
  const { contacts = [] } = useContacts()
  const createDossier = useCreateKycDossier()

  const preset = !!initialContactId
  const [step, setStep] = useState<number>(preset ? 2 : 0)
  const [done, setDone] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Sprint 4.7.B — Modal magic link s'ouvre AU-DESSUS du wizard quand
  // source === 'magic' et que le dossier vient d'être créé.
  const [magicModalOpen, setMagicModalOpen] = useState(false)

  const [data, setData] = useState<WizardData>({
    source: preset ? 'existing' : null,
    contactId: initialContactId ?? null,
    entityType: 'pp',
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

  // §1.9 — verrou de scroll du fond : le wizard est plein écran ; on fige la
  // page CRM derrière tant qu'il est monté (pas de double-scroll), puis on
  // restaure à la fermeture.
  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [])

  const canNext = useMemo(() => {
    if (step === 0) return !!data.source
    if (step === 1) return !!data.contactId
    if (step === 2) return !!data.vigilance
    return true
  }, [step, data])

  const inferKycType = (): KycType => {
    const c = data.contactId ? contacts.find((x) => x.id === data.contactId) : null
    const side: 'buyer' | 'seller' =
      c?.type === 'seller' || c?.type === 'landlord' ? 'seller' : 'buyer'
    const isCompany = data.entityType === 'pm'
    if (side === 'seller') return isCompany ? 'seller_pm' : 'seller_pp'
    return isCompany ? 'buyer_pm' : 'buyer_pp'
  }

  const finish = async () => {
    if (!data.contactId || !data.vigilance || !profile?.agency_id) {
      setError(t('wizard.errors.missingContactVigilance'))
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
      if (data.source === 'magic') {
        setMagicModalOpen(true)
      } else {
        setDone(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wizard.errors.createFailed'))
    }
  }

  const magicContact = useMemo(() => {
    if (!data.contactId) return null
    return contacts.find((c) => c.id === data.contactId) ?? null
  }, [data.contactId, contacts])

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

  // Variables CSS de la scrollbar intégrée (.kw-scroll), héritées par <main>
  // et la liste de contacts.
  const scrollVars = {
    '--kw-thumb': sp.scrollThumb,
    '--kw-thumb-h': sp.scrollThumbHover,
  } as CSSProperties

  // Libellés du stepper traduits ici (réactifs au changement de langue) ; KwStepper
  // ne lit que `label`. Cf KYC_UI_STEPS / docs/i18n-conventions §5.
  const stepperSteps = useMemo(
    () => WIZARD_STEPS.map((s) => ({ id: s.id, label: t(s.labelKey) })),
    [t],
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: sp.bgGradient,
        fontFamily: SugarV3.font,
        color: sp.ink,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...scrollVars,
      }}
    >
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .kw-scroll { scrollbar-width: thin; scrollbar-color: var(--kw-thumb) transparent; overscroll-behavior: contain; }
        .kw-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
        .kw-scroll::-webkit-scrollbar-track { background: transparent; margin: 10px 0; }
        .kw-scroll::-webkit-scrollbar-thumb { background: var(--kw-thumb); border-radius: 999px; border: 4px solid transparent; background-clip: padding-box; }
        .kw-scroll::-webkit-scrollbar-thumb:hover { background: var(--kw-thumb-h); background-clip: padding-box; }
      `}</style>

      {/* HEADER — titre stable (§1.4), stepper segmenté au centre */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <img
            src="/megga-logo.svg"
            alt="MEGGA"
            style={{
              height: 38,
              width: 'auto',
              display: 'block',
              flexShrink: 0,
              filter: sp.logoInvert ? 'invert(1) brightness(1.6)' : 'none',
            }}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
          <div style={{ width: 1, height: 28, background: sp.divider }} />
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: sp.muted,
                letterSpacing: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {t('wizard.header.eyebrow')}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: sp.ink,
                letterSpacing: -0.3,
              }}
            >
              {t('wizard.header.title')}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {!done && (
            <KwStepper steps={stepperSteps} current={step} onJump={setStep} />
          )}
        </div>

        <KycCircleBtn
          icon={<SgIcon name="close" size={18} stroke={sp.ink} />}
          onClick={onClose}
          title={t('wizard.close')}
        />
      </header>

      {/* BODY */}
      <main
        key={done ? 'success' : step}
        className="kw-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: done ? '32px 32px 80px' : '160px 32px 140px',
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
              background: sp.errSoft,
              color: sp.errDarker,
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

      {/* FOOTER — sans compteur « n/3 » (§1.6) */}
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
            background: sp.footerFade,
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            {step > 0 && (
              <KycGhostPill
                onClick={prev}
                icon={<SgIcon name="arrowL" size={16} stroke={sp.inkSoft} />}
              >
                {t('wizard.nav.previous')}
              </KycGhostPill>
            )}
          </div>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <KycBlackPill
              onClick={next}
              disabled={!canNext || createDossier.isPending}
              size="lg"
              icon={<SgIcon name="arrowR" size={16} stroke={sp.onAccent} />}
            >
              {createDossier.isPending
                ? t('wizard.nav.creating')
                : step === WIZARD_STEPS.length - 1
                  ? data.source === 'magic'
                    ? t('wizard.nav.prepareMagicLink')
                    : t('wizard.nav.openDossier')
                  : t('wizard.nav.continue')}
            </KycBlackPill>
          </div>
        </footer>
      )}

      {/* Sprint 4.7.B — Modal Magic Link (au-dessus du wizard) */}
      {magicModalOpen && createdId && magicContact && profile?.agency_id && (
        <MlkAgentModal
          kycCaseId={createdId}
          contactId={magicContact.id}
          contactName={`${magicContact.first_name} ${magicContact.last_name}`.trim()}
          contactSummary={
            magicContact.type === 'seller'
              ? t('wizard.roles.seller')
              : magicContact.type === 'landlord'
                ? t('wizard.roles.landlord')
                : magicContact.type === 'tenant'
                  ? t('wizard.roles.tenant')
                  : t('wizard.roles.buyer')
          }
          contactEmail={magicContact.email}
          contactPhone={magicContact.phone}
          defaultMode={data.vigilance === 'renforced' ? 'verifiee' : 'libre'}
          onClose={() => {
            setMagicModalOpen(false)
            setDone(true)
          }}
        />
      )}
    </div>
  )
}
