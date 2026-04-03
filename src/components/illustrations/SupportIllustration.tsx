interface Props { className?: string }

export default function SupportIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="120" cy="95" rx="100" ry="70" fill="#DBEAFE" opacity="0.1" />

      {/* Person 1 - Support agent (left) */}
      {/* Body */}
      <path d="M55 155 C55 137 83 137 83 155" fill="#3B82F6" opacity="0.1" />
      {/* Head */}
      <circle cx="69" cy="115" r="14" fill="#FEE2E2" />
      {/* Hair */}
      <path d="M55 110 C55 100 83 100 83 110 C81 106 57 106 55 110Z" fill="#1E293B" opacity="0.6" />
      {/* Eyes */}
      <circle cx="64" cy="113" r="1.5" fill="#1E293B" />
      <circle cx="74" cy="113" r="1.5" fill="#1E293B" />
      {/* Smile */}
      <path d="M65 119 Q69 122 73 119" stroke="#1E293B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Headset */}
      <path d="M55 108 C55 96 83 96 83 108" stroke="#64748B" strokeWidth="2" fill="none" />
      <rect x="52" y="106" width="6" height="10" rx="3" fill="#64748B" opacity="0.4" />
      <rect x="80" y="106" width="6" height="10" rx="3" fill="#64748B" opacity="0.4" />
      {/* Mic */}
      <path d="M55 116 L48 120" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <circle cx="46" cy="121" r="3" fill="#64748B" opacity="0.2" />

      {/* Person 2 - Client (right) */}
      {/* Body */}
      <path d="M157 155 C157 137 185 137 185 155" fill="#F97316" opacity="0.08" />
      {/* Head */}
      <circle cx="171" cy="115" r="14" fill="#FEE2E2" />
      {/* Hair - longer */}
      <path d="M157 112 C157 100 185 100 185 112 L185 120 C185 120 183 114 171 114 C159 114 157 120 157 120 Z" fill="#92400E" opacity="0.4" />
      {/* Eyes */}
      <circle cx="166" cy="113" r="1.5" fill="#1E293B" />
      <circle cx="176" cy="113" r="1.5" fill="#1E293B" />
      {/* Smile */}
      <path d="M167 119 Q171 122 175 119" stroke="#1E293B" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* Chat bubbles */}
      {/* Bubble from support */}
      <g transform="translate(95, 55)">
        <rect x="-22" y="-12" width="44" height="24" rx="12" fill="#3B82F6" opacity="0.12" />
        <rect x="-22" y="-12" width="44" height="24" rx="12" stroke="#93C5FD" strokeWidth="0.8" fill="none" />
        <rect x="-14" y="-4" width="28" height="3" rx="1.5" fill="#3B82F6" opacity="0.25" />
        <rect x="-14" y="2" width="20" height="3" rx="1.5" fill="#3B82F6" opacity="0.15" />
        {/* Tail */}
        <path d="M-15 12 L-20 20 L-8 12" fill="#3B82F6" opacity="0.12" />
      </g>

      {/* Bubble from client */}
      <g transform="translate(145, 75)">
        <rect x="-18" y="-10" width="36" height="20" rx="10" fill="#F97316" opacity="0.08" />
        <rect x="-18" y="-10" width="36" height="20" rx="10" stroke="#FDBA74" strokeWidth="0.8" fill="none" />
        <rect x="-10" y="-3" width="20" height="3" rx="1.5" fill="#F97316" opacity="0.15" />
        {/* Tail */}
        <path d="M12 10 L18 18 L6 10" fill="#F97316" opacity="0.08" />
      </g>

      {/* Heart above */}
      <g transform="translate(120, 35)">
        <path d="M0 -5 C0 -9 -6 -9 -6 -5 C-6 0 0 5 0 5 C0 5 6 0 6 -5 C6 -9 0 -9 0 -5Z" fill="#F9A8D4" opacity="0.35" />
      </g>

      {/* Connection lines */}
      <path d="M83 130 Q120 120 157 130" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" fill="none" opacity="0.4" />

      {/* Small sparkles */}
      <g transform="translate(40, 80)">
        <path d="M0 -3 L0.8 -0.8 L3 0 L0.8 0.8 L0 3 L-0.8 0.8 L-3 0 L-0.8 -0.8 Z" fill="#3B82F6" opacity="0.3" />
      </g>
      <g transform="translate(200, 90)">
        <path d="M0 -3 L0.8 -0.8 L3 0 L0.8 0.8 L0 3 L-0.8 0.8 L-3 0 L-0.8 -0.8 Z" fill="#F97316" opacity="0.3" />
      </g>
    </svg>
  )
}
