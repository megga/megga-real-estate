// MEGGA Premier jour — Pastille checklist d'activation (bas-droite)
// Composant autonome qui suit l'agent du sas Premier jour vers le Today
// permanent. Lit/écrit `profiles.activation_checklist` via
// `useActivationChecklist()` (persistance Supabase, optimistic updates).
//
// La pastille se masque automatiquement à 5/5 (handoff §"Today Premier
// jour" : "pilule discrète « Activation complète ✓ »… le bouton se grise
// pour ne plus s'ouvrir au prochain login"). Une fois complète, l'agent
// peut ré-ouvrir via la prop `showWhenComplete` si besoin pour le contrôle.
import { useState } from 'react'
import { obPalette } from '@/components/onboarding-sugar/tokens'
import {
  ObIcon,
  type ObIconName,
} from '@/components/onboarding-sugar/primitives'
import { useActivationChecklist } from '@/hooks/useActivationChecklist'

export function ActivationChecklistPill({
  dark,
  defaultOpen = true,
  showWhenComplete = false,
  // Mode démo : seul le sas Premier jour expose ces affordances. Sur
  // TodaySugarPage on n'affiche pas le footer "Charger un exemple".
  demoLoaded,
  onLoadDemo,
}: {
  dark?: boolean
  defaultOpen?: boolean
  showWhenComplete?: boolean
  demoLoaded?: boolean
  onLoadDemo?: () => void
}) {
  const t = obPalette(dark)
  const { items, doneCount, total, isComplete, isLoading, toggle } =
    useActivationChecklist()
  const [open, setOpen] = useState(defaultOpen)

  // Masque la pastille tant que la query charge OU quand 5/5 (sauf si
  // l'appelant force l'affichage).
  if (isLoading) return null
  if (isComplete && !showWhenComplete) return null

  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const showDemoFooter = onLoadDemo !== undefined

  return (
    <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 80 }}>
      {open && (
        <div
          style={{
            width: 360,
            background: t.card,
            borderRadius: 22,
            boxShadow: t.shadowLg,
            marginBottom: 12,
            animation: 'd0SlideUp .35s cubic-bezier(.2,.8,.2,1) both',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 22px 16px',
              borderBottom: `1px solid ${t.divider}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: t.muted,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                Activation
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 4,
                  color: t.muted,
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
                <ObIcon name="close" size={14} stroke="currentColor" sw={2} />
              </button>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: -0.3,
                marginBottom: 8,
              }}
            >
              {isComplete
                ? 'Activation complète ✓'
                : `${doneCount} sur ${total} étapes`}
            </div>
            {/* Progress bar */}
            <div
              style={{
                height: 6,
                borderRadius: 999,
                overflow: 'hidden',
                background: dark
                  ? 'rgba(236,237,243,0.08)'
                  : 'rgba(11,12,14,0.06)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: t.black,
                  borderRadius: 999,
                  transition: 'width .4s cubic-bezier(.2,.8,.2,1)',
                }}
              />
            </div>
          </div>

          {/* Items */}
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px 10px' }}>
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => toggle(it.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'background .15s ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = t.cardSubtle)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: it.done ? t.black : 'transparent',
                    border: it.done ? 0 : `1.5px solid ${t.ghost}`,
                    color: dark ? '#0B0C0E' : '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    transition: 'all .2s ease',
                  }}
                >
                  {it.done && (
                    <ObIcon name="check" size={12} stroke="currentColor" sw={2.6} />
                  )}
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: t.cardSubtle,
                    color: t.ink,
                    display: 'grid',
                    placeItems: 'center',
                    opacity: it.done ? 0.5 : 1,
                  }}
                >
                  <ObIcon
                    name={it.icon as ObIconName}
                    size={14}
                    stroke="currentColor"
                    sw={1.7}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: it.done ? t.muted : t.ink,
                      textDecoration: it.done ? 'line-through' : 'none',
                      letterSpacing: -0.1,
                    }}
                  >
                    {it.label}
                  </div>
                </div>
                {!it.done && (
                  <div
                    style={{
                      fontSize: 11,
                      color: t.muted,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {it.est}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Footer démo (Premier jour uniquement) */}
          {showDemoFooter && (
            <div
              style={{
                padding: '14px 22px',
                borderTop: `1px solid ${t.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  color: t.muted,
                  fontWeight: 500,
                  letterSpacing: -0.1,
                }}
              >
                {demoLoaded ? "Données d'exemple chargées" : 'Curieuse de voir ?'}
              </div>
              {!import.meta.env.PROD && (
                <button
                  onClick={onLoadDemo}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: '6px 10px',
                    color: t.ink,
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: 8,
                    letterSpacing: -0.1,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  {demoLoaded ? 'Nettoyer' : 'Charger un exemple'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pilule fermée (compteur live) */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          height: 50,
          padding: '0 18px 0 14px',
          borderRadius: 999,
          border: 0,
          background: t.black,
          color: dark ? '#0B0C0E' : '#fff',
          fontFamily: 'inherit',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: -0.1,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 12px 30px rgba(11,12,14,0.30)',
          transition: 'transform .15s ease',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.transform = 'translateY(-2px)')
        }
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            background: dark ? '#0B0C0E' : '#fff',
            color: dark ? '#fff' : '#0B0C0E',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {doneCount}
        </div>
        Activation
        <span style={{ opacity: 0.6, fontWeight: 600 }}>/{total}</span>
        <span
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform .25s ease',
            marginLeft: 2,
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
    </div>
  )
}
