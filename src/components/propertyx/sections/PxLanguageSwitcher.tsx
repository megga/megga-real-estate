// MEGGA Marketplace — Property X language switcher (FR / DE / EN / IT).
//
// Bouton dropdown qui affiche la langue active et permet de la changer.
// Persiste le choix via localStorage (clé `megga-language` — voir i18n/index.ts
// detection.lookupLocalStorage). Au changement, i18n charge le bundle de la
// langue cible si pas encore en mémoire (DE/EN/IT sont lazy-loadés).

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PX, PxIcon } from '..'

interface Lang {
  code: 'fr' | 'de' | 'en' | 'it'
  label: string         // "Français"
  short: string         // "FR" — affiché en pill quand replié
}

const LANGS: readonly Lang[] = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'de', label: 'Deutsch',  short: 'DE' },
  { code: 'en', label: 'English',  short: 'EN' },
  { code: 'it', label: 'Italiano', short: 'IT' },
] as const

function normalizeCode(raw: string | undefined): Lang['code'] {
  const short = (raw ?? 'fr').slice(0, 2).toLowerCase()
  return (LANGS.find(l => l.code === short)?.code) ?? 'fr'
}

export default function PxLanguageSwitcher() {
  const { i18n } = useTranslation()
  const active = normalizeCode(i18n.language)
  const activeLang = LANGS.find(l => l.code === active) ?? LANGS[0]

  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Fermer si clic à l'extérieur (utile pour mobile sans hover)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  const handleSelect = (code: Lang['code']) => {
    void i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative' }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Langue : ${activeLang.label}`}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 12,
          paddingRight: 10,
          paddingTop: 8,
          paddingBottom: 8,
          background: 'transparent',
          border: `1px solid ${PX.neutral300}`,
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: PX.font.display,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: '-0.3px',
          color: PX.neutral700,
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = PX.neutral700 }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = PX.neutral300 }}
      >
        <span style={{ paddingTop: 1 }}>{activeLang.short}</span>
        <PxIcon name="chevron-down" size={14} color={PX.neutral500} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Sélectionner la langue"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 180,
            padding: 6,
            background: PX.neutral100,
            border: `1px solid ${PX.neutral300}`,
            borderRadius: 14,
            boxShadow: PX.shadow.small,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 50,
          }}
        >
          {LANGS.map(lang => {
            const isActive = lang.code === active
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => handleSelect(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: isActive ? PX.neutral200 : 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: PX.font.display,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: '-0.3px',
                  color: PX.neutral700,
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = PX.neutral200
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: PX.neutral400,
                    letterSpacing: 0.5,
                    minWidth: 22,
                  }}>
                    {lang.short}
                  </span>
                  {lang.label}
                </span>
                {isActive ? (
                  <PxIcon name="check" size={14} color={PX.neutral700} />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
