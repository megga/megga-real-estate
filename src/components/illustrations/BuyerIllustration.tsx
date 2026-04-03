interface Props { className?: string }

export default function BuyerIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="120" cy="95" rx="100" ry="70" fill="#F3E8FF" opacity="0.12" />

      {/* Map background */}
      <rect x="55" y="30" width="140" height="100" rx="8" fill="#FAF5FF" />
      <rect x="55" y="30" width="140" height="100" rx="8" stroke="#E9D5FF" strokeWidth="1" fill="none" />
      {/* Map roads */}
      <path d="M70 65 Q100 55 130 70 T190 60" stroke="#E9D5FF" strokeWidth="2" fill="none" />
      <path d="M80 90 Q110 80 140 95 T180 85" stroke="#E9D5FF" strokeWidth="1.5" fill="none" />
      <path d="M100 45 L100 120" stroke="#E9D5FF" strokeWidth="1" />
      <path d="M150 40 L150 125" stroke="#E9D5FF" strokeWidth="1" />

      {/* Map pins */}
      <g transform="translate(85, 55)">
        <ellipse cx="0" cy="14" rx="5" ry="2" fill="#7C3AED" opacity="0.15" />
        <path d="M0 -8 C-6 -8 -8 -3 -8 1 C-8 6 0 14 0 14 C0 14 8 6 8 1 C8 -3 6 -8 0 -8Z" fill="#7C3AED" opacity="0.7" />
        <circle cx="0" cy="0" r="3" fill="white" opacity="0.9" />
      </g>
      <g transform="translate(130, 48)">
        <ellipse cx="0" cy="14" rx="5" ry="2" fill="#7C3AED" opacity="0.15" />
        <path d="M0 -8 C-6 -8 -8 -3 -8 1 C-8 6 0 14 0 14 C0 14 8 6 8 1 C8 -3 6 -8 0 -8Z" fill="#A78BFA" opacity="0.5" />
        <circle cx="0" cy="0" r="3" fill="white" opacity="0.9" />
      </g>
      <g transform="translate(160, 75)">
        <ellipse cx="0" cy="14" rx="5" ry="2" fill="#7C3AED" opacity="0.15" />
        <path d="M0 -8 C-6 -8 -8 -3 -8 1 C-8 6 0 14 0 14 C0 14 8 6 8 1 C8 -3 6 -8 0 -8Z" fill="#A78BFA" opacity="0.5" />
        <circle cx="0" cy="0" r="3" fill="white" opacity="0.9" />
      </g>

      {/* Small house icons on pins */}
      <path d="M82 52 L85 49 L88 52 L88 56 L82 56 Z" fill="white" />
      <path d="M127 45 L130 42 L133 45 L133 49 L127 49 Z" fill="white" opacity="0.8" />

      {/* Person exploring */}
      {/* Body */}
      <path d="M20 155 C20 135 48 135 48 155" fill="#7C3AED" opacity="0.12" />
      <path d="M22 155 C22 137 46 137 46 155" fill="#8B5CF6" opacity="0.15" />
      {/* Head */}
      <circle cx="34" cy="118" r="13" fill="#FEE2E2" />
      {/* Hair */}
      <path d="M21 114 C21 104 47 104 47 114 C45 110 23 110 21 114Z" fill="#1E293B" opacity="0.7" />
      {/* Eyes */}
      <circle cx="29" cy="116" r="1.5" fill="#1E293B" />
      <circle cx="39" cy="116" r="1.5" fill="#1E293B" />
      {/* Smile */}
      <path d="M30 122 Q34 125 38 122" stroke="#1E293B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Arm pointing at map */}
      <path d="M46 140 L60 100" stroke="#FEE2E2" strokeWidth="3" strokeLinecap="round" />

      {/* Phone in other hand */}
      <g transform="translate(12, 135) rotate(-10)">
        <rect width="14" height="24" rx="3" fill="#1E293B" />
        <rect x="1.5" y="3" width="11" height="18" rx="1.5" fill="#EDE9FE" />
        {/* App on screen */}
        <rect x="3" y="5" width="8" height="4" rx="1" fill="#7C3AED" opacity="0.3" />
        <rect x="3" y="11" width="8" height="2" rx="0.5" fill="#C4B5FD" />
        <rect x="3" y="15" width="6" height="2" rx="0.5" fill="#C4B5FD" />
      </g>

      {/* Binoculars floating */}
      <g transform="translate(200, 40)">
        <circle cx="-6" cy="0" r="8" stroke="#A78BFA" strokeWidth="2" fill="#F5F3FF" />
        <circle cx="6" cy="0" r="8" stroke="#A78BFA" strokeWidth="2" fill="#F5F3FF" />
        <rect x="-3" y="-3" width="6" height="6" rx="1" fill="#A78BFA" opacity="0.3" />
        <circle cx="-6" cy="0" r="4" fill="#7C3AED" opacity="0.15" />
        <circle cx="6" cy="0" r="4" fill="#7C3AED" opacity="0.15" />
      </g>

      {/* Search radius circle on map */}
      <circle cx="120" cy="70" r="30" stroke="#7C3AED" strokeWidth="1" strokeDasharray="4 3" fill="#7C3AED" opacity="0.04" />

      {/* Sparkles */}
      <g transform="translate(170, 35)">
        <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill="#A78BFA" opacity="0.5" />
      </g>
    </svg>
  )
}
