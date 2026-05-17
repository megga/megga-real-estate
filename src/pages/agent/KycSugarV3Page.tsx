// MEGGA CRM Sugar v3 — Page KYC (liste + détail)
// Port pixel-près du CRMScreenKycSugar (handoff lignes 758-870).
//
// Routes :
//  - /dashboard/kyc                       → KycListView
//  - /dashboard/kyc/:dossierId            → KycDossierDetail
//  - /dashboard/kyc?openContactId=:id     → deep-link contact → KYC
//                                          (ouvre dossier existant ou lance le wizard)
//
// Spec deep-link : KYC_ENRICHISSEMENTS §6 — query param, pas variable globale.

import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import { SugarV3, SUGAR_V3_KEYFRAMES } from '@/components/crm-sugar-v3/tokens'
import { KycListView } from '@/components/crm-sugar-v3/kyc/KycListView'
import { KycDossierDetail } from '@/components/crm-sugar-v3/kyc/KycDossierDetail'
import { KycWizardModal } from '@/components/crm-sugar-v3/kyc-wizard/KycWizardModal'
import { useKycDossierByContact } from '@/hooks/useKycDossier'

const DARK_TONE: DarkTone = 'meggaAi'

type FilterKey = 'all' | 'blocking' | 'pending' | 'none' | 'verified' | 'risk'

export default function KycSugarV3Page() {
  const navigate = useNavigate()
  const { dossierId: routeDossierId } = useParams<{ dossierId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile } = useAuth()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = useMemo(() => crmSugarPalette(t, dark, DARK_TONE), [t, dark])

  const [filter, setFilter] = useState<FilterKey>('all')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardInitialContact, setWizardInitialContact] = useState<string | null>(
    null,
  )

  // Deep-link via query param ?openContactId=...
  const openContactId = searchParams.get('openContactId')
  const { data: deepLinkDossier } = useKycDossierByContact(openContactId ?? undefined)

  // Snapshot des deep-link params au premier render — ainsi les deux flows
  // (openContactId pour le wizard, risk pour le filtre) ne se court-circuitent
  // PAS via les setSearchParams concurrents. On nettoie l'URL en une seule passe
  // dans l'effect de consommation, après les avoir tous lus.
  const [initialDeepLink] = useState(() => ({
    openContactId: searchParams.get('openContactId'),
    risk: searchParams.get('risk'),
  }))

  useEffect(() => {
    if (!openContactId) return
    // Si un dossier existe pour ce contact, naviguer vers son détail
    if (deepLinkDossier && deepLinkDossier.dossier_status !== 'none') {
      navigate(`/dashboard/kyc/${deepLinkDossier.id}`, { replace: true })
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('openContactId')
        return next
      })
      return
    }
    // Pas de dossier → ouvrir le wizard pré-rempli à l'étape Vigilance
    if (deepLinkDossier === null) {
      setWizardInitialContact(openContactId)
      setWizardOpen(true)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('openContactId')
        return next
      })
    }
  }, [openContactId, deepLinkDossier, navigate, setSearchParams])

  // Deep-link depuis le Dashboard Analytics : `?risk=high` ouvre la liste
  // filtrée sur les dossiers à risque élevé. On consomme le snapshot initial,
  // pas `searchParams.get('risk')` qui aurait pu être effacé entre-temps par
  // l'effet `openContactId` (race condition documentée — red-team audit).
  useEffect(() => {
    if (initialDeepLink.risk === 'high' || initialDeepLink.risk === 'risk') {
      setFilter('risk')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('risk')
        return next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'parcours': navigate('/dashboard/parcours'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'docs': navigate('/dashboard/documents'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      case 'audit': navigate('/dashboard/audit'); break
      default:
    }
  }
  const onCmd = () => {}

  return (
    <div
      data-screen-label="CRM KYC (sugar v3)"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: SugarV3.bgGradient,
        fontFamily: SugarV3.font,
        color: SugarV3.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{SUGAR_V3_KEYFRAMES}</style>

      <SugarTopNav
        active={'kyc' as SugarScreenId}
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="kyc"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main className="sg-main-padded" style={{ flex: 1, minWidth: 0, padding: '100px 40px 120px 40px' }}>
          {routeDossierId ? (
            <KycDossierDetail
              dossierId={routeDossierId}
              agentId={profile?.id ?? ''}
              onBack={() => navigate('/dashboard/kyc')}
            />
          ) : (
            <KycListView
              onOpen={(id) => navigate(`/dashboard/kyc/${id}`)}
              onNewDossier={() => {
                setWizardInitialContact(null)
                setWizardOpen(true)
              }}
              filter={filter}
              setFilter={setFilter}
            />
          )}
        </main>
      </div>

      {/* Wizard KYC 3 étapes — portail z-9000 */}
      {wizardOpen && (
        <KycWizardModal
          initialContactId={wizardInitialContact}
          onClose={() => {
            setWizardOpen(false)
            setWizardInitialContact(null)
          }}
        />
      )}
    </div>
  )
}
