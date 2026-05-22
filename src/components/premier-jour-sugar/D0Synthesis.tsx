// MEGGA Premier jour — Écran Synthèse IA
// La pièce maîtresse : profil de travail (gauche) + engagements IA (droite)
// + curseur d'autonomie 3 positions + CTA "Entrer dans MEGGA".
// Source : handoff-premier-jour/premier-jour/crm-day0-synthesis.jsx
import { useState } from 'react'
import { obPalette, type ObTheme } from '@/components/onboarding-sugar/tokens'
import {
  ObBlackPill,
  ObGhostPill,
} from '@/components/onboarding-sugar/primitives'
import { ObThemeToggle } from '@/components/onboarding-sugar/OnboardingShell'
import PxIcon, { type PxIconName } from '@/components/propertyx/PxIcon'
import {
  D0_AUTONOMY,
  D0_QUESTIONS,
  d0BuildCommitments,
  d0ZoneListLabel,
} from './data'
import { D0AIBadge } from './primitives'
import type { Autonomy, D0Answers } from './types'

export function D0Synthesis({
  prenom,
  answers,
  autonomy,
  setAutonomy,
  onEnter,
  onEditQuestion,
  dark,
  onThemeChange,
}: {
  prenom: string
  answers: D0Answers
  autonomy: Autonomy
  setAutonomy: (a: Autonomy) => void
  onEnter: () => void
  onEditQuestion: (i: 0 | 1 | 2 | 3) => void
  dark?: boolean
  onThemeChange?: (theme: 'light' | 'dark') => void
}) {
  const t = obPalette(dark)

  // Labels lisibles depuis les answers
  const specQ = D0_QUESTIONS[0]
  const specLabel =
    (specQ.kind === 'cards' &&
      specQ.options.find((o) => o.id === answers.specialite)?.label) ||
    '—'
  const zoneLabel = d0ZoneListLabel(answers.zone, { fallback: '—' })
  const dispoQ = D0_QUESTIONS[2]
  const dispoOpt =
    dispoQ.kind === 'cards'
      ? dispoQ.options.find((o) => o.id === answers.dispo)
      : undefined
  const dispoLabel = dispoOpt?.label ?? '—'
  const dispoHint = dispoOpt?.hint ?? ''
  const prioQ = D0_QUESTIONS[3]
  const prioLabel =
    (prioQ.kind === 'cards' &&
      prioQ.options.find((o) => o.id === answers.priorite)?.label) ||
    '—'

  const commitments = d0BuildCommitments(answers)

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 32px 80px',
      }}
    >
      {/* Header — logo gauche + toggle dark mode droite */}
      <div
        style={{
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <img
          src="/megga-logo.svg"
          alt="MEGGA"
          style={{
            height: 24,
            width: 'auto',
            opacity: 0.75,
            filter: dark ? 'invert(1)' : 'none',
          }}
        />
        {onThemeChange && (
          <ObThemeToggle dark={!!dark} onChange={onThemeChange} t={t} />
        )}
      </div>

      {/* Header */}
      <div
        style={{
          textAlign: 'center',
          maxWidth: 720,
          margin: '0 auto 38px',
          animation: 'd0SlideUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* Badge MEGGA AI + eyebrow "SYNTHÈSE" — signale visuellement que
            ce qu'on lit ci-dessous est généré par l'IA, pas saisi par
            l'agent. C'est le moment de séduction (handoff §Philosophie). */}
        <div
          style={{
            display: 'inline-flex',
            justifyContent: 'center',
            marginBottom: 22,
          }}
        >
          <D0AIBadge size={28} dark={dark} label="MEGGA AI · Synthèse" />
        </div>

        <h1
          style={{
            margin: 0,
            fontFamily:
              '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 56,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.035em',
            lineHeight: 1.02,
          }}
        >
          Voici ce que j'ai compris
          <br />
          de vous, {prenom}.
        </h1>
        <p
          style={{
            margin: '18px auto 0',
            maxWidth: 540,
            fontSize: 15.5,
            color: t.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Vous pouvez ajuster mon niveau d'autonomie et modifier n'importe
          quelle réponse.
        </p>
      </div>

      {/* Card centrale 2 colonnes — hybrid PX (border 1px subtile + shadow) */}
      <div
        style={{
          maxWidth: 1020,
          width: '100%',
          margin: '0 auto 32px',
          background: t.card,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 28,
          overflow: 'hidden',
          boxShadow: t.shadow,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          animation: 'd0SlideUp .55s cubic-bezier(.2,.8,.2,1) both',
          animationDelay: '0.15s',
          animationFillMode: 'both',
        }}
      >
        {/* GAUCHE : Profil de travail */}
        <div
          style={{
            padding: '32px 32px 28px',
            borderRight: `1px solid ${t.divider}`,
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: t.muted,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Profil de travail
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: -0.4,
              }}
            >
              Ce que j'ai appris
            </div>
          </div>

          <D0ProfileRow
            icon="target"
            label="Spécialité"
            value={specLabel}
            onEdit={() => onEditQuestion(0)}
            delay={0.25}
            t={t}
          />
          <D0ProfileRow
            icon="location"
            label="Zone"
            value={zoneLabel}
            onEdit={() => onEditQuestion(1)}
            delay={0.3}
            t={t}
          />
          <D0ProfileRow
            icon="clock"
            label="Disponibilité"
            value={`${dispoLabel}${dispoHint ? ' · ' + dispoHint : ''}`}
            onEdit={() => onEditQuestion(2)}
            delay={0.35}
            t={t}
          />
          <D0ProfileRow
            icon="flag"
            label="Priorité 30 jours"
            value={prioLabel}
            onEdit={() => onEditQuestion(3)}
            delay={0.4}
            t={t}
          />
        </div>

        {/* DROITE : Mes engagements */}
        <div style={{ padding: '32px 32px 28px', background: t.cardSubtle }}>
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: t.muted,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Mes engagements
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: -0.4,
              }}
            >
              Ce que je vais faire
            </div>
          </div>

          {commitments.map((c, i) => (
            <D0CommitmentRow
              key={c.id}
              text={c.text}
              delay={0.5 + i * 0.08}
              dark={dark}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* Curseur autonomie */}
      <div
        style={{
          maxWidth: 1020,
          width: '100%',
          margin: '0 auto 32px',
          animation: 'd0SlideUp .55s cubic-bezier(.2,.8,.2,1) both',
          animationDelay: '0.85s',
          animationFillMode: 'both',
        }}
      >
        <D0AutonomySlider value={autonomy} onChange={setAutonomy} dark={dark} />
      </div>

      {/* CTA — pilule noire principale + ghost "Modifier mes réponses"
          côte à côte (handoff §Phase synthesis "CTA final"). Le ghost
          renvoie sur q0 pour permettre de re-jouer le calibrage. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          animation: 'd0SlideUp .55s cubic-bezier(.2,.8,.2,1) both',
          animationDelay: '1s',
          animationFillMode: 'both',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <ObGhostPill
            onClick={() => onEditQuestion(0)}
            dark={dark}
            size="lg"
            icon={
              <PxIcon
                name="arrow-left"
                size={16}
                color={t.inkSoft}
                strokeWidth={2}
              />
            }
          >
            Modifier mes réponses
          </ObGhostPill>
          <ObBlackPill
            onClick={onEnter}
            dark={dark}
            size="lg"
            autoFocus
            icon={
              <PxIcon
                name="arrow-right"
                size={18}
                color={dark ? '#0B0C0E' : '#FFFFFF'}
                strokeWidth={2}
              />
            }
          >
            Entrer dans MEGGA
          </ObBlackPill>
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: t.muted,
            fontWeight: 500,
          }}
        >
          Vous atterrirez sur Aujourd'hui, déjà personnalisé.
        </div>
      </div>
    </div>
  )
}

// ─── Slider autonomie 3 positions ────────────────────────────────────

function D0AutonomySlider({
  value,
  onChange,
  dark,
}: {
  value: Autonomy
  onChange: (v: Autonomy) => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  const idx = D0_AUTONOMY.findIndex((a) => a.id === value)
  const current = D0_AUTONOMY[Math.max(0, idx)]

  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 22,
        padding: '26px 28px',
        boxShadow: t.shadow,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: t.muted,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Niveau d'autonomie de MEGGA AI
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${D0_AUTONOMY.length}, minmax(0, 1fr))`,
          gap: 6,
          padding: 6,
          background: t.cardSubtle,
          borderRadius: 999,
          boxShadow: t.shadowSm,
        }}
      >
        {D0_AUTONOMY.map((a) => {
          const isSel = value === a.id
          return (
            <button
              key={a.id}
              onClick={() => onChange(a.id)}
              style={{
                height: 46,
                borderRadius: 999,
                border: 0,
                background: isSel ? t.black : 'transparent',
                color: isSel ? (dark ? '#0B0C0E' : '#fff') : t.inkSoft,
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: -0.2,
                cursor: 'pointer',
                boxShadow: isSel ? '0 6px 16px rgba(11,12,14,0.20)' : 'none',
                transition: 'all .2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {a.short}
            </button>
          )
        })}
      </div>

      <p
        key={current.id}
        style={{
          margin: '20px 4px 0',
          fontSize: 14.5,
          color: t.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          animation: 'd0FadeIn .25s ease both',
        }}
      >
        {current.desc}
      </p>
    </div>
  )
}

// ─── Ligne de profil (lecture d'une réponse) ─────────────────────────

function D0ProfileRow({
  icon,
  label,
  value,
  onEdit,
  delay = 0,
  t,
}: {
  icon: PxIconName
  label: string
  value: string
  onEdit: () => void
  delay?: number
  t: ObTheme
}) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 4px',
        borderBottom: `1px solid ${t.divider}`,
        animation: 'd0SlideUp .4s cubic-bezier(.2,.8,.2,1) both',
        animationDelay: `${delay}s`,
        animationFillMode: 'both',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 28,
          color: t.ink,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <PxIcon name={icon} size={20} color="currentColor" strokeWidth={1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.2,
          }}
        >
          {value}
        </div>
      </div>
      <button
        onClick={onEdit}
        style={{
          opacity: h ? 1 : 0,
          transition: 'opacity .15s',
          background: 'transparent',
          border: 0,
          padding: '4px 8px',
          borderRadius: 999,
          color: t.muted,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Modifier
      </button>
    </div>
  )
}

// ─── Ligne d'engagement IA ──────────────────────────────────────────

function D0CommitmentRow({
  text,
  delay = 0,
  dark,
  t,
}: {
  text: string
  delay?: number
  dark?: boolean
  t: ObTheme
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '16px 0',
        borderBottom: `1px solid ${t.divider}`,
        animation: 'd0SlideUp .4s cubic-bezier(.2,.8,.2,1) both',
        animationDelay: `${delay}s`,
        animationFillMode: 'both',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          marginTop: 2,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: t.black,
          color: dark ? '#0B0C0E' : '#fff',
          display: 'grid',
          placeItems: 'center',
          animation: 'd0CheckPop .45s cubic-bezier(.4,1.6,.5,1) both',
          animationDelay: `${delay + 0.2}s`,
          animationFillMode: 'both',
        }}
      >
        <PxIcon name="check" size={12} color="currentColor" strokeWidth={2.4} />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          color: t.ink,
          fontWeight: 500,
          lineHeight: 1.55,
          letterSpacing: -0.1,
        }}
      >
        {text}
      </p>
    </div>
  )
}
