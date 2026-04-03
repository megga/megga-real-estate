interface Props { className?: string }

export default function EmptyMessagesIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 160 120" fill="none" className={className}>
      {/* Main chat bubble */}
      <rect x="30" y="20" width="100" height="60" rx="12" fill="#F8FAFC" />
      <rect x="30" y="20" width="100" height="60" rx="12" stroke="#E2E8F0" strokeWidth="1.2" fill="none" />
      {/* Tail */}
      <path d="M55 80 L48 95 L68 80" fill="#F8FAFC" />
      <path d="M55 80 L48 95 L68 80" stroke="#E2E8F0" strokeWidth="1.2" fill="none" />
      {/* Cover the inner stroke */}
      <rect x="54" y="75" width="16" height="6" fill="#F8FAFC" />

      {/* Dotted text lines */}
      <rect x="48" y="35" width="64" height="3.5" rx="1.5" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" fill="none" opacity="0.4" />
      <rect x="48" y="44" width="48" height="3.5" rx="1.5" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" fill="none" opacity="0.3" />
      <rect x="48" y="53" width="56" height="3.5" rx="1.5" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" fill="none" opacity="0.2" />

      {/* Typing indicator dots */}
      <circle cx="65" cy="67" r="2.5" fill="#CBD5E1" opacity="0.3" />
      <circle cx="75" cy="67" r="2.5" fill="#CBD5E1" opacity="0.4" />
      <circle cx="85" cy="67" r="2.5" fill="#CBD5E1" opacity="0.5" />

      {/* Small secondary bubble */}
      <rect x="105" y="85" width="35" height="18" rx="9" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="112" y="92" width="20" height="2.5" rx="1" fill="#CBD5E1" opacity="0.3" />
    </svg>
  )
}
