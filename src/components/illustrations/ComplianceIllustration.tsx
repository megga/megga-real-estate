interface Props { className?: string }

export default function ComplianceIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="120" cy="95" rx="95" ry="70" fill="#DBEAFE" opacity="0.1" />

      {/* Shield */}
      <path d="M120 25 L160 45 L160 95 C160 125 120 150 120 150 C120 150 80 125 80 95 L80 45 Z" fill="#EFF6FF" />
      <path d="M120 25 L160 45 L160 95 C160 125 120 150 120 150 C120 150 80 125 80 95 L80 45 Z" stroke="#93C5FD" strokeWidth="1.5" fill="none" />
      {/* Shield gradient overlay */}
      <path d="M120 30 L155 48 L155 93 C155 120 120 143 120 143 C120 143 85 120 85 93 L85 48 Z" fill="#DBEAFE" opacity="0.2" />

      {/* Checkmark in shield */}
      <path d="M102 88 L114 102 L140 72" stroke="#22C55E" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Lock */}
      <g transform="translate(45, 55)">
        <rect x="-10" y="0" width="20" height="16" rx="3" fill="#1E40AF" opacity="0.15" />
        <path d="M-5 0 L-5 -6 C-5 -12 5 -12 5 -6 L5 0" stroke="#1E40AF" strokeWidth="2" fill="none" opacity="0.3" />
        <circle cx="0" cy="8" r="2.5" fill="#1E40AF" opacity="0.3" />
      </g>

      {/* Document with stamp */}
      <g transform="translate(175, 50)">
        <rect x="-16" y="-5" width="32" height="42" rx="3" fill="white" />
        <rect x="-16" y="-5" width="32" height="42" rx="3" stroke="#CBD5E1" strokeWidth="1" fill="none" />
        <rect x="-10" y="2" width="20" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="-10" y="8" width="16" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="-10" y="14" width="18" height="2.5" rx="1" fill="#CBD5E1" />
        {/* Stamp */}
        <circle cx="4" cy="27" r="8" stroke="#1E40AF" strokeWidth="1.5" fill="#1E40AF" opacity="0.08" />
        <path d="M0 27 L3 30 L8 24" stroke="#1E40AF" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Floating key icon */}
      <g transform="translate(55, 130)">
        <circle cx="0" cy="0" r="4" stroke="#64748B" strokeWidth="1.2" fill="#F1F5F9" />
        <rect x="3" y="-1" width="10" height="2" rx="0.5" fill="#64748B" opacity="0.5" />
        <rect x="10" y="-1" width="2" height="4" rx="0.5" fill="#64748B" opacity="0.5" />
      </g>

      {/* Data points / encrypted data */}
      <g opacity="0.3">
        <circle cx="40" cy="40" r="2" fill="#3B82F6" />
        <circle cx="200" cy="130" r="2" fill="#3B82F6" />
        <circle cx="180" cy="140" r="1.5" fill="#3B82F6" />
        <circle cx="60" cy="145" r="1.5" fill="#3B82F6" />
      </g>
    </svg>
  )
}
