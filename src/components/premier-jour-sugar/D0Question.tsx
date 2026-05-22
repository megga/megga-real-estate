// MEGGA Premier jour — Écran question générique (Q1/Q2/Q3/Q4)
// Layout commun avec eyebrow N/4, titre, sub, body selon kind (cards/zone/segmented),
// footer fixe (Précédent/Continuer), header avec logo + dots + skip.
// Transition Q→Q : cross-fade + tiny Y via Framer Motion AnimatePresence
// (mode="wait", spring stiffness 280 damping 30) — feel "content morph en
// place" plutôt que "page change".
// Source : handoff-premier-jour/premier-jour/crm-day0-calibration.jsx → D0QuestionScreen
import { AnimatePresence, motion } from 'framer-motion'
import { obPalette } from '@/components/onboarding-sugar/tokens'
import {
  ObBlackPill,
  ObGhostPill,
  ObIcon,
} from '@/components/onboarding-sugar/primitives'
import { ObThemeToggle } from '@/components/onboarding-sugar/OnboardingShell'
import { D0Dots, D0OptionCard } from './primitives'
import { D0ZoneSearch } from './D0ZoneSearch'
import type { D0Question } from './data'

export function D0QuestionScreen({
  q,
  index,
  total,
  value,
  onChange,
  onPrev,
  onNext,
  dark,
  onThemeChange,
}: {
  q: D0Question
  index: number
  total: number
  value: string | string[] | null
  onChange: (next: string | string[]) => void
  onPrev: () => void
  onNext: () => void
  dark?: boolean
  onThemeChange?: (theme: 'light' | 'dark') => void
}) {
  const t = obPalette(dark)
  const canNext = Array.isArray(value) ? value.length > 0 : !!value

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* TOP : MEGGA logo + Dots + Skip */}
      <header
        style={{
          padding: '22px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
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
        <D0Dots count={total} current={index} dark={dark} />
        {/* Toggle light/dark — partage le cookie `megga.theme` avec le wizard. */}
        {onThemeChange ? (
          <ObThemeToggle
            dark={!!dark}
            onChange={onThemeChange}
            t={t}
          />
        ) : (
          <div style={{ width: 40 }} />
        )}
      </header>

      {/* CONTENU CENTRAL */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 32px 140px',
        }}
      >
        {/* AnimatePresence mode="wait" — l'ancienne question fait son exit
            COMPLET avant que la nouvelle entre. Cross-fade + tiny Y donne
            le feel "content morph en place" (pas de page navigation). */}
        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              type: 'spring',
              stiffness: 280,
              damping: 30,
              mass: 0.6,
            }}
            style={{
              width: '100%',
              maxWidth: 720,
            }}
          >
          {/* Titre — Objectivity Bold, cohérent avec le wizard onboarding.
              Case normale (pas uppercase) car ce sont des questions, pas des
              statements monumentaux. */}
          <h1
            style={{
              margin: '0 0 14px',
              fontFamily:
                '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: 52,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              whiteSpace: 'pre-line',
            }}
          >
            {q.title}
          </h1>

          {/* Sub */}
          <p
            style={{
              margin: '0 0 36px',
              fontSize: 15,
              color: t.inkSoft,
              fontWeight: 500,
              lineHeight: 1.5,
              maxWidth: 560,
              whiteSpace: 'pre-line',
            }}
          >
            {q.sub}
          </p>

          {/* Body selon kind — grille 2×2 (Q1 4 options) ou 2-col avec
              dernière card span 2 (Q4 3 options) */}
          {q.kind === 'cards' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                marginTop: 8,
              }}
            >
              {q.options.map((o, i) => {
                const isLast = i === q.options.length - 1
                const isOdd = q.options.length % 2 === 1
                const spanFull = isLast && isOdd
                return (
                  <div
                    key={o.id}
                    style={{
                      gridColumn: spanFull ? '1 / -1' : undefined,
                      animation: 'd0SlideUp .4s cubic-bezier(.2,.8,.2,1) both',
                      animationDelay: `${i * 0.05 + 0.15}s`,
                      animationFillMode: 'both',
                    }}
                  >
                    <D0OptionCard
                      label={o.label}
                      hint={o.hint}
                      iconName={o.icon}
                      selected={value === o.id}
                      onClick={() => onChange(o.id)}
                      dark={dark}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {q.kind === 'zone' && (
            <D0ZoneSearch
              value={Array.isArray(value) ? value : []}
              onChange={(v) => onChange(v)}
              dark={dark}
            />
          )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* FOOTER fixe */}
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
          {index > 0 ? (
            <ObGhostPill
              onClick={onPrev}
              dark={dark}
              icon={<ObIcon name="arrowL" size={16} stroke={t.inkSoft} sw={2} />}
            >
              Précédent
            </ObGhostPill>
          ) : (
            <div style={{ width: 1 }} />
          )}
        </div>
        <div style={{ pointerEvents: 'auto' }}>
          <ObBlackPill
            onClick={onNext}
            disabled={!canNext}
            dark={dark}
            icon={
              <ObIcon
                name="arrowR"
                size={16}
                stroke={dark ? '#0B0C0E' : '#fff'}
                sw={2}
              />
            }
          >
            {index === total - 1 ? 'Voir la synthèse' : 'Continuer'}
          </ObBlackPill>
        </div>
      </footer>
    </div>
  )
}

