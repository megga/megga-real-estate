interface Props { className?: string }

export default function GettingStartedIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 320 200" fill="none" className={className}>
      {/* Background gradient shape */}
      <ellipse cx="160" cy="110" rx="140" ry="80" fill="#DBEAFE" opacity="0.08" />

      {/* Door frame */}
      <rect x="115" y="30" width="90" height="140" rx="4" fill="#1E293B" opacity="0.05" />
      <rect x="120" y="35" width="80" height="130" rx="3" fill="white" />
      <rect x="120" y="35" width="80" height="130" rx="3" stroke="#E2E8F0" strokeWidth="1.2" fill="none" />
      {/* Door handle */}
      <circle cx="190" cy="100" r="3" fill="#CBD5E1" />

      {/* Door opening - light rays */}
      <path d="M120 35 L60 10 L60 180 L120 165" fill="#FEF3C7" opacity="0.15" />
      <path d="M120 50 L75 30" stroke="#FCD34D" strokeWidth="0.5" opacity="0.2" />
      <path d="M120 70 L65 55" stroke="#FCD34D" strokeWidth="0.5" opacity="0.2" />
      <path d="M120 90 L60 80" stroke="#FCD34D" strokeWidth="0.5" opacity="0.15" />
      <path d="M120 110 L65 105" stroke="#FCD34D" strokeWidth="0.5" opacity="0.15" />

      {/* Dashboard visible through door */}
      <g transform="translate(130, 45)">
        {/* Mini dashboard */}
        <rect width="60" height="40" rx="3" fill="#F8FAFC" />
        <rect width="60" height="8" rx="3" fill="#F1F5F9" />
        <rect x="0" y="6" width="60" height="2" fill="#F1F5F9" />
        {/* Sidebar */}
        <rect x="0" y="10" width="12" height="30" fill="#F1F5F9" />
        <rect x="2" y="14" width="8" height="2" rx="1" fill="#CBD5E1" />
        <rect x="2" y="19" width="6" height="2" rx="1" fill="#3B82F6" opacity="0.5" />
        <rect x="2" y="24" width="7" height="2" rx="1" fill="#CBD5E1" />
        {/* Content area */}
        <rect x="15" y="13" width="18" height="12" rx="2" fill="#DBEAFE" opacity="0.5" />
        <rect x="36" y="13" width="18" height="12" rx="2" fill="#D1FAE5" opacity="0.5" />
        <rect x="15" y="28" width="40" height="8" rx="2" fill="#F1F5F9" />
        {/* Chart */}
        <rect x="18" y="30" width="4" height="4" rx="0.5" fill="#3B82F6" opacity="0.3" />
        <rect x="24" y="28" width="4" height="6" rx="0.5" fill="#3B82F6" opacity="0.5" />
        <rect x="30" y="31" width="4" height="3" rx="0.5" fill="#3B82F6" opacity="0.4" />
        <rect x="36" y="29" width="4" height="5" rx="0.5" fill="#3B82F6" opacity="0.6" />
      </g>

      {/* Person walking through door */}
      {/* Body */}
      <path d="M90 165 C90 145 115 145 115 165" fill="#3B82F6" opacity="0.08" />
      {/* Walking legs hint */}
      <path d="M95 160 L92 175" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.1" />
      <path d="M110 160 L115 175" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.1" />
      {/* Head */}
      <circle cx="102" cy="128" r="14" fill="#FEE2E2" />
      {/* Hair */}
      <path d="M88 124 C88 114 116 114 116 124 C114 120 90 120 88 124Z" fill="#1E293B" opacity="0.6" />
      {/* Eyes */}
      <circle cx="97" cy="126" r="1.5" fill="#1E293B" />
      <circle cx="107" cy="126" r="1.5" fill="#1E293B" />
      {/* Smile */}
      <path d="M98 132 Q102 135 106 132" stroke="#1E293B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Arm reaching forward */}
      <path d="M115 148 L125 138" stroke="#FEE2E2" strokeWidth="3" strokeLinecap="round" />

      {/* Rocket/star top right */}
      <g transform="translate(230, 40)">
        <path d="M0 -12 C-5 -6 -5 6 0 14 C5 6 5 -6 0 -12Z" fill="#FEF3C7" opacity="0.5" />
        <path d="M-4 10 L0 18 L4 10" fill="#F59E0B" opacity="0.3" />
        <circle cx="0" cy="0" r="3" fill="#F59E0B" opacity="0.3" />
      </g>

      {/* Sparkles */}
      <g transform="translate(250, 70)">
        <path d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z" fill="#F59E0B" opacity="0.3" />
      </g>
      <g transform="translate(55, 40)">
        <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill="#3B82F6" opacity="0.25" />
      </g>
      <g transform="translate(270, 120)">
        <path d="M0 -3 L0.8 -0.8 L3 0 L0.8 0.8 L0 3 L-0.8 0.8 L-3 0 L-0.8 -0.8 Z" fill="#3B82F6" opacity="0.2" />
      </g>

      {/* Welcome text area background */}
      <rect x="210" y="90" width="80" height="30" rx="6" fill="#3B82F6" opacity="0.05" />
      <rect x="220" y="98" width="50" height="3" rx="1.5" fill="#3B82F6" opacity="0.15" />
      <rect x="220" y="105" width="35" height="3" rx="1.5" fill="#3B82F6" opacity="0.1" />
      <rect x="220" y="112" width="42" height="3" rx="1.5" fill="#3B82F6" opacity="0.08" />
    </svg>
  )
}
