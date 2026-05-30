// MEGGA Onboarding — Shell principal
// Source : handoff-onboarding/onboarding/megga-onboarding-app.jsx → ObShell
// Phases : splash → wizard (5 steps) → final.
// Persistance Supabase : full_name / phone / canton / onboarding_step / onboarding_completed.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { OB_GLOBAL_CSS, obPalette } from './tokens'
import { ObBlackPill, ObGhostPill, ObIcon } from './primitives'
import { OnboardingSplash } from './OnboardingSplash'
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
import { clearLocalState as clearDay0LocalState } from '@/components/premier-jour-sugar/persistence'
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

type Phase = 'splash' | 'wizard'

// ─── ObThemeToggle (sun/moon animé pathLength, palette Sugar Pure) ─────
// Cercle 40×40 avec animation framer-motion : les rayons du soleil
// "se dessinent / se déchirent" et la lune apparaît via pathLength.
// Aria-label inversé (affiche la cible, pas l'état actuel).

const SUN_PATHS = [
  // Centre du soleil
  'M12.4058 17.7625C15.1672 17.7625 17.4058 15.5239 17.4058 12.7625C17.4058 10.0011 15.1672 7.76251 12.4058 7.76251C9.64434 7.76251 7.40576 10.0011 7.40576 12.7625C7.40576 15.5239 9.64434 17.7625 12.4058 17.7625Z',
  // 8 rayons
  'M12.4058 1.76251V3.76251',
  'M12.4058 21.7625V23.7625',
  'M4.62598 4.98248L6.04598 6.40248',
  'M18.7656 19.1225L20.1856 20.5425',
  'M1.40576 12.7625H3.40576',
  'M21.4058 12.7625H23.4058',
  'M4.62598 20.5425L6.04598 19.1225',
  'M18.7656 6.40248L20.1856 4.98248',
] as const

const MOON_PATH =
  'M21.1918 13.2013C21.0345 14.9035 20.3957 16.5257 19.35 17.8781C18.3044 19.2305 16.8953 20.2571 15.2875 20.8379C13.6797 21.4186 11.9398 21.5294 10.2713 21.1574C8.60281 20.7854 7.07479 19.9459 5.86602 18.7371C4.65725 17.5283 3.81774 16.0003 3.4457 14.3318C3.07367 12.6633 3.18451 10.9234 3.76526 9.31561C4.346 7.70783 5.37263 6.29868 6.72501 5.25307C8.07739 4.20746 9.69959 3.56862 11.4018 3.41132C10.4052 4.75958 9.92564 6.42077 10.0503 8.09273C10.175 9.76469 10.8957 11.3364 12.0812 12.5219C13.2667 13.7075 14.8384 14.4281 16.5104 14.5528C18.1823 14.6775 19.8435 14.1979 21.1918 13.2013Z'

function SolarSwitch({ isDark }: { isDark: boolean }) {
  const duration = 0.7
  const sunVariants = {
    light: { pathLength: 1, opacity: 1, scale: 1 },
    dark: { pathLength: 0, opacity: 0, scale: 0 },
  }
  const moonVariants = {
    light: { pathLength: 0, opacity: 0, scale: 0 },
    dark: { pathLength: 1, opacity: 1, scale: 1 },
  }
  return (
    <motion.svg
      width="20"
      height="20"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={false}
      animate={isDark ? 'dark' : 'light'}
    >
      {SUN_PATHS.map((d, i) => (
        <motion.path
          key={`sun-${i}`}
          d={d}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={sunVariants}
          transition={{ duration }}
        />
      ))}
      <motion.path
        d={MOON_PATH}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={moonVariants}
        transition={{ duration }}
      />
    </motion.svg>
  )
}

export function ObThemeToggle({
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
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 999,
        boxShadow: hover ? t.shadow : t.shadowSm,
        color: t.ink,
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(.22,1,.36,1)',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <SolarSwitch isDark={dark} />
    </button>
  )
}

// ─── Theme persistence (cookie megga.theme, partagé avec le bento auth) ─

const COOKIE_KEY = 'megga.theme'

export function readThemeCookie(): 'light' | 'dark' | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_KEY}=`))
  if (!match) return null
  const v = match.split('=')[1]
  return v === 'dark' || v === 'light' ? v : null
}

export function writeThemeCookie(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_KEY}=${theme}; Max-Age=31536000; Path=/; SameSite=Lax`
  document.documentElement.dataset.theme = theme
}

export function resolveInitialTheme(): 'light' | 'dark' {
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
  const [error, setError] = useState<string | null>(null)
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

  const splashFirstName =
    data.agentProfile?.firstName || profile?.full_name?.split(' ')[0] || ''

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
      // Last step (Forfait) → finalize + go directly to /dashboard.
      // L'écran "Bienvenue, Marie." (OnboardingFinal) est skipped : on
      // saute direct au "Premier jour" (la vue Aujourd'hui du CRM).
      const ok = await finalizeOnboarding()
      // Échec d'une écriture critique → on n'entre PAS (onboarding_completed
      // n'est pas marqué) ; l'erreur est affichée et l'agent peut réessayer.
      if (!ok) return
      await enterCrm()
    }
  }

  const prev = () => {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  const finalizeOnboarding = async (): Promise<boolean> => {
    if (!profile || saving) return false
    setSaving(true)
    setError(null)
    try {
      // 1. Agent profile (full_name, phone, avatar_url, agent_role, spoken_languages)
      //    — CRITIQUE : sans ça, le profil agent est incomplet.
      const okAgent = await saveAgentProfile(profile.id, data)
      if (!okAgent) {
        setError(
          "Impossible d'enregistrer votre profil. Vérifiez votre connexion et réessayez.",
        )
        return false
      }

      // 2. Canton + onboarding_step on profile — CRITIQUE.
      const canton =
        data.agenceCreated?.canton ??
        data.agenceSelected?.canton ??
        profile.canton ??
        null
      const { error: cantonErr } = await supabase
        .from('profiles')
        .update({ canton, onboarding_step: STEPS.length })
        .eq('id', profile.id)
      if (cantonErr) {
        setError('Impossible de finaliser votre profil. Réessayez.')
        return false
      }

      // 3. Agency profile (logo, address, contact) + plan — best-effort, pour les
      //    agences créées (les agences rejointes appartiennent à l'admin existant).
      //    Un échec ici ne bloque pas l'entrée : modifiable ensuite dans les réglages.
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
        if (data.plan) {
          await savePlanOnAgency(ownedAgencyId, data.plan, data.billing)
        }
      }

      await refreshProfile()
      return true
    } catch {
      setError('Une erreur est survenue. Réessayez.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const enterCrm = async () => {
    // Clear localStorage Premier jour : on arrive frais de l'onboarding, on doit
    // démarrer au D0Welcome, pas reprendre une session antérieure (testing OK,
    // prod OK car la reprise est pour les fermetures de tab mid-flow et non pour
    // les sorties d'onboarding qui marquent toujours un fresh start).
    clearDay0LocalState()

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
              {error && (
                <span
                  role="alert"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#DC2626',
                    maxWidth: 320,
                    lineHeight: 1.4,
                  }}
                >
                  {error}
                </span>
              )}
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

    </div>
  )
}
