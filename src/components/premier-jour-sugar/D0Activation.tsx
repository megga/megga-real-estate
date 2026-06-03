// MEGGA Premier jour — Écran d'activation IA « Atterrissage » (V5 grand format)
//
// Remplace D0Configuring dans le flux réel : préparation IA animée (anneau
// « Meta ») → état de succès (anneau qui se trace + coche) → CTA d'entrée.
// L'objectif UX : transformer le temps d'init en un moment de réassurance et de
// personnalisation, plutôt qu'un spinner mort. L'animation raconte ce que l'IA
// met en place pour l'agent.
//
// Parti pris visuel (épuré) : anneau Meta + GG central + phrases pilotées par
// les réponses. PAS de particules, PAS de barre de progression, PAS d'ETA.
// Toggle de thème animé (sun/moon framer-motion, ObThemeToggle) en haut à
// droite, cohérent avec welcome / questions / synthesis.
//
// Phase 3 (Framer Motion) : toutes les animations sont portées sur framer-motion
//   · Anneau Meta = rotation continue + arc qui croît/rétracte (pathLength +
//     pathOffset) — le loader Instagram/Meta, fluide et hardware-friendly.
//   · Anneau de fin = tracé pathLength + coche + entrée spring (animation dédiée,
//     distincte de l'anneau de préparation).
//   · Défilement du texte = AnimatePresence (spring + blur), cross-fade fluide.
//   · GG qui respire, hero, état succès = motion.
//   · prefers-reduced-motion respecté via useReducedMotion().
//
// Phase 1 : durée fixe (timer). Phase 2 : durée pilotée par l'init backend réel.
// Phase 4 : setup IA réel en arrière-plan à partir des réponses.
//
// Source : design_handoff_day0_activation/crm-day0-activation-v5-grand.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { obPalette } from '@/components/onboarding-sugar/tokens'
import { ObThemeToggle } from '@/components/onboarding-sugar/OnboardingShell'
import { findZone } from './data'
import type { D0Answers } from './types'

// Accent fonctionnel unique de l'écran (vert validation) — fidèle à la maquette.
const ACTIVATION_ACCENT = '#059669'

// Phase 2 : la fin de l'écran est pilotée par l'init backend RÉELLE (prop
// `onProvision`). On garde une durée d'affichage minimale « confortable » (on ne
// termine pas avant, même si l'init est plus rapide) et un cap dur si l'init
// traîne ou échoue — l'agent n'est jamais bloqué. Sans `onProvision` (preview
// dev), l'écran se comporte comme un simple timer de `ACTIVATION_DISPLAY_MS`.
const ACTIVATION_DISPLAY_MS = 14_000
const ACTIVATION_MAX_MS = 22_000

// Easing « confident » partagé par les tracés de l'état de succès.
const DRAW_EASE = [0.65, 0, 0.36, 1] as const

type Phrase = { main: string; sub: string }

// Métriques responsives. Le visuel est borné par la largeur ET la hauteur pour
// ne jamais pousser les phrases hors de l'écran (≈400px réservés au hero et aux
// phrases). `compact` réduit paddings / gaps sur les écrans courts (laptops 13").
function computeActivationMetrics(): { visualSize: number; compact: boolean } {
  if (typeof window === 'undefined') return { visualSize: 420, compact: false }
  const w = window.innerWidth
  const h = window.innerHeight
  const visualSize = Math.round(Math.max(220, Math.min(420, w - 80, h - 400)))
  return { visualSize, compact: h < 820 }
}

// ─── Phrases d'étape pilotées par les réponses réelles du calibrage ────
// 6 étapes : matching · zones · documents · rythme · canaux · première journée,
// avec les vraies valeurs de l'agent substituées.
function buildActivationPhrases(answers: D0Answers): Phrase[] {
  // Zones couvertes → libellés réels (2 max + « … » au-delà).
  const zoneLabels = answers.zone
    .map((id) => findZone(id)?.label)
    .filter((l): l is string => Boolean(l))
  const zonesShown = zoneLabels.slice(0, 2).join(' et ')
  const zonesText =
    zoneLabels.length === 0
      ? 'Vos zones'
      : zoneLabels.length > 2
        ? `${zonesShown} et ${zoneLabels.length - 2} autre${zoneLabels.length - 2 > 1 ? 's' : ''} zone${zoneLabels.length - 2 > 1 ? 's' : ''}`
        : zonesShown
  const zonesVerb = zoneLabels.length > 1 ? 'sont chargées' : 'est chargée'

  // Spécialité → documents préparés.
  const docsBySpecialite: Record<NonNullable<D0Answers['specialite']>, string> =
    {
      vente: 'Mandats de vente, formulaires KYC et fiches de bien',
      location: 'Baux à loyer, états des lieux et fiches gérance',
      commercial: "Mandats d'investissement, data-rooms et fiches de rendement",
      terrain: 'Promesses de vente, dossiers fonciers et fiches de parcelle',
    }
  const docsText = answers.specialite
    ? docsBySpecialite[answers.specialite]
    : 'Mandats, formulaires KYC et fiches de bien'

  // Disponibilité → rythme des relances / notifications.
  const rhythmByDispo: Record<NonNullable<D0Answers['dispo']>, string> = {
    office: 'sur vos heures de bureau (9h–18h)',
    wide: 'sur votre planning élargi (8h–20h, du lundi au samedi)',
    '247': 'sans limite horaire — vous gardez la main',
  }
  const rhythmText = answers.dispo
    ? rhythmByDispo[answers.dispo]
    : 'sur vos heures de bureau'

  // Priorité → angle des 3 priorités de la journée.
  const priorityByGoal: Record<NonNullable<D0Answers['priorite']>, string> = {
    acquisition:
      'autour de la conquête de nouveaux mandats, votre objectif des 30 prochains jours.',
    closing:
      'pour faire avancer vos mandats actuels vers le closing, votre objectif des 30 prochains jours.',
    fidelisation:
      'autour du suivi de vos clients, votre objectif des 30 prochains jours.',
  }
  const priorityText = answers.priorite
    ? priorityByGoal[answers.priorite]
    : 'à partir de votre objectif des 30 prochains jours.'

  return [
    {
      main: 'Calibrage de votre modèle de matching.',
      sub: "J'apprends quels biens correspondent à quels acheteurs, à partir des réponses que vous venez de me donner.",
    },
    {
      main: 'Calibrage du matching sur vos zones.',
      sub: `${zonesText} ${zonesVerb}. Vos suggestions et rapprochements acheteurs ↔ biens y seront priorisés.`,
    },
    {
      main: 'Synchronisation de vos templates de documents.',
      sub: `${docsText} — tout est prêt à votre nom.`,
    },
    {
      main: 'Apprentissage de votre rythme de travail.',
      sub: `Je cale mes relances et mes notifications ${rhythmText}.`,
    },
    {
      main: 'Connexion de vos canaux de communication.',
      sub: 'Boîte mail, calendrier et signature électronique sont prêts à être branchés en un clic.',
    },
    {
      main: 'Préparation de votre première journée.',
      sub: `Je compose vos 3 priorités du jour ${priorityText}`,
    },
  ]
}

// ─── Anneau « Meta » (Framer Motion) ───────────────────────────────────
// Le loader Instagram/Meta : un arc épais qui tourne en continu pendant que sa
// longueur croît puis se rétracte (pathLength) et que son point de départ
// glisse autour du cercle (pathOffset). La rotation est un transform (GPU),
// la respiration de l'arc reste légère → rendu « parfaitement fluide ».
function MetaRing({
  size,
  accent,
  reduced,
}: {
  size: number
  accent: string
  reduced: boolean
}) {
  const stroke = Math.max(3, size * 0.04)
  const c = size / 2
  const r = size * 0.42
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ position: 'absolute', top: 0, left: 0 }}
      animate={reduced ? undefined : { rotate: 360 }}
      transition={
        reduced ? undefined : { duration: 3, ease: 'linear', repeat: Infinity }
      }
    >
      {/* Piste quasi invisible — donne du corps à l'anneau. */}
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={accent}
        strokeOpacity={0.07}
        strokeWidth={stroke}
      />
      <motion.circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeLinecap="round"
        initial={false}
        animate={
          reduced
            ? { pathLength: 0.7, pathOffset: 0 }
            : { pathLength: [0.06, 0.58, 0.06], pathOffset: [0, 0.5, 1] }
        }
        transition={
          reduced
            ? undefined
            : { duration: 2.6, ease: 'easeInOut', repeat: Infinity }
        }
      />
    </motion.svg>
  )
}

// ─── Bloc visuel central : anneau Meta + GG qui respire ────────────────
function ActivationVisual({
  size,
  accent,
  dark,
  reduced,
}: {
  size: number
  accent: string
  dark?: boolean
  reduced: boolean
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <MetaRing size={size} accent={accent} reduced={reduced} />

      {/* GG au centre, qui respire très lentement. */}
      <motion.div
        style={{ position: 'relative', zIndex: 2 }}
        animate={reduced ? undefined : { scale: [1, 1.025, 1] }}
        transition={
          reduced
            ? undefined
            : { duration: 5, ease: 'easeInOut', repeat: Infinity }
        }
      >
        <img
          src="/megga-gg.svg"
          alt=""
          aria-hidden="true"
          width={Math.round(size * 0.3)}
          style={{
            display: 'block',
            height: 'auto',
            filter: dark ? 'invert(1)' : 'none',
          }}
        />
      </motion.div>
    </div>
  )
}

// ─── État final : anneau qui se trace + coche + CTA (Framer Motion) ─────
// Animation dédiée, distincte de l'anneau de préparation : entrée spring du
// cercle, tracé pathLength de l'anneau puis de la coche, puis titre + CTA en
// cascade. Aucun pulse / halo (fil de trait uniquement).
function ActivationDone({
  accent,
  dark,
  prenom,
  ctaLabel,
  onEnter,
  reduced,
}: {
  accent: string
  dark?: boolean
  prenom: string
  ctaLabel: string
  onEnter: () => void
  reduced: boolean
}) {
  const t = obPalette(dark)
  return (
    <motion.div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 30,
      }}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: DRAW_EASE }}
    >
      {/* Cercle de validation — entrée spring + tracé anneau puis coche. */}
      <motion.div
        style={{
          position: 'relative',
          width: 108,
          height: 108,
          display: 'grid',
          placeItems: 'center',
        }}
        initial={reduced ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18 }}
      >
        <svg
          width={108}
          height={108}
          viewBox="0 0 108 108"
          style={{ gridArea: '1 / 1' }}
          aria-hidden="true"
        >
          <circle cx={54} cy={54} r={46} fill="none" stroke={`${accent}26`} strokeWidth={4} />
          <g transform="rotate(-90 54 54)">
            <motion.circle
              cx={54}
              cy={54}
              r={46}
              fill="none"
              stroke={accent}
              strokeWidth={4}
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: DRAW_EASE, delay: reduced ? 0 : 0.1 }}
            />
          </g>
        </svg>
        <svg
          viewBox="0 0 24 24"
          width={56}
          height={56}
          style={{ gridArea: '1 / 1' }}
          aria-hidden="true"
        >
          <motion.path
            d="m5 12.5 4.2 4.3L19 6.5"
            stroke={accent}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, ease: DRAW_EASE, delay: reduced ? 0 : 0.62 }}
          />
        </svg>
      </motion.div>

      <motion.h2
        style={{
          margin: 0,
          fontSize: 34,
          fontWeight: 700,
          color: t.ink,
          letterSpacing: '-0.8px',
          lineHeight: 1.12,
          textAlign: 'center',
        }}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: DRAW_EASE, delay: reduced ? 0 : 0.35 }}
      >
        {prenom ? `Bienvenue, ${prenom}.` : 'Bienvenue.'}
      </motion.h2>

      <motion.button
        type="button"
        onClick={onEnter}
        style={{
          height: 52,
          padding: '0 32px',
          borderRadius: 999,
          border: 0,
          background: dark ? '#ECEDF3' : '#0B0C0E',
          color: dark ? '#0B0C0E' : '#FFFFFF',
          fontFamily: 'inherit',
          fontSize: 14.5,
          fontWeight: 600,
          letterSpacing: '0.1px',
          cursor: 'pointer',
          boxShadow: '0 12px 30px rgba(11,12,14,0.20)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
        }}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: DRAW_EASE, delay: reduced ? 0 : 0.5 }}
        whileHover={reduced ? undefined : { scale: 1.03 }}
        whileTap={reduced ? undefined : { scale: 0.98 }}
      >
        {ctaLabel}
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </motion.button>
    </motion.div>
  )
}

// ─── Composant principal ───────────────────────────────────────────────
export function D0Activation({
  answers,
  prenom = 'Marie',
  dark,
  onComplete,
  onThemeChange,
  onProvision,
  ctaLabel = 'Entrer dans le CRM',
}: {
  answers: D0Answers
  prenom?: string
  dark?: boolean
  onComplete: () => void
  onThemeChange?: (theme: 'light' | 'dark') => void
  /**
   * Setup IA réel en arrière-plan (Phase 2/4). Déclenché une fois au montage ;
   * l'écran ne passe à l'état de succès qu'une fois ce setup résolu (ou rejeté
   * — fallback), après la durée d'affichage minimale. Absent (preview dev) →
   * simple timer.
   */
  onProvision?: () => Promise<unknown>
  ctaLabel?: string
}) {
  const t = obPalette(dark)
  const accent = ACTIVATION_ACCENT
  const reduced = !!useReducedMotion()
  const phrases = useMemo(() => buildActivationPhrases(answers), [answers])

  // Visuel responsive (borné largeur + hauteur) + mode compact écran court.
  const [{ visualSize, compact }, setMetrics] = useState(computeActivationMetrics)
  useEffect(() => {
    const onResize = () => setMetrics(computeActivationMetrics())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Phrase courante + fin de l'écran.
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [done, setDone] = useState(false)
  // `setupReady` : true dès que le provisioning backend a résolu (ou rejeté →
  // fallback). Sans onProvision, prêt d'emblée (preview dev = simple timer).
  const setupReadyRef = useRef(onProvision == null)
  const provisionStartedRef = useRef(false)
  const startRef = useRef<number | null>(null)

  // Déclenche le setup IA réel une seule fois (Phase 2/4). Fallback-safe : toute
  // erreur (fonction pas encore déployée, réseau, 401…) marque quand même prêt,
  // l'écran retombe alors sur sa durée d'affichage.
  useEffect(() => {
    if (provisionStartedRef.current || !onProvision) return
    provisionStartedRef.current = true
    Promise.resolve()
      .then(() => onProvision())
      .catch(() => {})
      .finally(() => {
        setupReadyRef.current = true
      })
  }, [onProvision])

  // Cycle des phrases + transition vers l'état de succès quand l'init réelle est
  // prête, après la durée d'affichage minimale (et au plus tard à MAX).
  useEffect(() => {
    if (done) return
    if (startRef.current == null) startRef.current = performance.now()
    const n = phrases.length
    const stepMs = ACTIVATION_DISPLAY_MS / n
    const id = window.setInterval(() => {
      const elapsed = performance.now() - (startRef.current ?? performance.now())
      setPhraseIdx(Math.max(0, Math.min(n - 1, Math.floor(elapsed / stepMs))))
      if (
        (elapsed >= ACTIVATION_DISPLAY_MS && setupReadyRef.current) ||
        elapsed >= ACTIVATION_MAX_MS
      ) {
        setDone(true)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [done, phrases.length])
  const phrase = phrases[phraseIdx] ?? phrases[0]

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        color: t.ink,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header : toggle de thème animé (sun/moon framer-motion) en haut à
          droite — cohérent avec welcome / questions / synthesis. */}
      {onThemeChange && (
        <div style={{ position: 'absolute', top: 22, right: 32, zIndex: 3 }}>
          <ObThemeToggle dark={!!dark} onChange={onThemeChange} t={t} />
        </div>
      )}

      {/* Bloc central */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: compact ? '64px 24px 64px' : '120px 32px 120px',
          maxWidth: 720,
          width: '100%',
        }}
      >
        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div
              key="prep"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: compact ? 28 : 40,
                width: '100%',
              }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.25 } }}
            >
              {/* Hero au-dessus du visuel. */}
              <motion.div
                style={{ textAlign: 'center' }}
                initial={reduced ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: compact ? 32 : 40,
                    fontWeight: 700,
                    color: t.ink,
                    letterSpacing: '-1px',
                    lineHeight: 1.08,
                  }}
                >
                  Je prépare votre compte,
                  <br />
                  {prenom}.
                </h1>
              </motion.div>

              {/* Anneau + étape groupés : le texte reste calé sous l'anneau
                  (écart fixe), indépendamment du centrage vertical du bloc. */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <ActivationVisual
                  size={visualSize}
                  accent={accent}
                  dark={dark}
                  reduced={reduced}
                />

                {/* Étape courante — une seule ligne (sobre, en noir), défilement
                    fluide (AnimatePresence spring + blur). La sous-ligne grise a
                    été retirée sur demande. */}
                <div
                  aria-live="polite"
                  style={{
                    textAlign: 'center',
                    maxWidth: 560,
                    width: '100%',
                    minHeight: 44,
                    marginTop: compact ? 22 : 28,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={phraseIdx}
                      style={{
                        fontSize: 21,
                        fontWeight: 700,
                        color: t.ink,
                        letterSpacing: '-0.4px',
                        lineHeight: 1.3,
                      }}
                      initial={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, y: 16, filter: 'blur(6px)' }
                      }
                      animate={
                        reduced
                          ? { opacity: 1 }
                          : { opacity: 1, y: 0, filter: 'blur(0px)' }
                      }
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, y: -16, filter: 'blur(6px)' }
                      }
                      transition={
                        reduced
                          ? { duration: 0.2 }
                          : { type: 'spring', stiffness: 240, damping: 28, mass: 0.8 }
                      }
                    >
                      {phrase.main}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : (
            <ActivationDone
              key="done"
              accent={accent}
              dark={dark}
              prenom={prenom}
              ctaLabel={ctaLabel}
              onEnter={onComplete}
              reduced={reduced}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
