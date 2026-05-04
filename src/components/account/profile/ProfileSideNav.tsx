import { useEffect, useState } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'

export interface SideNavSection {
  id: string
  label: string
  count?: number
}

interface Props {
  sections: SideNavSection[]
  topOffset?: number
}

export default function ProfileSideNav({ sections, topOffset = 96 }: Props) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const onScroll = () => {
      const probe = topOffset + 24
      let current = elements[0].id
      for (const el of elements) {
        const rect = el.getBoundingClientRect()
        if (rect.top - probe <= 0) current = el.id
        else break
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [sections, topOffset])

  const goTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.pageYOffset - topOffset
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: topOffset,
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '4px 0',
        minWidth: 168,
      }}
    >
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 10,
          fontWeight: 800,
          color: T.muted,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          padding: '4px 12px 10px',
        }}
      >
        Sur cette page
      </div>
      {sections.map((s) => {
        const isActive = active === s.id
        return (
          <button
            key={s.id}
            onClick={() => goTo(s.id)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: T.fontStack,
              fontSize: 12.5,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? T.ink : T.soft,
              transition: 'color 0.15s ease',
              borderRadius: 8,
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = T.ink
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = T.soft
            }}
          >
            <span
              style={{
                width: 3,
                alignSelf: 'stretch',
                borderRadius: 999,
                background: isActive ? T.accent : 'transparent',
                transition: 'background 0.15s ease',
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>{s.label}</span>
            {s.count !== undefined && s.count > 0 && (
              <span
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 10,
                  fontWeight: 700,
                  color: isActive ? T.accent : T.muted,
                  fontVariantNumeric: 'tabular-nums',
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: isActive ? T.accentSoft : '#F2F4F8',
                }}
              >
                {s.count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
