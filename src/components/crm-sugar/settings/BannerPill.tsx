// MEGGA CRM Sugar v2 — Settings banner (variation A: pill horizontal + dropdown)
// 1:1 port from `crm-screen-settings-sugar.jsx` (BannerPill).

import { useState } from 'react'
import { SetIcon } from './atoms'
import { SETTINGS_SECTIONS, SET_PALETTE, type SectionId } from './data'

const SET = SET_PALETTE

interface BannerPillProps {
  active: SectionId
  onChange: (id: SectionId) => void
}

export function BannerPill({ active, onChange }: BannerPillProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const PRIMARY = SETTINGS_SECTIONS.slice(0, 5)
  const SECONDARY = SETTINGS_SECTIONS.slice(5)
  const isInSecondary = SECONDARY.some(s => s.id === active)

  return (
    <div
      style={{
        background: SET.card,
        borderRadius: 22,
        padding: '14px 18px',
        boxShadow: SET.shadow,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: SET.muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          Paramètres
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: SET.ink,
            letterSpacing: -0.4,
            marginTop: 4,
            lineHeight: 1.1,
          }}
        >
          {SETTINGS_SECTIONS.find(s => s.id === active)?.label || ''}
        </div>
      </div>

      <div
        style={{
          width: 1,
          height: 32,
          background: SET.line,
          marginLeft: 4,
        }}
      />

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 4,
            borderRadius: 999,
            background: SET.cardSubtle,
          }}
        >
          {PRIMARY.map(s => {
            const isActive = s.id === active
            return (
              <button
                key={s.id}
                onClick={() => onChange(s.id)}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 999,
                  border: 0,
                  background: isActive ? SET.black : 'transparent',
                  color: isActive ? '#fff' : SET.inkSoft,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 600,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  transition: 'all .18s ease',
                  letterSpacing: -0.1,
                }}
              >
                {s.short}
              </button>
            )
          })}
          {SECONDARY.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMoreOpen(o => !o)}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 999,
                border: 0,
                background: isInSecondary ? SET.black : 'transparent',
                color: isInSecondary ? '#fff' : SET.inkSoft,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: isInSecondary ? 700 : 600,
                cursor: 'pointer',
                boxShadow: isInSecondary ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all .18s ease',
              }}
            >
              {isInSecondary
                ? SECONDARY.find(s => s.id === active)?.short
                : 'Plus'}
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isInSecondary ? '#fff' : SET.inkSoft}
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {moreOpen && (
              <>
                <div
                  onClick={() => setMoreOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 50,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    minWidth: 240,
                    background: SET.card,
                    borderRadius: 18,
                    padding: 8,
                    boxShadow: SET.shadowLg,
                    zIndex: 51,
                    animation: 'setFadeUp .18s cubic-bezier(.2,.8,.2,1) both',
                  }}
                >
                  {SECONDARY.map(s => {
                    const isActive = s.id === active
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          onChange(s.id)
                          setMoreOpen(false)
                        }}
                        style={{
                          width: '100%',
                          height: 40,
                          padding: '0 14px',
                          borderRadius: 12,
                          border: 0,
                          background: isActive ? SET.cardSubtle : 'transparent',
                          color: SET.ink,
                          fontFamily: 'inherit',
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          transition: 'background .15s',
                        }}
                      >
                        <SetIcon name={s.icon} size={15} stroke={SET.inkSoft} />
                        {s.label}
                        {isActive && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              color: SET.ok,
                              fontSize: 13,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: SET.muted,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: SET.ok,
            }}
          />
          Sauvegardé
        </span>
      </div>
    </div>
  )
}
