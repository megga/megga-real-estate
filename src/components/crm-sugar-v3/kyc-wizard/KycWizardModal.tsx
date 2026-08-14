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
import { useUploadKycDocument } from '@/hooks/useKyc'
import { useContacts } from '@/hooks/useContacts'
import { KwStepStart } from './KwStepStart'
import { KwStepContact } from './KwStepContact'
import { KwStepVigilance } from './KwStepVigilance'
import { KwStepImport } from './KwStepImport'
import { KwStepSuccess } from './KwStepSuccess'
import { MlkAgentModal } from './MlkAgentModal'
import { WIZARD_STEPS, type WizardData, type WizardSource } from './types'
import type { KycType } from '@/types/kyc'

interface Props {
  onClose: () => void
  /** Si fourni, le wizard atterrit directement à l'étape Vigilance (step=2). */
  initialContactId?: string | null
  /** Monté DANS le bento du pager (absolute/z-40, sans logo/header d'app). */
  embedded?: boolean
  /** Pré-sélectionne la voie (« new » = normal, « import » = rapport externe). */
  initialMode?: 'new' | 'import'
  /** Callback à la création (pager) — ouvre la fiche au lieu de naviguer. */
  onCreated?: (id: string) => void
}

export function KycWizardModal({ onClose, initialContactId, embedded = false, initialMode, onCreated }: Props) {
  const { t } = useTranslation('kyc')
  const navigate = useNavigate()
  const sp = useKycPalette()
  const { profile } = useAuth()
  const { contacts = [] } = useContacts()
  const createDossier = useCreateKycDossier()
  const uploadDoc = useUploadKycDocument()

  const preset = !!initialContactId
  const presetSource: WizardSource | null = preset ? 'existing' : initialMode === 'import' ? 'import' : null
  const [step, setStep] = useState<number>(preset ? 2 : 0)
  const [done, setDone] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Sprint 4.7.B — Modal magic link s'ouvre AU-DESSUS du wizard quand
  // source === 'magic' et que le dossier vient d'être créé.
  const [magicModalOpen, setMagicModalOpen] = useState(false)

  const [data, setData] = useState<WizardData>({
    source: presetSource,
    contactId: initialContactId ?? null,
    entityType: 'pp',
    vigilance: null,
    riskLevel: 'low',
    smartReco: 'standard',
    importFile: null,
    importParsed: null,
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
    // En mode embedded, le pager gèle déjà le scroll : ne pas toucher au body.
    if (embedded) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [embedded])

  const canNext = useMemo(() => {
    if (step === 0) return !!data.source
    if (step === 1) return !!data.contactId
    if (step === 2) return data.source === 'import' ? !!data.importParsed : !!data.vigilance
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
    // La voie import ne choisit pas de vigilance → standard par défaut.
    const vigilance = data.source === 'import' ? data.vigilance ?? 'standard' : data.vigilance
    if (!data.contactId || !vigilance || !profile?.agency_id) {
      setError(t('wizard.errors.missingContactVigilance'))
      return
    }
    try {
      const dossier = await createDossier.mutateAsync({
        contactId: data.contactId,
        agencyId: profile.agency_id,
        type: inferKycType(),
        vigilance,
      })
      setCreatedId(dossier.id)
      // Voie import : on attache le rapport au dossier (pièce compliance). Les
      // contrôles pré-remplis restent À VALIDER par l'agent (garde-fou MLRO) —
      // aucune coche automatique ici.
      if (data.source === 'import' && data.importFile && profile.id) {
        try {
          await uploadDoc.mutateAsync({
            kycCaseId: dossier.id,
            agencyId: profile.agency_id,
            file: data.importFile,
            documentCategory: 'compliance',
            uploadedBy: profile.id,
          })
        } catch {
          // Le dossier est créé ; l'attache échouée ne l'annule pas.
        }
      }
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
    if (createdId) {
      // Dans le pager (embedded) : ouvre la fiche en overlay via le parent.
      if (onCreated) onCreated(createdId)
      else navigate(`/dashboard/kyc/${createdId}`)
    }
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
    () =>
      WIZARD_STEPS.map((s, i) => ({
        id: s.id,
        // Voie import : la 3e étape s'intitule « Rapport » (au lieu de Vigilance).
        // Le repli `defaultValue` a été retiré avec l'ajout de la clé dans les
        // quatre langues : il servait de béquille à une clé absente, et faisait
        // donc lire « Rapport » en français à un agent alémanique ou tessinois.
        label:
          i === 2 && data.source === 'import'
            ? t('wizard.steps.report')
            : t(s.labelKey),
      })),
    [t, data.source],
  )

  return (
    <div
      style={{
        position: embedded ? 'absolute' : 'fixed',
        inset: 0,
        zIndex: embedded ? 40 : 9000,
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
          gap: 'var(--crm-space-4xl)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', flexShrink: 0 }}>
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
                  fontSize: 'var(--crm-text-sm)',
                  fontWeight: 600,
                  color: sp.muted,
                                                      whiteSpace: 'nowrap',
                }}
              >
                {t('wizard.header.eyebrow')}
              </div>
              <div
                style={{
                  fontSize: 'var(--crm-text-3xl)',
                  fontWeight: 600,
                  color: sp.ink,
                  letterSpacing: -0.3,
                }}
              >
                {t('wizard.header.title')}
              </div>
            </div>
          </div>
        )}

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
          padding: done ? '32px 32px 80px' : embedded ? '40px 32px 130px' : '160px 32px 140px',
        }}
      >
        {done ? (
          <KwStepSuccess data={data} onOpen={handleOpenCreated} onClose={onClose} />
        ) : (
          <>
            {step === 0 && <KwStepStart data={data} set={set} />}
            {step === 1 && <KwStepContact data={data} set={set} />}
            {step === 2 &&
              (data.source === 'import' ? (
                <KwStepImport data={data} set={set} />
              ) : (
                <KwStepVigilance data={data} set={set} />
              ))}
          </>
        )}

        {error && (
          <div
            style={{
              maxWidth: 720,
              margin: '24px auto 0',
              padding: 'var(--crm-space-xl) var(--crm-space-3xl)',
              background: sp.errSoft,
              color: sp.errDarker,
              borderRadius: 'var(--crm-radius-xl)',
              fontSize: 'var(--crm-text-lg)',
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
            gap: 'var(--crm-space-3xl)',
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
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)' }}>
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
