// MEGGA CRM Sugar v3 — Page KYC (pager 2 pages + fiche stricte + onboarding)
// Refonte « nouveau KYC » (handoff KYC.zip) : l'écran KYC devient un PAGER à
// deux pages verticales (Dossiers · Vigie) dans un cadre bento, avec la fiche en
// overlay et le wizard embedded. La donnée reste Supabase LIVE.
//
// Routes :
//  - /dashboard/kyc                    → pager (page 0 = liste, page 1 = vigie)
//  - /dashboard/kyc/:dossierId         → pager + fiche en overlay (deep-link)
//  - /dashboard/kyc/bienvenue          → onboarding (KycOnboardingPage)
//  - /dashboard/kyc?openContactId=:id  → deep-link contact (fiche ou wizard)
//
// Onboarding : gate empty-state (flag localStorage megga.kyc.onboarded + 0 dossier).

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { SUGAR_V3_FONT, SUGAR_V3_KEYFRAMES } from '@/components/crm-sugar-v3/tokens'
import {
  KycPaletteContext,
  buildKycPalette,
  KYC_KEYFRAMES,
} from '@/components/crm-sugar-v3/kyc/kycPalette'
import { KycPagerFrame, type KycWizardControl } from '@/components/crm-sugar-v3/kyc-pager/KycPagerFrame'
import { kypSurf, KYP_KEYFRAMES } from '@/components/crm-sugar-v3/kyc-pager/kypTokens'
import { isKycOnboarded, markKycOnboarded } from '@/lib/kycOnboarding'
import { useKycDossiers, useKycDossierByContact } from '@/hooks/useKycDossier'

export default function KycSugarV3Page() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const sp = useMemo(() => crmSugarPalette(dark), [dark])
  const kycSp = useMemo(() => buildKycPalette(dark, sp), [dark, sp])
  const surf = useMemo(() => kypSurf(dark), [dark])

  // ─── Gate onboarding (empty-state) ────────────────────────────────────
  const [onboarded, setOnboarded] = useState<boolean>(() => isKycOnboarded())
  const {
    data: dossiers,
    isLoading: dossiersLoading,
    isError: dossiersError,
  } = useKycDossiers(undefined, { enabled: !onboarded })
  // Empty-state = requête ABOUTIE et vide. Une requête en erreur (timeout/RLS)
  // ne doit PAS être confondue avec « aucun dossier » (sinon fausse redirection).
  const dossiersEmpty = !dossiersError && (dossiers?.length ?? 0) === 0
  useEffect(() => {
    if (onboarded || dossiersLoading || dossiersError) return
    if (dossiersEmpty) {
      navigate('/dashboard/kyc/bienvenue', { replace: true })
    } else {
      markKycOnboarded()
      setOnboarded(true)
    }
  }, [onboarded, dossiersLoading, dossiersError, dossiersEmpty, navigate])

  // ─── État wizard (levé ici) ───────────────────────────────────────────
  const [wizard, setWizard] = useState<KycWizardControl | null>(() => {
    const s = (location.state as { openWizard?: 'new' | 'import' } | null)?.openWizard
    return s === 'new' || s === 'import' ? { mode: s } : null
  })
  // Consomme le state de navigation une fois (évite la ré-ouverture au retour).
  useEffect(() => {
    if ((location.state as { openWizard?: string } | null)?.openWizard) {
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Deep-link ?openContactId= ────────────────────────────────────────
  const openContactId = searchParams.get('openContactId')
  const { data: deepLinkDossier } = useKycDossierByContact(openContactId ?? undefined)
  useEffect(() => {
    if (!openContactId || deepLinkDossier === undefined) return // en cours de chargement
    if (deepLinkDossier) {
      // TOUT dossier existant → fiche, y compris `none` (la fiche gère ce statut :
      // « Dossier non démarré » + screening au réveil). Surtout PAS le wizard :
      // son finish() INSÈRE un nouveau kyc_cases → doublon indélébile (rétention
      // 10 ans, aucune unicité sur contact_id). `navigate` vers le nouveau chemin
      // abandonne déjà le query param ; ne PAS enchaîner setSearchParams (il
      // re-naviguerait vers la liste et écraserait cette navigation).
      navigate(`/dashboard/kyc/${deepLinkDossier.id}`, { replace: true })
      return
    }
    // Aucun dossier (null) → wizard pré-rempli sur ce contact.
    setWizard({ mode: 'new', contactId: openContactId })
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('openContactId')
      return next
    })
  }, [openContactId, deepLinkDossier, navigate, setSearchParams])

  // ?risk= : la refonte n'a plus d'onglet risque dédié ; on nettoie le param
  // (les dossiers à risque élevé sont déjà remontés en tête de liste).
  useEffect(() => {
    if (searchParams.get('risk')) {
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
      case 'parcours': navigate('/dashboard/journey'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      case 'audit': navigate('/dashboard/audit'); break
      default:
    }
  }
  const onCmd = () => {}

  // Anti-flash : tant que le gate n'est pas résolu, écran neutre (pas de pager
  // clignotant avant la redirection vers l'onboarding).
  // Splash anti-flash uniquement pendant la résolution du gate. Sur erreur, on
  // rend le pager (qui affiche son propre état d'erreur), pas un splash figé.
  const gatePending = !onboarded && !dossiersError && (dossiersLoading || dossiersEmpty)

  return (
    <KycPaletteContext.Provider value={kycSp}>
      <div
        data-screen-label="CRM KYC (pager)"
        style={{
          height: '100vh',
          width: '100%',
          background: sp.pageBg,
          fontFamily: SUGAR_V3_FONT,
          color: kycSp.ink,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <style>{SUGAR_KEYFRAMES}</style>
        <style>{SUGAR_V3_KEYFRAMES}</style>
        <style>{KYC_KEYFRAMES}</style>
        <style>{KYP_KEYFRAMES}</style>

        <SugarTopNav active={'kyc' as SugarScreenId} sp={sp} onNavigate={onNavigate} onCmd={onCmd} dark={dark} />

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <SugarIconRail active="kyc" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />

          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', padding: '22px 24px 22px 0' }}>
            {gatePending ? (
              <div style={{ height: '100%', borderRadius: 26, background: sp.pageBg }} />
            ) : (
              <KycPagerFrame
                sp={sp}
                surf={surf}
                dark={dark}
                agentId={profile?.id ?? ''}
                dossierId={routeDossierId}
                onOpenDossier={(id) => navigate(`/dashboard/kyc/${id}`)}
                onCloseDossier={() => navigate('/dashboard/kyc')}
                wizard={wizard}
                onOpenWizard={(mode) => setWizard({ mode })}
                onCloseWizard={() => setWizard(null)}
                onWizardCreated={(id) => {
                  setWizard(null)
                  navigate(`/dashboard/kyc/${id}`)
                }}
                onNavigate={onNavigate}
              />
            )}
          </main>
        </div>
      </div>
    </KycPaletteContext.Provider>
  )
}
