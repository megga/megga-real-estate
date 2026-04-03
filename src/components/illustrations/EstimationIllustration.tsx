interface Props { className?: string }

export default function EstimationIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 200 150" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="100" cy="80" rx="85" ry="60" fill="#D1FAE5" opacity="0.1" />

      {/* House */}
      <path d="M70 50 L100 25 L130 50" fill="#ECFDF5" />
      <path d="M70 50 L100 25 L130 50" stroke="#86EFAC" strokeWidth="1" fill="none" />
      <rect x="75" y="50" width="50" height="35" fill="#F0FDF4" />
      <rect x="75" y="50" width="50" height="35" stroke="#86EFAC" strokeWidth="1" fill="none" />
      {/* Door */}
      <rect x="93" y="63" width="14" height="22" rx="7 7 0 0" fill="#059669" opacity="0.15" />
      {/* Windows */}
      <rect x="80" y="56" width="10" height="8" rx="1.5" fill="#BBF7D0" />
      <rect x="110" y="56" width="10" height="8" rx="1.5" fill="#BBF7D0" />

      {/* Thermometer / gauge */}
      <g transform="translate(155, 30)">
        {/* Tube */}
        <rect x="-4" y="0" width="8" height="70" rx="4" fill="#F1F5F9" />
        <rect x="-4" y="0" width="8" height="70" rx="4" stroke="#E2E8F0" strokeWidth="1" fill="none" />
        {/* Mercury */}
        <rect x="-2.5" y="20" width="5" height="48" rx="2.5" fill="#22C55E" opacity="0.4" />
        {/* Bulb */}
        <circle cx="0" cy="72" r="8" fill="#22C55E" opacity="0.3" />
        <circle cx="0" cy="72" r="8" stroke="#86EFAC" strokeWidth="1" fill="none" />
        {/* Tick marks */}
        <line x1="6" y1="15" x2="10" y2="15" stroke="#CBD5E1" strokeWidth="0.8" />
        <line x1="6" y1="30" x2="10" y2="30" stroke="#CBD5E1" strokeWidth="0.8" />
        <line x1="6" y1="45" x2="10" y2="45" stroke="#CBD5E1" strokeWidth="0.8" />
        <line x1="6" y1="60" x2="10" y2="60" stroke="#CBD5E1" strokeWidth="0.8" />
        {/* Arrow indicator */}
        <path d="M14 25 L20 25 L20 21 L26 27 L20 33 L20 29 L14 29 Z" fill="#22C55E" opacity="0.3" />
      </g>

      {/* CHF coins */}
      <g transform="translate(30, 70)">
        <ellipse cx="0" cy="3" rx="12" ry="4" fill="#FCD34D" opacity="0.15" />
        <ellipse cx="0" cy="0" rx="12" ry="4" fill="#FEF3C7" />
        <ellipse cx="0" cy="0" rx="12" ry="4" stroke="#FCD34D" strokeWidth="0.8" fill="none" />
        <text x="0" y="3" textAnchor="middle" fontSize="5" fill="#92400E" fontWeight="600" opacity="0.5">CHF</text>
      </g>
      <g transform="translate(35, 60)">
        <ellipse cx="0" cy="3" rx="12" ry="4" fill="#FCD34D" opacity="0.15" />
        <ellipse cx="0" cy="0" rx="12" ry="4" fill="#FEF3C7" />
        <ellipse cx="0" cy="0" rx="12" ry="4" stroke="#FCD34D" strokeWidth="0.8" fill="none" />
      </g>

      {/* Price range bar */}
      <g transform="translate(30, 110)">
        <rect width="140" height="6" rx="3" fill="#E2E8F0" />
        <rect x="35" width="70" height="6" rx="3" fill="#22C55E" opacity="0.3" />
        {/* Min/max markers */}
        <circle cx="35" cy="3" r="5" fill="white" stroke="#22C55E" strokeWidth="1.5" />
        <circle cx="105" cy="3" r="5" fill="white" stroke="#22C55E" strokeWidth="1.5" />
        {/* Labels */}
        <text x="35" y="22" textAnchor="middle" fontSize="6" fill="#64748B" opacity="0.5">Min</text>
        <text x="105" y="22" textAnchor="middle" fontSize="6" fill="#64748B" opacity="0.5">Max</text>
      </g>

      {/* Upward trend arrow */}
      <path d="M50 95 L60 88 L70 92 L80 85" stroke="#22C55E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
      <path d="M76 82 L82 84 L80 90" stroke="#22C55E" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.3" />
    </svg>
  )
}
