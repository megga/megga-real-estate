// MEGGA Premier jour — Écran "Aujourd'hui Premier jour"
// L'atterrissage dans le CRM. Pas vide : rempli par les conséquences du calibrage.
// - Sidebar gauche simplifiée (Today seul actif, autres muted)
// - Topbar avec search pill + avatar
// - Carte de bienvenue + 3 cartes priorité (pilotées par Q4)
// - Aperçus fantômes (Pipeline + Matching) voilés
// - Checklist d'activation pop-out bas-droite (via ActivationChecklistPill,
//   composant autonome partagé avec TodaySugarPage)
// Source : handoff-premier-jour/premier-jour/crm-day0-today.jsx
import { useState } from 'react'
import { obPalette, type ObTheme } from '@/components/onboarding-sugar/tokens'
import {
  ObIcon,
  type ObIconName,
} from '@/components/onboarding-sugar/primitives'
import { ActivationChecklistPill } from './ActivationChecklistPill'
import {
  D0_AUTONOMY,
  D0_PRIORITY_MAP,
  type D0PriorityCard as D0PriorityCardData,
} from './data'
import type { Autonomy, D0Answers, Priorite } from './types'

// ─── Écran principal ─────────────────────────────────────────────────

export function D0TodayPremierJour({
  prenom,
  agence,
  initials,
  answers,
  autonomy,
  demoLoaded,
  onLoadDemo,
  onPriorityClick,
  dark,
}: {
  prenom: string
  agence: string
  initials: string
  answers: D0Answers
  autonomy: Autonomy
  demoLoaded: boolean
  onLoadDemo: () => void
  onPriorityClick: (cardId: string) => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  const prio: Priorite = answers.priorite ?? 'closing'
  const block = D0_PRIORITY_MAP[prio]
  const autonomyLabel =
    D0_AUTONOMY.find((a) => a.id === autonomy)?.short ?? D0_AUTONOMY[0].short

  return (
    <div
      data-screen-label="07 Today Premier Jour"
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: t.bgGradient,
      }}
    >
      <D0Sidebar dark={dark} t={t} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <D0TopBar dark={dark} t={t} prenom={prenom} agence={agence} initials={initials} />

        <main
          style={{
            flex: 1,
            padding: '28px 32px 100px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* Bloc d'en-tête : titre Aujourd'hui + meta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
              animation: 'd0SlideUp .5s cubic-bezier(.2,.8,.2,1) both',
            }}
          >
            <div>
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
                {new Date().toLocaleDateString('fr-CH', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 36,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: -0.9,
                  lineHeight: 1,
                }}
              >
                Aujourd'hui
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: t.card,
                  color: t.inkSoft,
                  fontSize: 12.5,
                  fontWeight: 700,
                  letterSpacing: -0.1,
                  boxShadow: t.shadowSm,
                }}
              >
                Autonomie · {autonomyLabel}
              </span>
            </div>
          </div>

          {/* Hero : Welcome card */}
          <D0WelcomeCard prenom={prenom} intro={block.intro} dark={dark} t={t} />

          {/* 3 cartes priorité */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
            }}
          >
            {block.cards.map((c, i) => (
              <D0PriorityCard
                key={c.id}
                index={i}
                card={c}
                dark={dark}
                t={t}
                onClick={() => onPriorityClick(c.id)}
              />
            ))}
          </div>

          {/* Aperçus fantômes */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              gap: 16,
              marginTop: 8,
            }}
          >
            <D0GhostFrame
              title="Pipeline du jour"
              subtitle="Dès que vous créez votre 1ᵉʳ mandat, je le glisse ici."
              kind="pipeline"
              dark={dark}
              t={t}
              delay={0.45}
            />
            <D0GhostFrame
              title="Matching IA"
              subtitle="Activez le matching pour découvrir les acheteurs alignés sur vos biens."
              kind="matching"
              dark={dark}
              t={t}
              delay={0.55}
            />
          </div>
        </main>
      </div>

      <ActivationChecklistPill
        dark={dark}
        defaultOpen
        showWhenComplete
        demoLoaded={demoLoaded}
        onLoadDemo={onLoadDemo}
      />
    </div>
  )
}

// ─── Sidebar simplifiée Day0 ─────────────────────────────────────────

function D0Sidebar({ dark, t }: { dark?: boolean; t: ObTheme }) {
  const items: { id: string; icon: ObIconName; label: string; muted?: boolean }[] = [
    { id: 'today', icon: 'sparkle', label: "Aujourd'hui" },
    { id: 'pipeline', icon: 'pipeline', label: 'Pipeline', muted: true },
    { id: 'matching', icon: 'target', label: 'Matching', muted: true },
    { id: 'contacts', icon: 'user', label: 'Contacts', muted: true },
    { id: 'biens', icon: 'home', label: 'Mes biens', muted: true },
    { id: 'kyc', icon: 'shield', label: 'KYC', muted: true },
    { id: 'docs', icon: 'info', label: 'Documents', muted: true },
  ]
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        padding: '20px 14px',
        borderRight: `1px solid ${t.divider}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ padding: '6px 10px 22px' }}>
        <img
          src="/megga-logo.svg"
          alt="MEGGA"
          style={{
            height: 22,
            width: 'auto',
            filter: dark ? 'invert(1)' : 'none',
          }}
        />
      </div>

      {items.map((it) => {
        const isActive = it.id === 'today'
        return (
          <button
            key={it.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 12,
              border: 0,
              background: isActive ? t.card : 'transparent',
              color: isActive ? t.ink : it.muted ? t.muted : t.inkSoft,
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: isActive ? 700 : 600,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: isActive ? t.shadowSm : 'none',
              letterSpacing: -0.1,
              transition: 'all .15s ease',
            }}
          >
            <ObIcon name={it.icon} size={16} stroke="currentColor" sw={1.7} />
            {it.label}
          </button>
        )
      })}

      <div style={{ flex: 1 }} />
      <button
        style={{
          margin: '0 6px 6px',
          padding: '12px 16px',
          borderRadius: 14,
          border: 0,
          background: t.black,
          color: dark ? '#0B0C0E' : '#fff',
          fontFamily: 'inherit',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
          letterSpacing: -0.1,
        }}
      >
        <ObIcon name="plus" size={14} stroke="currentColor" sw={2.4} />
        Créer
      </button>
    </aside>
  )
}

// ─── Topbar ─────────────────────────────────────────────────────────

function D0TopBar({
  dark,
  t,
  prenom,
  agence,
  initials,
}: {
  dark?: boolean
  t: ObTheme
  prenom: string
  agence: string
  initials: string
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '18px 28px',
        borderBottom: `1px solid ${t.divider}`,
      }}
    >
      <div
        style={{
          flex: 1,
          maxWidth: 460,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 14px',
          background: t.card,
          borderRadius: 12,
          boxShadow: t.shadowSm,
          color: t.muted,
        }}
      >
        <ObIcon name="search" size={15} stroke="currentColor" sw={1.8} />
        <span
          style={{
            fontSize: 13,
            color: t.muted,
            fontWeight: 500,
            letterSpacing: -0.1,
          }}
        >
          Rechercher partout
        </span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '2px 6px',
            borderRadius: 6,
            background: dark ? 'rgba(236,237,243,0.06)' : 'rgba(11,12,14,0.06)',
            color: t.muted,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.4,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          ⌘ K
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 12px 4px 4px',
          borderRadius: 999,
          background: t.card,
          boxShadow: t.shadowSm,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: t.black,
            color: dark ? '#0B0C0E' : '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: -0.2,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: -0.1,
              lineHeight: 1.1,
            }}
          >
            {prenom}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: t.muted,
              fontWeight: 600,
              letterSpacing: -0.1,
              lineHeight: 1.1,
            }}
          >
            {agence}
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── Carte de bienvenue (sobre) ──────────────────────────────────────

function D0WelcomeCard({
  prenom,
  intro,
  dark,
  t,
}: {
  prenom: string
  intro: string
  dark?: boolean
  t: ObTheme
}) {
  void dark
  return (
    <div
      style={{
        background: t.card,
        borderRadius: 22,
        padding: '26px 28px',
        boxShadow: t.shadow,
        animation: 'd0SlideUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: t.ink,
          letterSpacing: -0.5,
          lineHeight: 1.25,
          marginBottom: 10,
        }}
      >
        On y va, {prenom} ?
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          color: t.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          maxWidth: 640,
        }}
      >
        {intro} Voici les 3 actions qui auront le plus d'impact dans les prochains jours.
      </p>
    </div>
  )
}

// ─── Carte priorité ──────────────────────────────────────────────────

function D0PriorityCard({
  index,
  card,
  dark,
  t,
  onClick,
}: {
  index: number
  card: D0PriorityCardData
  dark?: boolean
  t: ObTheme
  onClick: () => void
}) {
  const [h, setH] = useState(false)
  void dark
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        textAlign: 'left',
        fontFamily: 'inherit',
        background: t.card,
        border: 0,
        borderRadius: 20,
        padding: '24px 24px 22px',
        cursor: 'pointer',
        boxShadow: h ? t.shadowHov : t.shadow,
        transform: h ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 180,
        animation: 'd0SlideUp .5s cubic-bezier(.2,.8,.2,1) both',
        animationDelay: `${index * 0.08 + 0.15}s`,
        animationFillMode: 'both',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: t.muted,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {String(index + 1).padStart(2, '0')} · Action
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.35,
            marginBottom: 8,
            lineHeight: 1.25,
          }}
        >
          {card.title}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: t.muted,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {card.sub}
        </div>
      </div>

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: h ? t.black : t.inkSoft,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: -0.1,
          transition: 'color .15s',
        }}
      >
        Commencer
        <span
          style={{
            display: 'inline-flex',
            transform: h ? 'translateX(4px)' : 'translateX(0)',
            transition: 'transform .25s ease',
          }}
        >
          <ObIcon name="arrowR" size={14} stroke="currentColor" sw={2.2} />
        </span>
      </div>
    </button>
  )
}

// ─── Frame fantôme (aperçu Pipeline/Matching voilé) ──────────────────

function D0GhostFrame({
  title,
  subtitle,
  kind,
  dark,
  t,
  delay = 0,
}: {
  title: string
  subtitle: string
  kind: 'pipeline' | 'matching'
  dark?: boolean
  t: ObTheme
  delay?: number
}) {
  return (
    <div
      style={{
        position: 'relative',
        background: t.card,
        borderRadius: 20,
        padding: '22px 24px 26px',
        boxShadow: t.shadow,
        overflow: 'hidden',
        minHeight: 200,
        animation: 'd0SlideUp .55s cubic-bezier(.2,.8,.2,1) both',
        animationDelay: `${delay}s`,
        animationFillMode: 'both',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: t.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Aperçu
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: -0.3,
            }}
          >
            {title}
          </div>
        </div>
        <span
          style={{
            padding: '5px 10px',
            borderRadius: 999,
            background: t.cardSubtle,
            color: t.muted,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          Vide
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          marginTop: 8,
          animation: 'd0GhostPulse 3.2s ease-in-out infinite',
        }}
      >
        {kind === 'pipeline' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {(
              [
                { name: 'Mandat', h: [42, 22, 60] },
                { name: 'Visite', h: [30, 38] },
                { name: 'Offre', h: [54] },
                { name: 'Compromis', h: [28, 22] },
              ] as const
            ).map((col, i) => (
              <div
                key={i}
                style={{
                  background: t.cardSubtle,
                  borderRadius: 10,
                  padding: '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  minHeight: 110,
                }}
              >
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: t.muted,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  {col.name}
                </div>
                {col.h.map((h, j) => (
                  <div
                    key={j}
                    style={{
                      height: h,
                      borderRadius: 6,
                      background: dark
                        ? 'rgba(236,237,243,0.06)'
                        : 'rgba(11,12,14,0.06)',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        {kind === 'matching' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  background: t.cardSubtle,
                  borderRadius: 10,
                  padding: '10px 12px',
                  minHeight: 50,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: dark
                      ? 'rgba(236,237,243,0.08)'
                      : 'rgba(11,12,14,0.08)',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <div
                    style={{
                      height: 6,
                      width: '70%',
                      borderRadius: 3,
                      background: dark
                        ? 'rgba(236,237,243,0.08)'
                        : 'rgba(11,12,14,0.08)',
                    }}
                  />
                  <div
                    style={{
                      height: 5,
                      width: '40%',
                      borderRadius: 3,
                      background: dark
                        ? 'rgba(236,237,243,0.05)'
                        : 'rgba(11,12,14,0.05)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voile + label central */}
      <div
        style={{
          position: 'absolute',
          inset: '60px 0 0 0',
          background: dark
            ? 'linear-gradient(180deg, rgba(22,22,31,0) 0%, rgba(22,22,31,0.6) 50%, rgba(22,22,31,0.92) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.96) 100%)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0 0 18px',
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            color: t.muted,
            fontWeight: 600,
            letterSpacing: -0.1,
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  )
}
