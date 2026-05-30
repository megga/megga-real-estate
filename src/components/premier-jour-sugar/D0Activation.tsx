// MEGGA Premier jour — Écran d'activation IA « Atterrissage » (V5 grand format)
//
// Remplace D0Configuring dans le flux réel : préparation IA animée (anneau
// « Meta ») → état de succès (anneau qui se trace + coche) → CTA d'entrée.
// L'objectif UX : transformer le temps d'init en un moment de réassurance et de
// personnalisation, plutôt qu'un spinner mort. L'animation raconte ce que l'IA
// met en place pour l'agent.
//
// Phase 1 (design fidelity) : recrée fidèlement la maquette Claude Design
// (handoff « atterrissage »). Animations CSS pures (rendu garanti hors Framer),
// timer requestAnimationFrame, phrases pilotées par les VRAIES réponses du
// calibrage. Couleurs / typo / timings = définitifs (hi-fi).
//
// Phases ultérieures (non incluses ici) :
//   · Phase 2 — durée pilotée par l'init réel backend (signal « prêt »).
//   · Phase 3 — anneau Meta + anneau de fin en Framer Motion (fluidité FB/Meta).
//   · Phase 4 — setup IA réel en arrière-plan à partir des réponses.
//
// Source : design_handoff_day0_activation/crm-day0-activation-v5-grand.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { obPalette } from '@/components/onboarding-sugar/tokens'
import { findZone } from './data'
import type { D0Answers } from './types'

// Accent fonctionnel unique de l'écran (vert validation) — fidèle à la maquette.
// Seule couleur « fonctionnelle » : anneau, coche, barre de progression, glow ETA.
const ACTIVATION_ACCENT = '#059669'

// Durée de la préparation. Phase 1 : fixe. Phase 2 : remplacée par la durée
// réelle d'init backend (ou bornée, avec passage à `done` dès l'init terminée —
// ne jamais faire attendre artificiellement).
const ACTIVATION_DURATION_MS = 10_000

type Phrase = { main: string; sub: string }

// Métriques responsives. Le visuel est borné par la largeur ET la hauteur pour
// ne jamais pousser les phrases / le footer hors de l'écran (≈430px réservés au
// hero, aux phrases et au footer). `compact` réduit paddings / gaps sur les
// écrans courts (laptops 13" ≈ 720–800px de haut).
function computeActivationMetrics(): { visualSize: number; compact: boolean } {
  if (typeof window === 'undefined') return { visualSize: 420, compact: false }
  const w = window.innerWidth
  const h = window.innerHeight
  const visualSize = Math.round(Math.max(220, Math.min(420, w - 80, h - 430)))
  return { visualSize, compact: h < 820 }
}

// ─── Phrases d'étape pilotées par les réponses réelles du calibrage ────
// Fidèle à la maquette (6 étapes : matching · zones · documents · rythme ·
// canaux · première journée) mais avec les vraies valeurs de l'agent
// substituées là où la maquette montrait des exemples figés.
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
      main: 'Indexation des zones que vous couvrez.',
      sub: `${zonesText} ${zonesVerb}. Cartes, communes, prix médians et flux concurrentiels sont à jour.`,
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

// ─── Anneau « Meta » : une seule ligne épaisse dont l'arc s'allonge / se
// rétracte en tournant (le loader Instagram/Meta). pathLength=100 → dash en %.
// Phase 1 : animations CSS. Phase 3 : portage Framer Motion (motion path).
function MetaRing({ size, accent }: { size: number; accent: string }) {
  const stroke = Math.max(3, size * 0.035)
  const radius = size * 0.44
  return (
    <div
      className="d0a-spin"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        animation: 'd0aRotate 1.9s linear infinite',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          className="d0a-dash"
          style={{ animation: 'd0aDash 1.5s ease-in-out infinite' }}
        />
      </svg>
    </div>
  )
}

// ─── Particules ambiantes (clignotements lointains) — clair seulement ──
function AmbientParticles({
  color,
  count = 16,
  radius,
}: {
  color: string
  count?: number
  radius: number
}) {
  // Positions déterministes (golden angle) — stables au re-render.
  const positions = useMemo(() => {
    const arr: { x: number; y: number; delay: number; size: number; duration: number }[] = []
    for (let i = 0; i < count; i++) {
      const angle = i * 137.5 * (Math.PI / 180)
      const r = radius * (0.55 + (0.45 * ((i * 13) % 100)) / 100)
      arr.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        delay: (i * 0.23) % 2,
        size: 1.5 + (i % 3) * 0.7,
        duration: 2 + (i % 5) * 0.4,
      })
    }
    return arr
  }, [count, radius])

  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 }}
    >
      {positions.map((p, i) => (
        <div
          key={i}
          className="d0a-twinkle"
          style={{
            position: 'absolute',
            left: p.x - p.size / 2,
            top: p.y - p.size / 2,
            width: p.size,
            height: p.size,
            borderRadius: 999,
            background: color,
            opacity: 0.5,
            animation: `d0aTwinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Bloc visuel central : anneau Meta + GG + particules ───────────────
function ActivationVisual({
  size,
  accent,
  dark,
}: {
  size: number
  accent: string
  dark?: boolean
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
      {/* Particules ambiantes — masquées en mode sombre (clair seulement). */}
      {!dark && (
        <AmbientParticles color={accent} count={16} radius={size * 0.55} />
      )}

      {/* Anneau Meta unique, ligne épaisse. */}
      <MetaRing size={size} accent={accent} />

      {/* GG au centre, qui respire très lentement. */}
      <div
        className="d0a-breath"
        style={{
          position: 'relative',
          zIndex: 2,
          animation: 'd0aBreath 5s ease-in-out infinite',
        }}
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
      </div>
    </div>
  )
}

// ─── État final : anneau qui se trace + coche + CTA ────────────────────
function ActivationDone({
  accent,
  dark,
  prenom,
  ctaLabel,
  onEnter,
}: {
  accent: string
  dark?: boolean
  prenom: string
  ctaLabel: string
  onEnter: () => void
}) {
  const t = obPalette(dark)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 30,
        animation: 'd0aDoneIn .6s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      {/* Cercle de validation — anneau qui se trace, puis coche (fil de trait). */}
      <div
        style={{
          position: 'relative',
          width: 108,
          height: 108,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg
          width={108}
          height={108}
          viewBox="0 0 108 108"
          style={{ gridArea: '1 / 1' }}
          aria-hidden="true"
        >
          <circle cx={54} cy={54} r={46} fill="none" stroke={`${accent}26`} strokeWidth={4} />
          <circle
            cx={54}
            cy={54}
            r={46}
            fill="none"
            stroke={accent}
            strokeWidth={4}
            strokeLinecap="round"
            transform="rotate(-90 54 54)"
            style={{
              strokeDasharray: 289.03,
              strokeDashoffset: 289.03,
              animation: 'd0aRingDraw .7s cubic-bezier(.65,0,.36,1) forwards',
            }}
          />
        </svg>
        <svg
          viewBox="0 0 24 24"
          width={56}
          height={56}
          style={{ gridArea: '1 / 1' }}
          aria-hidden="true"
        >
          <path
            d="m5 12.5 4.2 4.3L19 6.5"
            stroke={accent}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{
              strokeDasharray: 30,
              strokeDashoffset: 30,
              animation: 'd0aCheck .42s .55s cubic-bezier(.65,0,.36,1) forwards',
            }}
          />
        </svg>
      </div>

      <h2
        style={{
          margin: 0,
          fontSize: 34,
          fontWeight: 700,
          color: t.ink,
          letterSpacing: '-0.8px',
          lineHeight: 1.12,
          textAlign: 'center',
        }}
      >
        {prenom ? `Bienvenue, ${prenom}.` : 'Bienvenue.'}
      </h2>

      <button
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
      </button>
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────────
export function D0Activation({
  answers,
  prenom = 'Marie',
  dark,
  onComplete,
  ctaLabel = 'Entrer dans le CRM',
}: {
  answers: D0Answers
  prenom?: string
  dark?: boolean
  onComplete: () => void
  ctaLabel?: string
}) {
  const t = obPalette(dark)
  const accent = ACTIVATION_ACCENT
  const phrases = useMemo(() => buildActivationPhrases(answers), [answers])

  // Visuel responsive (borné largeur + hauteur) + mode compact écran court.
  const [{ visualSize, compact }, setMetrics] = useState(computeActivationMetrics)
  useEffect(() => {
    const onResize = () => setMetrics(computeActivationMetrics())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Temps écoulé / progression / done — pilotés par requestAnimationFrame.
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const dt = now - (startRef.current ?? now)
      if (dt >= ACTIVATION_DURATION_MS) {
        setElapsed(ACTIVATION_DURATION_MS)
        setDone(true)
        return
      }
      setElapsed(dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const progress = Math.max(0, Math.min(1, elapsed / ACTIVATION_DURATION_MS))
  const remainingSec = Math.max(
    0,
    Math.ceil((ACTIVATION_DURATION_MS - elapsed) / 1000),
  )
  const rawIdx = Math.floor(progress * phrases.length)
  const phraseIdx = Math.max(0, Math.min(phrases.length - 1, Number.isFinite(rawIdx) ? rawIdx : 0))
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
      <style>{D0_ACTIVATION_CSS}</style>

      {/* Bloc central */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: compact ? '64px 24px 40px' : '140px 32px 80px',
          maxWidth: 720,
          width: '100%',
          gap: compact ? 32 : 56,
        }}
      >
        {!done ? (
          <>
            {/* Hero au-dessus du visuel. */}
            <div style={{ textAlign: 'center', animation: 'd0aFadeIn .6s ease both' }}>
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
            </div>

            <ActivationVisual size={visualSize} accent={accent} dark={dark} />

            {/* Étape courante (texte dynamique, re-animé à chaque changement). */}
            <div
              aria-live="polite"
              style={{
                textAlign: 'center',
                maxWidth: 560,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                minHeight: 130,
              }}
            >
              <div
                key={`m-${phraseIdx}`}
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: '-0.4px',
                  lineHeight: 1.3,
                  animation: 'd0aCross .55s .05s cubic-bezier(.2,.8,.2,1) both',
                }}
              >
                {phrase.main}
              </div>
              <div
                key={`s-${phraseIdx}`}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: t.inkSoft,
                  lineHeight: 1.55,
                  letterSpacing: '-0.1px',
                  animation: 'd0aCross .55s .1s cubic-bezier(.2,.8,.2,1) both',
                }}
              >
                {phrase.sub}
              </div>
            </div>
          </>
        ) : (
          <ActivationDone
            accent={accent}
            dark={dark}
            prenom={prenom}
            ctaLabel={ctaLabel}
            onEnter={onComplete}
          />
        )}
      </main>

      {/* Footer : ETA + barre de progression. En flux (pas absolu) pour ne
          jamais chevaucher les phrases sur écran court ; sur écran haut, le
          main (flex:1) le pousse en bas — rendu identique à la maquette. */}
      {!done && (
        <footer
          style={{
            flexShrink: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            padding: compact ? '0 24px 28px' : '0 32px 36px',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: t.muted,
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              letterSpacing: '0.4px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ≈ {remainingSec} s restantes
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            style={{
              width: 'min(560px, 100%)',
              height: 2,
              borderRadius: 999,
              background: t.divider,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: '100%',
                background: accent,
                boxShadow: `0 0 8px ${accent}`,
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </footer>
      )}
    </div>
  )
}

// ─── CSS d'animations (Phase 1 — pures CSS, indépendantes de Framer) ───
const D0_ACTIVATION_CSS = `
  @keyframes d0aRotate { to { transform: translate(-50%, -50%) rotate(360deg); } }
  @keyframes d0aDash {
    0%   { stroke-dasharray: 1 100;  stroke-dashoffset: 0; }
    50%  { stroke-dasharray: 55 100; stroke-dashoffset: -12; }
    100% { stroke-dasharray: 1 100;  stroke-dashoffset: -100; }
  }
  @keyframes d0aBreath {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.025); }
  }
  @keyframes d0aTwinkle {
    0%, 100% { opacity: 0; transform: scale(0.6); }
    50%      { opacity: 0.85; transform: scale(1.2); }
  }
  @keyframes d0aFadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes d0aCross {
    from { opacity: 0; transform: translateY(8px); filter: blur(4px); }
    to   { opacity: 1; transform: translateY(0);  filter: blur(0); }
  }
  @keyframes d0aDoneIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes d0aRingDraw { to { stroke-dashoffset: 0; } }
  @keyframes d0aCheck    { to { stroke-dashoffset: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .d0a-spin, .d0a-dash, .d0a-twinkle, .d0a-breath { animation: none !important; }
  }
`
