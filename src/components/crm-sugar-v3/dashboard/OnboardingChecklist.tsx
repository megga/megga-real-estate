// MEGGA CRM Sugar v3 — Onboarding interactif (CLAUDE.md §8 priorité #5)
//
// Checklist 5 étapes affichée en haut du Cockpit, dans la grammaire Sugar Pure :
//   surface blanche, accent noir #0B0C0E, pilule premium verte pour complete.
//
// Le composant s'auto-replie une fois les 5 étapes complétées, et permet à
// l'agent de le dismisser explicitement (rangé tant que l'agent n'a pas reset).
// Persistance localStorage : clé `megga.onboarding.dashboard.v1`.
//
// Source de vérité minimale — quand on aura le backend dashboard, on remplacera
// localStorage par une colonne `agent_onboarding` sur `profiles`.

import { useEffect, useState } from 'react'
import { DB_SP } from './tokens'
import { DbIcon } from './icons'
import {
  loadOnboardingState,
  saveOnboardingState,
  type OnboardingState,
} from './onboardingStorage'

export interface OnboardingStep {
  id: string
  title: string
  desc: string
  cta: string
  ctaPath: string
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'profile',
    title: 'Complète ton profil agent',
    desc: 'Photo, bio, langues, zones d\'action — ton portail vendeur s\'en sert.',
    cta: 'Aller aux réglages',
    ctaPath: '/dashboard/settings',
  },
  {
    id: 'zone',
    title: 'Définis tes zones d\'action',
    desc: 'Cantons et communes — MEGGA AI s\'en sert pour scorer tes leads.',
    cta: 'Configurer mes zones',
    ctaPath: '/dashboard/settings?tab=zones',
  },
  {
    id: 'import-lead',
    title: 'Importe ton premier lead avec MEGGA AI',
    desc: 'Colle un email ou un message — l\'IA extrait contact + critères.',
    cta: 'Essayer l\'import lead',
    ctaPath: '/dashboard/import-lead',
  },
  {
    id: 'kyc',
    title: 'Ouvre ton premier dossier KYC',
    desc: 'Vérification LBA art. 3-7 en 3 minutes — obligatoire avant l\'offre.',
    cta: 'Démarrer un KYC',
    ctaPath: '/dashboard/kyc',
  },
  {
    id: 'relance',
    title: 'Lance ta première session de relance',
    desc: 'MEGGA AI prépare un brouillon par lead dormant — tu valides chaque envoi.',
    cta: 'Voir la session',
    ctaPath: '/dashboard/analytics?tab=entonnoir',
  },
]

interface OnboardingChecklistProps {
  steps?: OnboardingStep[]
  onStepCta?: (step: OnboardingStep) => void
}

export function OnboardingChecklist({
  steps = DEFAULT_STEPS,
  onStepCta,
}: OnboardingChecklistProps) {
  const [state, setState] = useState<OnboardingState>(() => loadOnboardingState())
  const [expanded, setExpanded] = useState(true)

  // Persist whenever state changes
  useEffect(() => {
    saveOnboardingState(state)
  }, [state])

  const completedCount = steps.filter((s) => state.completed[s.id]).length
  const allDone = completedCount === steps.length
  const pct = Math.round((completedCount / steps.length) * 100)

  // Si dismissed OU 100% → ne rend rien
  if (state.dismissed) return null

  const toggleStep = (id: string) => {
    setState((s) => ({ ...s, completed: { ...s.completed, [id]: !s.completed[id] } }))
  }

  const dismissAll = () => {
    setState((s) => ({ ...s, dismissed: true }))
  }

  return (
    <section
      aria-label="Étapes pour démarrer sur MEGGA"
      style={{
        background: DB_SP.card,
        borderRadius: 28,
        padding: '24px 28px',
        boxShadow: DB_SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                padding: '3px 9px',
                borderRadius: 999,
                background: DB_SP.black,
                color: '#fff',
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Démarrer
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: DB_SP.muted,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              5 étapes · {completedCount}/{steps.length} faites
            </span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: DB_SP.ink,
              letterSpacing: -0.5,
              lineHeight: 1.2,
            }}
          >
            {allDone
              ? 'Tu maîtrises MEGGA. Bravo.'
              : 'Quelques minutes pour bien commencer.'}
          </h2>
        </div>
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Réduire la checklist' : 'Déplier la checklist'}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 999,
              border: 0,
              background: 'transparent',
              color: DB_SP.inkSoft,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            {expanded ? 'Réduire' : 'Déplier'}
          </button>
          {allDone && (
            <button
              onClick={dismissAll}
              aria-label="Retirer la checklist d'onboarding"
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 999,
                border: 0,
                background: DB_SP.black,
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              Ranger
              <DbIcon name="check" size={12} stroke="#fff" sw={2.2} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Onboarding : ${pct} % complété`}
        style={{
          height: 6,
          borderRadius: 999,
          background: DB_SP.cardSubtle,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: allDone ? DB_SP.ok : DB_SP.black,
            borderRadius: 999,
            transition: 'width .35s cubic-bezier(.2,.8,.2,1)',
            boxShadow: allDone ? `0 0 0 1px ${DB_SP.ok}55` : 'none',
          }}
        />
      </div>

      {/* Steps grid (expanded only) */}
      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginTop: 4,
          }}
        >
          {steps.map((s, i) => {
            const done = !!state.completed[s.id]
            return (
              <StepCard
                key={s.id}
                index={i + 1}
                step={s}
                done={done}
                onToggle={() => toggleStep(s.id)}
                onCta={() => {
                  // Auto-tick when agent acts on the CTA — heuristique.
                  // Le toggle reste manuel pour les cas où la nav échoue.
                  toggleStep(s.id)
                  onStepCta?.(s)
                }}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

interface StepCardProps {
  index: number
  step: OnboardingStep
  done: boolean
  onToggle: () => void
  onCta: () => void
}

function StepCard({ index, step, done, onToggle, onCta }: StepCardProps) {
  return (
    <div
      style={{
        background: done ? DB_SP.cardSubtle : '#fff',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxShadow: done ? 'none' : DB_SP.shadowSm,
        minWidth: 0,
        position: 'relative',
        transition: 'all .15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onToggle}
          aria-label={done ? `Marquer "${step.title}" comme non faite` : `Marquer "${step.title}" comme faite`}
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            border: 0,
            background: done ? DB_SP.ok : '#fff',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: done ? `0 0 0 1px ${DB_SP.ok}` : `0 0 0 1.5px ${DB_SP.hairlineStrong}`,
            transition: 'all .15s ease',
          }}
        >
          {done ? (
            <DbIcon name="check" size={12} stroke="#fff" sw={2.6} />
          ) : (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: DB_SP.muted,
                letterSpacing: -0.2,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {index}
            </span>
          )}
        </button>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: DB_SP.ink,
            letterSpacing: -0.2,
            lineHeight: 1.3,
            textDecorationLine: done ? 'line-through' : 'none',
            textDecorationColor: DB_SP.muted,
            flex: 1,
            minWidth: 0,
          }}
        >
          {step.title}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 11.5,
          fontWeight: 500,
          color: DB_SP.inkSoft,
          lineHeight: 1.45,
          marginLeft: 34,
        }}
      >
        {step.desc}
      </p>
      {!done && (
        <button
          onClick={onCta}
          style={{
            alignSelf: 'flex-start',
            marginLeft: 34,
            height: 28,
            padding: '0 12px',
            borderRadius: 999,
            border: 0,
            background: DB_SP.black,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: -0.1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          {step.cta}
          <DbIcon name="arrow" size={11} stroke="#fff" sw={2.2} />
        </button>
      )}
    </div>
  )
}

// Helper `markOnboardingStepDone` exporté depuis ./onboardingStorage.ts —
// extrait pour satisfaire react-refresh/only-export-components.
