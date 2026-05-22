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

// ─── ObThemeToggle (sun/moon, palette Sugar Pure) ──────────────────────
// Cercle 40×40, crossfade + rotate des deux icônes. Aria-label inversé
// (affiche la cible, pas l'état actuel).

const SunIcon = (
  <svg
    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
  </svg>
)
const MoonIcon = (
  <svg
    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

function ObThemeToggle({
  dark, onChange, t,
}: {
  dark: boolean
  onChange: (theme: 'light' | 'dark') => void
  t: ReturnType<typeof obPalette>
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={() => onChange(dark ? 'light' : 'dark')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      style={{
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? t.card : t.cardSubtle,
        border: 0,
        borderRadius: 999,
        boxShadow: hover ? t.shadow : t.shadowSm,
        color: t.ink,
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(.22,1,.36,1)',
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dark ? 0 : 1,
          transform: dark ? 'rotate(-30deg) scale(0.8)' : 'rotate(0) scale(1)',
          transition: 'opacity 0.32s cubic-bezier(.22,1,.36,1), transform 0.32s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {MoonIcon}
      </span>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dark ? 1 : 0,
          transform: dark ? 'rotate(0) scale(1)' : 'rotate(30deg) scale(0.8)',
          transition: 'opacity 0.32s cubic-bezier(.22,1,.36,1), transform 0.32s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {SunIcon}
      </span>
    </button>
  )
}

// ─── Theme persistence (cookie megga.theme, partagé avec le bento auth) ─

const COOKIE_KEY = 'megga.theme'

function readThemeCookie(): 'light' | 'dark' | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_KEY}=`))
  if (!match) return null
  const v = match.split('=')[1]
  return v === 'dark' || v === 'light' ? v : null
}

function writeThemeCookie(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_KEY}=${theme}; Max-Age=31536000; Path=/; SameSite=Lax`
  document.documentElement.dataset.theme = theme
}

function resolveInitialTheme(): 'light' | 'dark' {
  const cookie = readThemeCookie()
  if (cookie) return cookie
  if (typeof window !== 'undefined') {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  }
  return 'light'
}

export function OnboardingShell({ dark: darkProp }: { dark?: boolean } = {}) {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  // Theme : prop > cookie > prefers-color-scheme > light.
  // Permet d'embarquer un theme parent (via prop) tout en gardant
  // le wizard pilotable indépendamment.
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    darkProp !== undefined ? (darkProp ? 'dark' : 'light') : resolveInitialTheme(),
  )
  const dark = theme === 'dark'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const onThemeChange = (next: 'light' | 'dark') => {
    setTheme(next)
    writeThemeCookie(next)
  }

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
        transition:
          'background 0.35s cubic-bezier(.22,1,.36,1), color 0.35s cubic-bezier(.22,1,.36,1)',
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
            {/* Theme toggle sun/moon — partage le cookie megga.theme avec
                le bento auth pour une cohérence entre les 2 modules */}
            <ObThemeToggle dark={dark} onChange={onThemeChange} t={t} />
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
