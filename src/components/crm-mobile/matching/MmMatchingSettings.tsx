import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'

const MS_LS_KEY = 'megga-matching-mode'
const MS_DEFAULT_MODE = 'balanced'
const MS_MODE_IDS = ['wide', 'balanced', 'precise'] as const
type MsMode = (typeof MS_MODE_IDS)[number]

function msLoadMode(): MsMode {
  try {
    const v = window.localStorage.getItem(MS_LS_KEY)
    return (MS_MODE_IDS as readonly string[]).includes(v ?? '') ? (v as MsMode) : MS_DEFAULT_MODE
  } catch {
    return MS_DEFAULT_MODE
  }
}

const GLYPHS: Record<string, string> = {
  back: 'M15 5l-7 7 7 7',
  check: 'M5 13l4 4 10-12',
}

function Glyph({ name, size = 18, sw = 1.85, color = 'currentColor' }: { name: string; size?: number; sw?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d={GLYPHS[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface MmMatchingSettingsProps {
  open: boolean
  onClose: () => void
  onSaved?: (mode: MsMode) => void
}

/**
 * Réglages du matching — overlay plein écran. L'agent choisit la « largeur » du
 * filet (3 modes), persisté en `localStorage`. AUCUN backend : le barème
 * détaillé reste server-side (`app_config.matching_scoring_v2`).
 */
export default function MmMatchingSettings({ open, onClose, onSaved }: MmMatchingSettingsProps) {
  const { tk } = useMobileTokens()
  const { t } = useTranslation('matching')
  const reducedMotion = useReducedMotion()
  const [mode, setMode] = useState<MsMode>(msLoadMode)

  const modes: { id: MsMode; reco?: boolean }[] = [
    { id: 'wide' },
    { id: 'balanced', reco: true },
    { id: 'precise' },
  ]

  const save = () => {
    try {
      window.localStorage.setItem(MS_LS_KEY, mode)
    } catch {
      /* localStorage indisponible — le réglage reste en mémoire de session */
    }
    onSaved?.(mode)
    onClose()
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
          transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 130,
            display: 'flex',
            flexDirection: 'column',
            background: tk.canvas,
            fontFamily: MOBILE_FONT,
            color: tk.ink,
            overflow: 'hidden',
          }}
        >
          <header
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 14px)',
              paddingLeft: 14,
              paddingRight: 16,
              paddingBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t('mobile.back')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                border: 0,
                background: tk.card,
                boxShadow: tk.shadowSm,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Glyph name="back" size={20} sw={2.1} color={tk.ink} />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: tk.ink }}>
                {t('mobile.settings.title')}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: tk.muted, marginTop: 1 }}>
                {t('mobile.settings.sub')}
              </div>
            </div>
          </header>

          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '20px 18px 130px',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <h1
              style={{
                margin: '0 4px 20px',
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: -0.7,
                color: tk.ink,
                lineHeight: 1.2,
              }}
            >
              {t('mobile.settings.question')}
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {modes.map((m) => {
                const on = m.id === mode
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 0,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: on ? tk.cardSubtle : tk.card,
                      borderRadius: 18,
                      padding: 18,
                      display: 'flex',
                      gap: 15,
                      alignItems: 'flex-start',
                      boxShadow: on ? `0 0 0 2px ${tk.ink} inset, ${tk.shadowSm}` : tk.shadowSm,
                      transition: 'box-shadow .18s ease, background .18s ease',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, color: tk.ink }}>
                          {t(`mobile.settings.${m.id}`)}
                        </span>
                        {m.reco ? (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                              color: tk.accentInk,
                              background: tk.ink,
                              padding: '2px 8px',
                              borderRadius: 999,
                            }}
                          >
                            {t('mobile.settings.recommended')}
                          </span>
                        ) : null}
                        <span
                          style={{
                            marginLeft: 'auto',
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            background: on ? tk.ink : 'transparent',
                            boxShadow: on ? 'none' : `0 0 0 2px ${tk.ghost} inset`,
                          }}
                        >
                          {on ? <Glyph name="check" size={13} sw={2.6} color={tk.accentInk} /> : null}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: tk.muted, marginTop: 3 }}>
                        {t(`mobile.settings.${m.id}Desc`)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </main>

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '14px 18px calc(18px + env(safe-area-inset-bottom))',
              background: `linear-gradient(to top, ${tk.pageBg} 70%, transparent)`,
            }}
          >
            <button
              type="button"
              onClick={save}
              style={{
                width: '100%',
                height: 50,
                borderRadius: 999,
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: -0.2,
                color: tk.accentInk,
                background: tk.accent,
                boxShadow: tk.shadowLg,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
              }}
            >
              <Glyph name="check" size={18} sw={2.4} color={tk.accentInk} />
              {t('mobile.settings.save')}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
