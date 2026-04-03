interface Props { className?: string }

export default function ChangelogIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="120" cy="95" rx="95" ry="65" fill="#FEF3C7" opacity="0.15" />

      {/* Rocket */}
      <g transform="translate(120, 85) rotate(-25)">
        {/* Body */}
        <path d="M0 -40 C-10 -25 -10 15 0 30 C10 15 10 -25 0 -40Z" fill="#F1F5F9" />
        <path d="M0 -40 C-10 -25 -10 15 0 30 C10 15 10 -25 0 -40Z" stroke="#CBD5E1" strokeWidth="1" fill="none" />
        {/* Window */}
        <circle cx="0" cy="-10" r="6" fill="#DBEAFE" />
        <circle cx="0" cy="-10" r="6" stroke="#93C5FD" strokeWidth="1" fill="none" />
        <circle cx="0" cy="-10" r="3" fill="#3B82F6" opacity="0.2" />
        {/* Fins */}
        <path d="M-10 15 L-18 28 L-8 22Z" fill="#F97316" opacity="0.3" />
        <path d="M10 15 L18 28 L8 22Z" fill="#F97316" opacity="0.3" />
        {/* Nose cone accent */}
        <path d="M0 -40 C-4 -32 -6 -22 -6 -15 L0 -15 L6 -15 C6 -22 4 -32 0 -40Z" fill="#F97316" opacity="0.15" />
        {/* Flames */}
        <path d="M-5 28 L0 45 L5 28" fill="#F97316" opacity="0.4" />
        <path d="M-3 30 L0 40 L3 30" fill="#FBBF24" opacity="0.5" />
      </g>

      {/* Stars / sparkles */}
      <g transform="translate(55, 40)">
        <path d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z" fill="#F59E0B" opacity="0.5" />
      </g>
      <g transform="translate(185, 55)">
        <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill="#F59E0B" opacity="0.4" />
      </g>
      <g transform="translate(170, 130)">
        <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill="#3B82F6" opacity="0.3" />
      </g>
      <g transform="translate(45, 120)">
        <path d="M0 -3 L0.8 -0.8 L3 0 L0.8 0.8 L0 3 L-0.8 0.8 L-3 0 L-0.8 -0.8 Z" fill="#F59E0B" opacity="0.3" />
      </g>

      {/* Version badges */}
      <g transform="translate(40, 75)">
        <rect x="-18" y="-8" width="36" height="16" rx="8" fill="#F97316" opacity="0.1" />
        <text x="0" y="3" textAnchor="middle" fontSize="8" fill="#F97316" fontWeight="600" opacity="0.6">v2.1</text>
      </g>
      <g transform="translate(195, 100)">
        <rect x="-18" y="-8" width="36" height="16" rx="8" fill="#3B82F6" opacity="0.1" />
        <text x="0" y="3" textAnchor="middle" fontSize="8" fill="#3B82F6" fontWeight="600" opacity="0.6">NEW</text>
      </g>

      {/* Upward arrows */}
      <path d="M65 150 L65 135 L58 142 M65 135 L72 142" stroke="#F97316" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M175 155 L175 140 L168 147 M175 140 L182 147" stroke="#3B82F6" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3" />

      {/* Trail dots */}
      <circle cx="140" cy="140" r="2" fill="#CBD5E1" opacity="0.4" />
      <circle cx="148" cy="148" r="2.5" fill="#CBD5E1" opacity="0.3" />
      <circle cx="155" cy="155" r="3" fill="#CBD5E1" opacity="0.2" />
    </svg>
  )
}
