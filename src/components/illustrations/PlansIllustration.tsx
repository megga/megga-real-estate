interface Props { className?: string }

export default function PlansIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="120" cy="100" rx="100" ry="65" fill="#DBEAFE" opacity="0.1" />

      {/* Level 1 - Starter (small) */}
      <g transform="translate(45, 90)">
        <rect width="50" height="55" rx="4" fill="#F8FAFC" />
        <rect width="50" height="55" rx="4" stroke="#E2E8F0" strokeWidth="1" fill="none" />
        {/* Header */}
        <rect x="0" y="0" width="50" height="14" rx="4" fill="#F1F5F9" />
        <rect x="0" y="10" width="50" height="4" fill="#F1F5F9" />
        {/* Lines */}
        <rect x="8" y="22" width="20" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="8" y="28" width="30" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="8" y="34" width="15" height="2.5" rx="1" fill="#CBD5E1" />
        {/* Badge */}
        <rect x="10" y="42" width="30" height="8" rx="4" fill="#E2E8F0" />
        <text x="25" y="48" textAnchor="middle" fontSize="5.5" fill="#94A3B8" fontWeight="500">Starter</text>
      </g>

      {/* Level 2 - Pro (medium, highlighted) */}
      <g transform="translate(105, 55)">
        <rect width="55" height="90" rx="5" fill="white" />
        <rect width="55" height="90" rx="5" stroke="#3B82F6" strokeWidth="1.5" fill="none" opacity="0.4" />
        {/* Header - accent */}
        <rect x="0" y="0" width="55" height="16" rx="5" fill="#3B82F6" opacity="0.08" />
        <rect x="0" y="10" width="55" height="6" fill="#3B82F6" opacity="0.08" />
        {/* Star */}
        <g transform="translate(27.5, 8)">
          <path d="M0 -4 L1.2 -1 L4 -1 L2 1 L2.5 4 L0 2.5 L-2.5 4 L-2 1 L-4 -1 L-1.2 -1 Z" fill="#3B82F6" opacity="0.4" />
        </g>
        {/* Lines */}
        <rect x="8" y="24" width="25" height="2.5" rx="1" fill="#93C5FD" />
        <rect x="8" y="30" width="35" height="2.5" rx="1" fill="#93C5FD" />
        <rect x="8" y="36" width="20" height="2.5" rx="1" fill="#93C5FD" />
        <rect x="8" y="42" width="30" height="2.5" rx="1" fill="#93C5FD" />
        <rect x="8" y="48" width="18" height="2.5" rx="1" fill="#93C5FD" />
        {/* Checks */}
        <path d="M38 25 L40 27 L44 23" stroke="#3B82F6" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M38 31 L40 33 L44 29" stroke="#3B82F6" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M38 37 L40 39 L44 35" stroke="#3B82F6" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M38 43 L40 45 L44 41" stroke="#3B82F6" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M38 49 L40 51 L44 47" stroke="#3B82F6" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
        {/* CTA */}
        <rect x="8" y="60" width="39" height="14" rx="7" fill="#3B82F6" opacity="0.12" />
        <rect x="8" y="60" width="39" height="14" rx="7" stroke="#3B82F6" strokeWidth="0.8" fill="none" opacity="0.3" />
        <text x="27.5" y="70" textAnchor="middle" fontSize="6" fill="#3B82F6" fontWeight="600" opacity="0.6">Pro</text>
        {/* "Popular" badge */}
        <rect x="12" y="-10" width="31" height="12" rx="6" fill="#3B82F6" opacity="0.15" />
      </g>

      {/* Level 3 - Agency (large) */}
      <g transform="translate(170, 70)">
        <rect width="50" height="75" rx="4" fill="#F8FAFC" />
        <rect width="50" height="75" rx="4" stroke="#E2E8F0" strokeWidth="1" fill="none" />
        {/* Header */}
        <rect x="0" y="0" width="50" height="14" rx="4" fill="#F1F5F9" />
        <rect x="0" y="10" width="50" height="4" fill="#F1F5F9" />
        {/* Lines */}
        <rect x="8" y="22" width="22" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="8" y="28" width="30" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="8" y="34" width="18" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="8" y="40" width="25" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="8" y="46" width="15" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="8" y="52" width="28" height="2.5" rx="1" fill="#CBD5E1" />
        {/* Badge */}
        <rect x="8" y="60" width="34" height="8" rx="4" fill="#E2E8F0" />
        <text x="25" y="66" textAnchor="middle" fontSize="5.5" fill="#94A3B8" fontWeight="500">Agency</text>
      </g>

      {/* Ascending arrow */}
      <path d="M70 88 L132.5 50 L195 68" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" fill="none" opacity="0.4" />
      <path d="M188 65 L195 68 L192 75" stroke="#CBD5E1" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4" />

      {/* Sparkle on Pro */}
      <g transform="translate(165, 45)">
        <path d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z" fill="#3B82F6" opacity="0.3" />
      </g>
    </svg>
  )
}
