interface Props { className?: string }

export default function AgentIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="120" cy="100" rx="100" ry="70" fill="#DBEAFE" opacity="0.15" />

      {/* Desk surface */}
      <rect x="40" y="130" width="160" height="8" rx="4" fill="#E5E7EB" />

      {/* Monitor */}
      <rect x="85" y="55" width="90" height="60" rx="6" fill="#1E293B" />
      <rect x="90" y="60" width="80" height="46" rx="3" fill="#0F172A" />
      {/* Screen glow */}
      <rect x="90" y="60" width="80" height="46" rx="3" fill="#3B82F6" opacity="0.08" />
      {/* Monitor stand */}
      <path d="M120 115 L140 115 L138 130 L122 130 Z" fill="#CBD5E1" />
      <rect x="115" y="130" width="30" height="4" rx="2" fill="#94A3B8" />

      {/* Dashboard on screen */}
      {/* Top bar */}
      <rect x="96" y="65" width="68" height="3" rx="1.5" fill="#334155" />
      {/* Sidebar */}
      <rect x="96" y="72" width="16" height="28" rx="2" fill="#1E293B" />
      <rect x="99" y="76" width="10" height="2" rx="1" fill="#475569" />
      <rect x="99" y="81" width="8" height="2" rx="1" fill="#475569" />
      <rect x="99" y="86" width="10" height="2" rx="1" fill="#3B82F6" opacity="0.6" />
      <rect x="99" y="91" width="7" height="2" rx="1" fill="#475569" />
      {/* Chart area */}
      <rect x="116" y="72" width="48" height="28" rx="2" fill="#0F172A" />
      {/* Bar chart */}
      <rect x="122" y="88" width="5" height="8" rx="1" fill="#3B82F6" opacity="0.4" />
      <rect x="130" y="82" width="5" height="14" rx="1" fill="#3B82F6" opacity="0.6" />
      <rect x="138" y="78" width="5" height="18" rx="1" fill="#3B82F6" opacity="0.8" />
      <rect x="146" y="84" width="5" height="12" rx="1" fill="#3B82F6" opacity="0.5" />
      <rect x="154" y="76" width="5" height="20" rx="1" fill="#3B82F6" />

      {/* Person - professional agent */}
      {/* Body - suit */}
      <path d="M50 130 C50 108 80 108 80 130" fill="#1E293B" />
      {/* Suit lapels */}
      <path d="M58 112 L65 122 L65 130 L58 130 Z" fill="#334155" />
      <path d="M72 112 L65 122 L65 130 L72 130 Z" fill="#334155" />
      {/* Shirt/tie */}
      <rect x="63" y="112" width="4" height="18" fill="#3B82F6" opacity="0.4" />
      {/* Head */}
      <circle cx="65" cy="95" r="14" fill="#FECACA" opacity="0.3" />
      <circle cx="65" cy="93" r="12" fill="#FEE2E2" />
      {/* Hair */}
      <path d="M53 88 C53 78 77 78 77 88 C77 84 53 84 53 88Z" fill="#1E293B" />
      {/* Eyes */}
      <circle cx="60" cy="91" r="1.5" fill="#1E293B" />
      <circle cx="70" cy="91" r="1.5" fill="#1E293B" />
      {/* Smile */}
      <path d="M61 97 Q65 100 69 97" stroke="#1E293B" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* Floating document */}
      <g transform="translate(178, 45) rotate(5)">
        <rect width="32" height="42" rx="3" fill="white" />
        <rect width="32" height="42" rx="3" stroke="#E2E8F0" strokeWidth="1" fill="none" />
        <rect x="6" y="8" width="20" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="6" y="14" width="16" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="6" y="20" width="18" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="6" y="30" width="8" height="5" rx="1.5" fill="#3B82F6" opacity="0.2" />
        <path d="M8 33 L10 35 L14 31" stroke="#3B82F6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>

      {/* Coffee cup */}
      <rect x="160" y="120" width="12" height="14" rx="2" fill="#F1F5F9" />
      <rect x="160" y="120" width="12" height="14" rx="2" stroke="#CBD5E1" strokeWidth="0.8" fill="none" />
      <path d="M172 125 C178 125 178 131 172 131" stroke="#CBD5E1" strokeWidth="0.8" fill="none" />
      {/* Steam */}
      <path d="M164 117 Q165 114 164 111" stroke="#CBD5E1" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M168 118 Q169 115 168 112" stroke="#CBD5E1" strokeWidth="0.8" fill="none" strokeLinecap="round" />

      {/* Small sparkle - AI element */}
      <g transform="translate(185, 95)">
        <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill="#3B82F6" opacity="0.4" />
      </g>
    </svg>
  )
}
