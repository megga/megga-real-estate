// MEGGA Onboarding — Shell principal
// Source : handoff-onboarding/onboarding/megga-onboarding-app.jsx → ObShell
// Phases : splash → wizard (5 steps) → final.
// Persistance Supabase : full_name / phone / canton / onboarding_step / onboarding_completed.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { OB_GLOBAL_CSS, obPalette } from './tokens'
import { ObBlackPill, ObGhostPill, ObIcon } from './primitives'
import { OnboardingSplash } from './OnboardingSplash'
import { OnboardingFinal } from './OnboardingFinal'
import { StepKYC } from './StepKYC'
import { StepAgence } from './StepAgence'
import { StepProfilAgence } from './StepProfilAgence'
import { StepProfilAgent } from './StepProfilAgent'
import { StepForfait } from './StepForfait'
import {
  saveAgencyProfile,
  saveAgentProfile,
  savePlanOnAgency,
} from './persistence'
import {
  INITIAL_DATA,
  type AgentProfile,
  type OnboardingData,
} from './types'

const STEPS = [
  { id: 'kyc', label: 'Conformité' },
  { id: 'agence', label: 'Agence' },
  { id: 'agency', label: 'Profil agence' },
  { id: 'profile', label: 'Profil' },
  { id: 'forfait', label: 'Forfait' },
] as const

type Phase = 'splash' | 'wizard' | 'final'

export function OnboardingShell({ dark = false }: { dark?: boolean }) {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  // Pre-fill from profile if we already know the agent's first name
  const initialAgent: AgentProfile | undefined = profile?.full_name
    ? {
        firstName: profile.full_name.split(' ')[0] ?? '',
        lastName: profile.full_name.split(' ').slice(1).join(' '),
        avatar: profile.avatar_url ?? null,
        role: 'courtier',
        phone: profile.phone ?? '',
        languages: ['fr'],
      }
    : undefined

  const [phase, setPhase] = useState<Phase>('splash')
  const [step, setStep] = useState(0)
  const [replayKey, _setReplayKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setDataRaw] = useState<OnboardingData>(() => ({
    ...INITIAL_DATA,
    ...(initialAgent ? { agentProfile: initialAgent } : {}),
  }))
  const set: (patch: Partial<OnboardingData>) => void = (patch) =>
    setDataRaw((prev) => ({ ...prev, ...patch }))

  const t = obPalette(dark)

  // When the Agence step signals done, auto-advance
  useEffect(() => {
    if (data._agenceDone) {
      set({ _agenceDone: false })
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data._agenceDone])

  const canNext = useMemo(() => {
    if (step === 1) {
      return data.agenceValidated || !!data.agenceCreated
    }
    if (step === 3) {
      const ap = data.agentProfile
      return !!(ap?.firstName?.trim() && ap?.lastName?.trim() && ap.role)
    }
    if (step === 4) return !!data.plan
    return true
  }, [step, data])

  const splashFirstName = data.agentProfile?.firstName || 'Marie'

  const persistProgress = async (nextStep: number) => {
    if (!profile) return
    await supabase
      .from('profiles')
      .update({ onboarding_step: nextStep })
      .eq('id', profile.id)
  }

  const next = async () => {
    if (step < STEPS.length - 1) {
      const ns = step + 1
      setStep(ns)
      void persistProgress(ns)
    } else {
      // last step (Forfait) → finalize, persist, jump to final screen
      await finalizeOnboarding()
      setPhase('final')
    }
  }

  const prev = () => setStep((s) => Math.max(s - 1, 0))

  const finalizeOnboarding = async () => {
    if (!profile || saving) return
    setSaving(true)
    try {
      // 1. Agent profile (full_name, phone, avatar_url, agent_role, spoken_languages)
      await saveAgentProfile(profile.id, data)

      // 2. Canton + onboarding_step on profile (the agent_role / spoken_languages
      //    updates went through saveAgentProfile, but canton lives on profile too).
      const canton =
        data.agenceCreated?.canton ??
        data.agenceSelected?.canton ??
        profile.canton ??
        null
      await supabase
        .from('profiles')
        .update({ canton, onboarding_step: STEPS.length })
        .eq('id', profile.id)

      // 3. Agency profile (logo, address, contact) — only for agencies the user
      //    created (joined ones are owned by the existing admin).
      const ownedAgencyId = data.agenceCreatedId
      if (ownedAgencyId) {
        const ap = data.agenceProfile
        if (ap) {
          await saveAgencyProfile(ownedAgencyId, {
            name: ap.name,
            city: ap.city,
            canton: ap.canton,
            street: ap.street,
            npa: ap.npa,
            phone: ap.phone,
            website: ap.website,
            logoUrl: ap.logo,
          })
        }
        // 4. Plan + billing on the owned agency
        if (data.plan) {
          await savePlanOnAgency(ownedAgencyId, data.plan, data.billing)
        }
      }

      await refreshProfile()
    } finally {
      setSaving(false)
    }
  }

  const enterCrm = async () => {
    if (!profile) {
      // Pas de profil chargé : le ProtectedRoute du Premier jour gérera la suite.
      navigate('/dashboard/premier-jour', { replace: true })
      return
    }
    setSaving(true)
    try {
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_step: STEPS.length,
        })
        .eq('id', profile.id)
      await refreshProfile()
    } finally {
      setSaving(false)
      // Sortie de l'onboarding → sas Premier jour (calibrage IA + Today fantôme).
      // Si l'agent l'a déjà joué (relogin), ProtectedRoute le by-passera vers
      // /dashboard automatiquement.
      navigate('/dashboard/premier-jour', { replace: true })
    }
  }

  const body = (() => {
    if (step === 0) return <StepKYC dark={dark} />
    if (step === 1) return <StepAgence data={data} set={set} dark={dark} />
    if (step === 2)
      return <StepProfilAgence data={data} set={set} dark={dark} />
    if (step === 3)
      return <StepProfilAgent data={data} set={set} dark={dark} />
    if (step === 4) return <StepForfait data={data} set={set} dark={dark} />
    return null
  })()

  return (
    <div
      data-screen-label="00 Onboarding"
      style={{
        minHeight: '100vh',
        background: t.bgGradient,
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: t.ink,
      }}
    >
      <style>{OB_GLOBAL_CSS}</style>

      {phase === 'splash' && (
        <OnboardingSplash
          onDone={() => setPhase('wizard')}
          prenom={splashFirstName}
          dark={dark}
          replayKey={replayKey}
        />
      )}

      {phase === 'wizard' && (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            animation: 'obFadeIn .6s ease both',
          }}
        >
          <header
            style={{
              padding: '22px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: dark
                ? 'linear-gradient(180deg, rgba(14,14,20,0.95) 0%, rgba(14,14,20,0.85) 80%, transparent 100%)'
                : 'linear-gradient(180deg, rgba(237,239,243,0.95) 0%, rgba(237,239,243,0.85) 80%, transparent 100%)',
              backdropFilter: 'blur(8px)',
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
                  height: 32,
                  width: 'auto',
                  filter: dark ? 'invert(1)' : 'none',
                }}
              />
            </div>
            <div style={{ flex: 1 }} />
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: t.muted,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {step + 1} / {STEPS.length}
            </div>
          </header>

          <main key={step} style={{ flex: 1, padding: '32px 32px 140px' }}>
            {body}
          </main>

          <footer
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '22px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              zIndex: 20,
              background: dark
                ? 'linear-gradient(180deg, transparent 0%, rgba(14,14,20,0.92) 60%, rgba(14,14,20,1) 100%)'
                : 'linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.92) 60%, rgba(237,239,243,1) 100%)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ pointerEvents: 'auto' }}>
              {step > 0 && (
                <ObGhostPill
                  onClick={prev}
                  dark={dark}
                  icon={<ObIcon name="arrowL" size={16} stroke={t.inkSoft} />}
                >
                  Précédent
                </ObGhostPill>
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
              {step !== 1 && (
                <ObBlackPill
                  onClick={next}
                  disabled={!canNext || saving}
                  dark={dark}
                  icon={
                    <ObIcon
                      name="arrowR"
                      size={16}
                      stroke={dark ? '#0B0C0E' : '#fff'}
                    />
                  }
                >
                  {step === STEPS.length - 1 ? 'Terminer' : 'Continuer'}
                </ObBlackPill>
              )}
              {step === 1 && canNext && (
                <ObBlackPill
                  onClick={next}
                  dark={dark}
                  icon={
                    <ObIcon
                      name="arrowR"
                      size={16}
                      stroke={dark ? '#0B0C0E' : '#fff'}
                    />
                  }
                >
                  Continuer
                </ObBlackPill>
              )}
            </div>
          </footer>
        </div>
      )}

      {phase === 'final' && (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 32px',
          }}
        >
          <OnboardingFinal data={data} dark={dark} onEnter={enterCrm} />
        </div>
      )}
    </div>
  )
}
