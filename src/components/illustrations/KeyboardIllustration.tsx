interface Props { className?: string }

export default function KeyboardIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="120" cy="100" rx="100" ry="65" fill="#F1F5F9" opacity="0.3" />

      {/* Keyboard body */}
      <rect x="30" y="65" width="180" height="70" rx="8" fill="#F8FAFC" />
      <rect x="30" y="65" width="180" height="70" rx="8" stroke="#E2E8F0" strokeWidth="1.2" fill="none" />

      {/* Key rows */}
      {/* Row 1 */}
      <rect x="42" y="75" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="64" y="75" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="86" y="75" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="108" y="75" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="130" y="75" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="152" y="75" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="174" y="75" width="26" height="14" rx="3" fill="#E2E8F0" />

      {/* Row 2 - with highlighted keys */}
      <rect x="42" y="93" width="26" height="14" rx="3" fill="#E2E8F0" />
      {/* Highlighted CMD key */}
      <rect x="72" y="93" width="18" height="14" rx="3" fill="#3B82F6" opacity="0.15" />
      <rect x="72" y="93" width="18" height="14" rx="3" stroke="#3B82F6" strokeWidth="1" fill="none" opacity="0.5" />
      <text x="81" y="103" textAnchor="middle" fontSize="7" fill="#3B82F6" fontWeight="600" opacity="0.8">&#8984;</text>
      {/* Highlighted K key */}
      <rect x="94" y="93" width="18" height="14" rx="3" fill="#3B82F6" opacity="0.15" />
      <rect x="94" y="93" width="18" height="14" rx="3" stroke="#3B82F6" strokeWidth="1" fill="none" opacity="0.5" />
      <text x="103" y="103" textAnchor="middle" fontSize="8" fill="#3B82F6" fontWeight="600" opacity="0.8">K</text>
      <rect x="116" y="93" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="138" y="93" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="160" y="93" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="182" y="93" width="18" height="14" rx="3" fill="#E2E8F0" />

      {/* Row 3 - spacebar */}
      <rect x="42" y="111" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="64" y="111" width="18" height="14" rx="3" fill="#E2E8F0" />
      {/* Spacebar */}
      <rect x="86" y="111" width="68" height="14" rx="3" fill="#E2E8F0" />
      <rect x="158" y="111" width="18" height="14" rx="3" fill="#E2E8F0" />
      <rect x="180" y="111" width="20" height="14" rx="3" fill="#E2E8F0" />

      {/* Finger pressing key */}
      <g transform="translate(103, 80)">
        <path d="M-3 -8 C-5 -15 5 -15 3 -8" fill="#FEE2E2" opacity="0.6" />
        <ellipse cx="0" cy="-5" rx="5" ry="3" fill="#FEE2E2" opacity="0.4" />
      </g>

      {/* Speed lines */}
      <path d="M55 48 L75 48" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M45 53 L70 53" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round" opacity="0.2" />
      <path d="M60 58 L80 58" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round" opacity="0.15" />

      {/* Lightning bolt */}
      <g transform="translate(180, 45)">
        <path d="M0 -10 L-4 2 L2 0 L-2 10 L6 -2 L0 0 Z" fill="#F59E0B" opacity="0.4" />
      </g>

      {/* Sparkle */}
      <g transform="translate(160, 42)">
        <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill="#3B82F6" opacity="0.3" />
      </g>

      {/* "+" between keys hint */}
      <text x="88" y="103" textAnchor="middle" fontSize="7" fill="#94A3B8" fontWeight="500">+</text>

      {/* Shadow under keyboard */}
      <ellipse cx="120" cy="140" rx="80" ry="4" fill="#E2E8F0" opacity="0.3" />
    </svg>
  )
}
