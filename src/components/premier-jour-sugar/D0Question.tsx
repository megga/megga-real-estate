// MEGGA Premier jour — Écran question générique (Q1/Q2/Q3/Q4)
// Layout commun avec eyebrow N/4, titre, sub, body selon kind (cards/zone/segmented),
// footer fixe (Précédent/Continuer), header avec logo + dots + skip.
// Source : handoff-premier-jour/premier-jour/crm-day0-calibration.jsx → D0QuestionScreen
import { obPalette, type ObTheme } from '@/components/onboarding-sugar/tokens'
import {
  ObBlackPill,
  ObGhostPill,
  ObIcon,
} from '@/components/onboarding-sugar/primitives'
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
  onSkip,
  dark,
}: {
  q: D0Question
  index: number
  total: number
  value: string | string[] | null
  onChange: (next: string | string[]) => void
  onPrev: () => void
  onNext: () => void
  onSkip: () => void
  dark?: boolean
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
        <button
          onClick={onSkip}
          style={{
            background: 'transparent',
            border: 0,
            padding: '6px 10px',
            color: t.muted,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: -0.1,
          }}
        >
          Passer le calibrage
        </button>
      </header>

      {/* CONTENU CENTRAL */}
      <main
        key={q.id}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 32px 140px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 720,
            animation: 'd0SlideUp .45s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          {/* Eyebrow — numéro de question */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: t.muted,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 18,
              fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
            }}
          >
            {q.eyebrow}
          </div>

          {/* Titre */}
          <h1
            style={{
              margin: '0 0 14px',
              fontSize: 38,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: -1,
              lineHeight: 1.1,
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
            }}
          >
            {q.sub}
          </p>

          {/* Body selon kind */}
          {q.kind === 'cards' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 8,
              }}
            >
              {q.options.map((o, i) => (
                <div
                  key={o.id}
                  style={{
                    animation: 'd0SlideUp .4s cubic-bezier(.2,.8,.2,1) both',
                    animationDelay: `${i * 0.05 + 0.15}s`,
                    animationFillMode: 'both',
                  }}
                >
                  <D0OptionCard
                    label={o.label}
                    hint={o.hint}
                    selected={value === o.id}
                    onClick={() => onChange(o.id)}
                    dark={dark}
                  />
                </div>
              ))}
            </div>
          )}

          {q.kind === 'zone' && (
            <D0ZoneSearch
              value={Array.isArray(value) ? value : []}
              onChange={(v) => onChange(v)}
              dark={dark}
            />
          )}

          {q.kind === 'segmented' && (
            <D0Segmented
              options={q.options}
              value={typeof value === 'string' ? value : null}
              onChange={(v) => onChange(v)}
              dark={dark}
              t={t}
            />
          )}
        </div>
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

// ─── Segmented control 3 positions (Q3 dispo) ────────────────────────

function D0Segmented({
  options,
  value,
  onChange,
  dark,
  t,
}: {
  options: { id: string; label: string; hint: string }[]
  value: string | null
  onChange: (id: string) => void
  dark?: boolean
  t: ObTheme
}) {
  const active = options.find((o) => o.id === value)
  return (
    <div style={{ marginTop: 8 }}>
      {/* Segmented */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
          gap: 6,
          padding: 6,
          background: t.cardSubtle,
          borderRadius: 999,
          boxShadow: t.shadowSm,
        }}
      >
        {options.map((o) => {
          const isSel = value === o.id
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              style={{
                height: 48,
                borderRadius: 999,
                border: 0,
                background: isSel ? t.black : 'transparent',
                color: isSel ? (dark ? '#0B0C0E' : '#fff') : t.inkSoft,
                fontFamily: 'inherit',
                fontSize: 14.5,
                fontWeight: 600,
                letterSpacing: -0.2,
                cursor: 'pointer',
                boxShadow: isSel ? '0 6px 16px rgba(11,12,14,0.20)' : 'none',
                transition: 'all .2s ease',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {/* Détail dynamique en dessous */}
      <div
        key={active?.id ?? 'none'}
        style={{
          marginTop: 22,
          textAlign: 'center',
          animation: 'd0FadeIn .25s ease both',
        }}
      >
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
          Concrètement
        </div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: t.ink,
            letterSpacing: -0.3,
          }}
        >
          {active?.hint ?? '—'}
        </div>
      </div>
    </div>
  )
}
