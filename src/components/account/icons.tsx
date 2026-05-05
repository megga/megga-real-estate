// Stroke-only icons for the account page (matches MEGGA Compte design — current color)

interface IconProps {
  size?: number
}

export const SearchIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
)

export const HomeIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2z" />
  </svg>
)

export const BookmarkIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
)

export const HeartIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7.5-4.7-7.5-10.3A4.7 4.7 0 0112 6.5a4.7 4.7 0 017.5 4.2C19.5 16.3 12 21 12 21z" />
  </svg>
)

export const MessageIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h18v12H8l-5 3z" />
  </svg>
)

export const UserIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="9" r="3.6" />
    <path d="M4.5 21c1.5-4.5 4.5-6 7.5-6s6 1.5 7.5 6" />
  </svg>
)

export const BellIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6a4 4 0 018 0v3l1 1.5H2L3 9z" />
    <path d="M5.5 12a1.5 1.5 0 003 0" />
  </svg>
)

export const BellOffIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6a4 4 0 018 0v3l1 1.5H2L3 9z" />
    <path d="M1 1l12 12" />
  </svg>
)

export const TrashIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l1 9h6l1-9" />
  </svg>
)

export const ChevronRightIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3l4 4-4 4" />
  </svg>
)

export const ChevronDownIcon = ({ size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5l4 4 4-4" />
  </svg>
)

export const SettingsIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
)

export const HelpIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </svg>
)

export const LogoutIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
    <path d="M10 17l-5-5 5-5" />
    <path d="M5 12h11" />
  </svg>
)

export const SendIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2L7.5 14l-2-6-6-2z" />
  </svg>
)

export const AttachIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

export const CameraIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

export const CheckIcon = ({ size = 13 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
)

export const VerifiedBadge = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M10 1.5L11.5 2.5L13 2L14 3.5L15.5 4L15.5 5.5L17 6.5L16.5 8L17.5 9.5L16.5 11L17 12.5L15.5 13.5L15.5 15L14 15.5L13 17L11.5 16.5L10 17.5L8.5 16.5L7 17L6 15.5L4.5 15L4.5 13.5L3 12.5L3.5 11L2.5 9.5L3.5 8L3 6.5L4.5 5.5L4.5 4L6 3.5L7 2L8.5 2.5L10 1.5Z" fill="#0041D9" stroke="#0041D9" strokeWidth="1" strokeLinejoin="round" />
    <path d="M6.8 10.1L9 12.5L13.4 7.4" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
