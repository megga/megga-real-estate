interface Props { className?: string }

export default function EmptyTicketsIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 160 120" fill="none" className={className}>
      {/* Inbox tray */}
      <path d="M35 55 L25 80 L25 95 Q25 100 30 100 L130 100 Q135 100 135 95 L135 80 L125 55" fill="#F8FAFC" />
      <path d="M35 55 L25 80 L25 95 Q25 100 30 100 L130 100 Q135 100 135 95 L135 80 L125 55" stroke="#E2E8F0" strokeWidth="1.2" fill="none" />
      {/* Tray lip */}
      <path d="M25 80 L55 80 Q60 80 60 75 L65 70 Q65 65 70 65 L90 65 Q95 65 95 70 L100 75 Q100 80 105 80 L135 80" stroke="#E2E8F0" strokeWidth="1" fill="none" />

      {/* Checkmark - everything handled */}
      <circle cx="80" cy="40" r="18" fill="#D1FAE5" opacity="0.3" />
      <circle cx="80" cy="40" r="18" stroke="#86EFAC" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M70 40 L77 48 L92 32" stroke="#22C55E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />

      {/* Small envelope (handled) */}
      <g transform="translate(60, 82)" opacity="0.3">
        <rect width="18" height="12" rx="2" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.8" />
        <path d="M0 0 L9 6 L18 0" stroke="#CBD5E1" strokeWidth="0.8" fill="none" />
      </g>

      {/* Sparkles of completion */}
      <g transform="translate(105, 30)">
        <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill="#22C55E" opacity="0.3" />
      </g>
      <g transform="translate(55, 25)">
        <path d="M0 -3 L0.8 -0.8 L3 0 L0.8 0.8 L0 3 L-0.8 0.8 L-3 0 L-0.8 -0.8 Z" fill="#22C55E" opacity="0.25" />
      </g>
    </svg>
  )
}
