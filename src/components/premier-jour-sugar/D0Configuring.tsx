// MEGGA Premier jour — Sas de configuration IA (Synthèse → Today)
// 5-6 secondes de "configuration en cours" avec :
//   - Logo GG au centre, stroke draw Framer Motion + breathing scale
//   - Arc vert qui orbite autour (rotation linéaire infinie)
//   - Eyebrow "MEGGA AI · CONFIGURATION"
//   - Texte dynamique cyclique pilote par les answers (cross-fade)
//   - Progress bar fine déterminée 6s
// Source : conception interne, après synthèse, avant Today.
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { obPalette } from '@/components/onboarding-sugar/tokens'
import { findZone } from './data'
import type { D0Answers } from './types'

const DURATION_MS = 10000 // 10 secondes — fluide, ~2s par message

/** Messages dynamiques pilotés par les réponses du calibrage. */
function buildMessages(answers: D0Answers): string[] {
  const m: string[] = []

  // 1. Spécialité → templates et pipeline
  if (answers.specialite) {
    const map: Record<NonNullable<D0Answers['specialite']>, string> = {
      vente: 'Préparation de vos templates de mandat de vente',
      location: 'Configuration des fiches gérance et baux',
      commercial: "Calibrage des modules d'investissement commercial",
      terrain: 'Activation des outils de prospection foncière',
    }
    m.push(map[answers.specialite])
  }

  // 2. Zone → synchronisation marketplace
  if (answers.zone.length > 0) {
    const labels = answers.zone
      .slice(0, 2)
      .map((id) => findZone(id)?.label)
      .filter(Boolean)
      .join(' · ')
    m.push(`Synchronisation de votre zone : ${labels}`)
  }

  // 3. Disponibilité → SLA
  if (answers.dispo) {
    const map: Record<NonNullable<D0Answers['dispo']>, string> = {
      office: 'Configuration de vos SLA bureau · 9h–18h',
      wide: 'Configuration de vos SLA élargis · 8h–20h',
      '247': 'Configuration sans limite horaire',
    }
    m.push(map[answers.dispo])
  }

  // 4. Priorité → moteur IA
  if (answers.priorite) {
    const map: Record<NonNullable<D0Answers['priorite']>, string> = {
      acquisition: 'Activation du matching IA pour nouveaux mandats',
      closing: 'Préparation de votre pipeline transactionnel',
      fidelisation: 'Calibrage des relances clients dormants',
    }
    m.push(map[answers.priorite])
  }

  // 5. Final
  m.push("Création de votre tableau Aujourd'hui")

  return m
}

export function D0Configuring({
  answers,
  onComplete,
  dark,
}: {
  answers: D0Answers
  onComplete: () => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  const messages = useMemo(() => buildMessages(answers), [answers])
  const [msgIdx, setMsgIdx] = useState(0)

  // Cycle des messages — chaque message dure (DURATION / nb messages).
  useEffect(() => {
    if (messages.length <= 1) return
    const step = DURATION_MS / messages.length
    const id = window.setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, messages.length - 1))
    }, step)
    return () => window.clearInterval(id)
  }, [messages.length])

  // Auto-advance vers Today après DURATION.
  useEffect(() => {
    const id = window.setTimeout(onComplete, DURATION_MS)
    return () => window.clearTimeout(id)
  }, [onComplete])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 32px',
        gap: 56,
      }}
    >
      {/* ─── Logo GG + spinner arc vert orbital ─────────────────────
          CSS pure animations (pas Framer Motion) pour garantir le rendu
          dans tous les contextes (HMR, background tab, reduced-motion off). */}
      <div
        style={{
          position: 'relative',
          width: 380,
          height: 380,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {/* Arc vert rotatif — CSS keyframe rotate 360 en boucle */}
        <svg
          width={380}
          height={380}
          viewBox="0 0 380 380"
          style={{
            position: 'absolute',
            inset: 0,
            color: t.ok,
            animation: 'd0SpinArc 2.8s linear infinite',
          }}
        >
          <circle
            cx={190}
            cy={190}
            r={172}
            fill="none"
            stroke={dark ? 'rgba(236,237,243,0.08)' : 'rgba(11,12,14,0.06)'}
            strokeWidth={4}
          />
          <circle
            cx={190}
            cy={190}
            r={172}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="240 1081"
          />
        </svg>

        {/* Logo GG — CSS keyframes : scale breathing + rotate subtle */}
        <div
          style={{
            width: 220,
            height: 132,
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation:
              'd0LogoEntry 0.7s cubic-bezier(.2,.8,.2,1) both, d0LogoBreathe 6s ease-in-out 0.7s infinite, d0LogoRotate 8s ease-in-out 0.7s infinite',
          }}
        >
          <img
            src="/megga-gg.svg"
            alt="MEGGA"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: dark ? 'invert(1)' : 'none',
              display: 'block',
            }}
          />
        </div>
      </div>

      {/* Keyframes locales — garantie animation indépendamment de Framer */}
      <style>{`
        @keyframes d0SpinArc {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes d0LogoEntry {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes d0LogoBreathe {
          0%   { transform: scale(0.95); }
          16%  { transform: scale(1); }
          33%  { transform: scale(1.05); }
          50%  { transform: scale(1); }
          66%  { transform: scale(0.97); }
          83%  { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        @keyframes d0LogoRotate {
          0%   { transform: rotate(-2deg); }
          14%  { transform: rotate(1deg); }
          28%  { transform: rotate(2deg); }
          42%  { transform: rotate(-1deg); }
          57%  { transform: rotate(-2deg); }
          71%  { transform: rotate(1deg); }
          100% { transform: rotate(-2deg); }
        }
      `}</style>

      {/* ─── Eyebrow + texte dynamique ───────────────────────────── */}
      <div
        style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          maxWidth: 520,
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          MEGGA AI · Configuration
        </motion.div>

        {/* Texte dynamique cyclique avec cross-fade (plus grand + slower) */}
        <div style={{ minHeight: 72, display: 'grid', placeItems: 'center' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 28,
                mass: 0.7,
              }}
              style={{
                fontFamily:
                  '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: 26,
                fontWeight: 600,
                color: t.ink,
                letterSpacing: '-0.025em',
                lineHeight: 1.3,
              }}
            >
              {messages[msgIdx]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
