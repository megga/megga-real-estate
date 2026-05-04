import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import {
  SearchIcon,
  HomeIcon,
  BookmarkIcon,
  HeartIcon,
  MessageIcon,
  UserIcon,
} from './icons'

export type SectionKey = 'listings' | 'searches' | 'favorites' | 'messages' | 'profile'

interface SectionDef {
  key: SectionKey
  labelKey: string
  icon: (props: { size?: number }) => React.ReactElement
}

export const SECTIONS: SectionDef[] = [
  { key: 'listings', labelKey: 'rail.listings', icon: HomeIcon },
  { key: 'searches', labelKey: 'rail.searches', icon: BookmarkIcon },
  { key: 'favorites', labelKey: 'rail.favorites', icon: HeartIcon },
  { key: 'messages', labelKey: 'rail.messages', icon: MessageIcon },
  { key: 'profile', labelKey: 'rail.profile', icon: UserIcon },
]

interface RailTabProps {
  active: boolean
  Icon: (props: { size?: number }) => React.ReactElement
  label: string
  count?: number
  onClick?: () => void
  href?: string
}

function RailTab({ active, Icon, label, count, onClick, href }: RailTabProps) {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: '10px 6px',
    borderRadius: 12,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textDecoration: 'none',
  }

  const inner = (
    <>
      <div
        style={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? '#fff' : 'transparent',
          border: active ? `1px solid ${T.border}` : '1px solid transparent',
          boxShadow: active ? '0 1px 2px rgba(14,20,16,0.04)' : 'none',
          color: active ? T.ink : T.soft,
          transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
        }}
      >
        <Icon size={22} />
        {count !== undefined && count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: T.danger,
              color: '#fff',
              fontFamily: T.fontStack,
              fontSize: 10,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${T.page}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: T.fontStack,
          fontSize: 11,
          fontWeight: 600,
          color: active ? T.ink : T.muted,
          textAlign: 'center',
          lineHeight: 1.2,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </span>
    </>
  )

  if (href) {
    return (
      <a href={href} style={baseStyle}>
        {inner}
      </a>
    )
  }
  return (
    <button onClick={onClick} style={baseStyle}>
      {inner}
    </button>
  )
}

interface Props {
  section: SectionKey
  counts: Record<SectionKey, number>
  onSelect: (key: SectionKey) => void
}

export default function AccountRail({ section, counts, onSelect }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation('compte')

  return (
    <aside
      style={{
        background: T.page,
        borderRight: `1px solid ${T.border}`,
        padding: '24px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'sticky',
        top: 64,
        height: 'calc(100vh - 64px)',
      }}
    >
      <RailTab
        active={false}
        Icon={SearchIcon}
        label={t('rail.search')}
        onClick={() => navigate('/louer')}
      />
      <div style={{ height: 1, background: T.border, margin: '8px 12px' }} />
      {SECTIONS.map((s) => (
        <RailTab
          key={s.key}
          active={section === s.key}
          Icon={s.icon}
          label={t(s.labelKey)}
          count={counts[s.key]}
          onClick={() => onSelect(s.key)}
        />
      ))}
    </aside>
  )
}
