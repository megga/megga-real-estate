interface Props { className?: string }

export default function EmptyKycIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 160 120" fill="none" className={className}>
      {/* Folder */}
      <path d="M30 30 L30 25 L55 25 L60 30" fill="#F1F5F9" />
      <rect x="25" y="30" width="90" height="65" rx="4" fill="#F8FAFC" />
      <rect x="25" y="30" width="90" height="65" rx="4" stroke="#E2E8F0" strokeWidth="1.2" fill="none" />
      {/* Tab */}
      <path d="M25 30 L25 26 Q25 23 28 23 L52 23 Q55 23 56 26 L60 30" stroke="#E2E8F0" strokeWidth="1.2" fill="none" />

      {/* Empty folder interior - dotted documents */}
      <rect x="38" y="42" width="30" height="38" rx="2" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="3 2" fill="none" opacity="0.3" />
      <rect x="42" y="50" width="22" height="2.5" rx="1" fill="#CBD5E1" opacity="0.2" />
      <rect x="42" y="56" width="16" height="2.5" rx="1" fill="#CBD5E1" opacity="0.2" />
      <rect x="42" y="62" width="18" height="2.5" rx="1" fill="#CBD5E1" opacity="0.2" />

      {/* Shield overlay */}
      <g transform="translate(95, 45)">
        <path d="M0 -12 L14 -4 L14 8 C14 16 0 22 0 22 C0 22 -14 16 -14 8 L-14 -4 Z" fill="#DBEAFE" opacity="0.3" />
        <path d="M0 -12 L14 -4 L14 8 C14 16 0 22 0 22 C0 22 -14 16 -14 8 L-14 -4 Z" stroke="#93C5FD" strokeWidth="1" fill="none" opacity="0.5" />
        {/* Check inside shield */}
        <path d="M-5 3 L-1 7 L6 -1" stroke="#3B82F6" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
      </g>

      {/* Upload arrow */}
      <g transform="translate(75, 100)">
        <path d="M0 5 L0 -3" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
        <path d="M-4 0 L0 -4 L4 0" stroke="#3B82F6" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
      </g>
    </svg>
  )
}
