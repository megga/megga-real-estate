// MEGGA Premier jour — Shell d'orchestration
// Phases : welcome → q0 → q1 → q2 → q3 → synthesis → today
// État des réponses + autonomy + checklist + demo mode.
// Idempotence : si profile.first_day_done === true, on bypass.
// Reprise : si localStorage contient une phase + answers, on reprend.
//
// Source : handoff-premier-jour/premier-jour/crm-day0-app.jsx → D0App
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { OB_GLOBAL_CSS, obPalette } from '@/components/onboarding-sugar/tokens'
import {
  resolveInitialTheme,
  writeThemeCookie,
} from '@/components/onboarding-sugar/OnboardingShell'
import { D0_CSS } from './tokens'
import { D0Welcome } from './D0Welcome'
import { D0QuestionScreen } from './D0Question'
import { D0Synthesis } from './D0Synthesis'
import { D0TodayPremierJour } from './D0Today'
import { useActivationChecklist } from '@/hooks/useActivationChecklist'
import {
  D0_PRIORITY_ROUTES,
  D0_PRIORITY_TO_CHECKLIST,
  D0_QUESTIONS,
} from './data'
import {
  clearLocalState,
  loadLocalState,
  saveDay0Payload,
  saveLocalAnswers,
  saveLocalAutonomy,
  saveLocalPhase,
} from './persistence'
import {
  D0_PHASES,
  INITIAL_ANSWERS,
  SKIP_DEFAULTS,
  type Autonomy,
  type D0Answers,
  type D0Payload,
  type D0Phase,
  type Dispo,
  type Priorite,
  type Specialite,
} from './types'

// Map de réponses pour les valeurs par défaut du skip (côté client en attendant
// DAY0_SKIP_DEFAULTS env serveur — cf. handoff §"Skip").
const skipAnswers = (): D0Answers => ({
  specialite: SKIP_DEFAULTS.specialite,
  zone: [...SKIP_DEFAULTS.zone],
  dispo: SKIP_DEFAULTS.dispo,
  priorite: SKIP_DEFAULTS.priorite,
})

export function PremierJourShell({
  dark: darkProp,
}: {
  dark?: boolean
} = {}) {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  // Theme : prop > cookie > prefers-color-scheme > light (même logique que
  // l'OnboardingShell, partage le cookie `megga.theme` avec le bento auth).
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

  const t = obPalette(dark)

  // Restauration depuis localStorage au montage (une fois)
  const [phase, setPhaseState] = useState<D0Phase>(() => {
    const ls = loadLocalState()
    return ls.phase ?? 'welcome'
  })
  const [answers, setAnswersState] = useState<D0Answers>(() => {
    const ls = loadLocalState()
    return ls.answers ?? INITIAL_ANSWERS
  })
  const [autonomy, setAutonomyState] = useState<Autonomy>(() => {
    const ls = loadLocalState()
    return ls.autonomy ?? 'suggest'
  })

  // La checklist est gérée par le hook (persistance Supabase + optimistic
  // updates). Le shell expose juste setAll/markDone aux composants enfants.
  const checklistHook = useActivationChecklist()
  const [demoLoaded, setDemoLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  // Wrappers de setters qui persistent en localStorage
  const setPhase = useCallback((p: D0Phase) => {
    setPhaseState(p)
    saveLocalPhase(p)
  }, [])
  const setAnswers = useCallback(
    (updater: D0Answers | ((prev: D0Answers) => D0Answers)) => {
      setAnswersState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        saveLocalAnswers(next)
        return next
      })
    },
    [],
  )
  const setAutonomy = useCallback((a: Autonomy) => {
    setAutonomyState(a)
    saveLocalAutonomy(a)
  }, [])

  // Identité de l'agent — fallback sur "Marie" si pas encore chargé.
  const firstName = profile?.full_name?.split(' ')[0] || 'Marie'
  const lastName = profile?.full_name?.split(' ').slice(1).join(' ') || 'Schaeffer'
  const initials =
    ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || 'MS'
  const agence = 'Votre agence'

  // Setter typé pour une question donnée
  const setSpecialite = (v: Specialite) =>
    setAnswers((a) => ({ ...a, specialite: v }))
  const setZone = (v: string[]) => setAnswers((a) => ({ ...a, zone: v }))
  const setDispo = (v: Dispo) => setAnswers((a) => ({ ...a, dispo: v }))
  const setPriorite = (v: Priorite) =>
    setAnswers((a) => ({ ...a, priorite: v }))

  // ─── Navigation entre questions ────────────────────────────────
  const currentQ = phase.startsWith('q') ? parseInt(phase.slice(1), 10) : -1

  const handleQNext = () => {
    if (currentQ < 3) setPhase(`q${currentQ + 1}` as D0Phase)
    else setPhase('synthesis')
  }
  const handleQPrev = () => {
    if (currentQ > 0) setPhase(`q${currentQ - 1}` as D0Phase)
    else setPhase('welcome')
  }
  const handleSkipAll = () => {
    setAnswers(skipAnswers())
    setAutonomy(SKIP_DEFAULTS.autonomy)
    setPhase('today')
  }

  // ─── Mode démo (dev/staging only) — coche/décoche les 5 items en bulk
  // pour visualiser une checklist complète sans avoir à toucher 5 boutons.
  const onLoadDemo = () => {
    setDemoLoaded((d) => {
      const next = !d
      checklistHook.setAll(next)
      return next
    })
  }

  // ─── Sortie du sas : persistance + redirect vers route cible ────
  // Si `target` est fourni, on route directement vers cette page CRM.
  // Sinon, /dashboard (atterrissage par défaut depuis la synthèse).
  const enterCrm = async (target: string = '/dashboard') => {
    if (saving) return
    setSaving(true)
    try {
      // Sécurité : on ne soumet que si toutes les réponses sont là.
      if (
        profile?.id &&
        answers.specialite &&
        answers.zone.length > 0 &&
        answers.dispo &&
        answers.priorite
      ) {
        const payload: D0Payload = {
          specialite: answers.specialite,
          zone: answers.zone,
          dispo: answers.dispo,
          priorite: answers.priorite,
          autonomy,
        }
        await saveDay0Payload(profile.id, payload)
        await refreshProfile()
      }
      clearLocalState()
    } catch {
      // En cas d'erreur (RLS, réseau), on n'empêche pas l'agent d'entrer.
      // Le gate ProtectedRoute rejouera le sas au prochain refresh si nécessaire.
    } finally {
      setSaving(false)
      navigate(target, { replace: true })
    }
  }

  // Auto-pré-remplissage si on saute directement à synthesis/today
  useEffect(() => {
    if (phase === 'synthesis' || phase === 'today') {
      setAnswers((prev) => ({
        specialite: prev.specialite ?? SKIP_DEFAULTS.specialite,
        zone: prev.zone.length > 0 ? prev.zone : [...SKIP_DEFAULTS.zone],
        dispo: prev.dispo ?? SKIP_DEFAULTS.dispo,
        priorite: prev.priorite ?? SKIP_DEFAULTS.priorite,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Clic sur une carte priorité du Today Premier jour :
  // 1. coche l'item correspondant de la checklist (idempotent via le hook)
  // 2. quitte le sas et route vers la vraie page CRM (D0_PRIORITY_ROUTES)
  // Fallback /dashboard si l'id n'a pas de route mappée.
  const onPriorityClick = (cardId: string) => {
    const checklistId = D0_PRIORITY_TO_CHECKLIST[cardId]
    if (checklistId) {
      // Le hook gère l'idempotence (skip si déjà done) et la persistance.
      checklistHook.markDone(checklistId)
    }
    const target = D0_PRIORITY_ROUTES[cardId] ?? '/dashboard'
    void enterCrm(target)
  }

  // ─── Rendu par phase ────────────────────────────────────────────
  let body: React.ReactNode = null

  if (phase === 'welcome') {
    body = (
      <D0Welcome
        prenom={firstName}
        dark={dark}
        onStart={() => setPhase('q0')}
        onSkip={handleSkipAll}
        onThemeChange={onThemeChange}
      />
    )
  } else if (phase.startsWith('q') && currentQ >= 0 && currentQ <= 3) {
    const q = D0_QUESTIONS[currentQ]
    const currentValue: string | string[] | null =
      currentQ === 0
        ? answers.specialite
        : currentQ === 1
          ? answers.zone
          : currentQ === 2
            ? answers.dispo
            : answers.priorite
    body = (
      <D0QuestionScreen
        q={q}
        index={currentQ}
        total={4}
        value={currentValue}
        onChange={(v) => {
          if (currentQ === 0) setSpecialite(v as Specialite)
          else if (currentQ === 1) setZone(v as string[])
          else if (currentQ === 2) setDispo(v as Dispo)
          else if (currentQ === 3) setPriorite(v as Priorite)
        }}
        onPrev={handleQPrev}
        onNext={handleQNext}
        dark={dark}
        onThemeChange={onThemeChange}
      />
    )
  } else if (phase === 'synthesis') {
    body = (
      <D0Synthesis
        prenom={firstName}
        answers={answers}
        autonomy={autonomy}
        setAutonomy={setAutonomy}
        onEnter={() => setPhase('today')}
        onEditQuestion={(i) => setPhase(`q${i}` as D0Phase)}
        dark={dark}
      />
    )
  } else if (phase === 'today') {
    body = (
      <D0TodayPremierJour
        prenom={firstName}
        agence={agence}
        initials={initials}
        answers={answers}
        autonomy={autonomy}
        demoLoaded={demoLoaded}
        onLoadDemo={onLoadDemo}
        onPriorityClick={onPriorityClick}
        dark={dark}
      />
    )
  }

  return (
    <div
      data-screen-label="Premier Jour"
      style={{
        minHeight: '100vh',
        background: phase === 'today' ? 'transparent' : t.bgGradient,
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: t.ink,
      }}
    >
      <style>{OB_GLOBAL_CSS + D0_CSS}</style>

      <div
        key={phase}
        style={{
          animation: 'd0FadeIn .35s ease both',
        }}
      >
        {body}
      </div>
    </div>
  )
}

// Guard utilitaire — true si la liste des phases connaît cette valeur
export const isD0Phase = (s: string): s is D0Phase =>
  (D0_PHASES as readonly string[]).includes(s)
