interface Props { className?: string }

export default function EmptyContactsIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 160 120" fill="none" className={className}>
      {/* Address book */}
      <rect x="40" y="15" width="80" height="90" rx="6" fill="#F8FAFC" />
      <rect x="40" y="15" width="80" height="90" rx="6" stroke="#E2E8F0" strokeWidth="1.2" fill="none" />
      {/* Spine */}
      <rect x="40" y="15" width="8" height="90" rx="3" fill="#E2E8F0" />
      {/* Binding rings */}
      <circle cx="44" cy="35" r="3" stroke="#CBD5E1" strokeWidth="1" fill="#F1F5F9" />
      <circle cx="44" cy="60" r="3" stroke="#CBD5E1" strokeWidth="1" fill="#F1F5F9" />
      <circle cx="44" cy="85" r="3" stroke="#CBD5E1" strokeWidth="1" fill="#F1F5F9" />

      {/* Empty lines */}
      <rect x="58" y="30" width="40" height="3" rx="1.5" fill="#E2E8F0" opacity="0.5" />
      <rect x="58" y="38" width="30" height="3" rx="1.5" fill="#E2E8F0" opacity="0.3" />
      <rect x="58" y="55" width="35" height="3" rx="1.5" fill="#E2E8F0" opacity="0.5" />
      <rect x="58" y="63" width="25" height="3" rx="1.5" fill="#E2E8F0" opacity="0.3" />
      <rect x="58" y="80" width="38" height="3" rx="1.5" fill="#E2E8F0" opacity="0.5" />
      <rect x="58" y="88" width="28" height="3" rx="1.5" fill="#E2E8F0" opacity="0.3" />

      {/* Plus circle */}
      <circle cx="110" cy="25" r="12" fill="#3B82F6" opacity="0.1" />
      <circle cx="110" cy="25" r="12" stroke="#3B82F6" strokeWidth="1" fill="none" opacity="0.3" />
      <line x1="110" y1="19" x2="110" y2="31" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="104" y1="25" x2="116" y2="25" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* Person silhouette outline */}
      <circle cx="100" cy="65" r="6" stroke="#CBD5E1" strokeWidth="1" fill="none" strokeDasharray="2 2" opacity="0.4" />
      <path d="M92 80 C92 74 108 74 108 80" stroke="#CBD5E1" strokeWidth="1" fill="none" strokeDasharray="2 2" opacity="0.4" />
    </svg>
  )
}
