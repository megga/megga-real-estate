interface Props { className?: string }

export default function SellerIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="130" cy="100" rx="95" ry="65" fill="#D1FAE5" opacity="0.12" />

      {/* Mountains in background */}
      <path d="M0 140 L40 80 L70 110 L100 60 L140 100 L170 75 L210 110 L240 90 L240 180 L0 180 Z" fill="#ECFDF5" opacity="0.5" />

      {/* Swiss house */}
      {/* Roof */}
      <path d="M130 42 L88 78 L172 78 Z" fill="#86EFAC" />
      <path d="M130 42 L130 78" stroke="#4ADE80" strokeWidth="0.5" opacity="0.3" />
      {/* Walls */}
      <rect x="95" y="78" width="70" height="52" fill="#F0FDF4" />
      <rect x="95" y="78" width="70" height="52" stroke="#86EFAC" strokeWidth="1.2" fill="none" />
      {/* Chimney */}
      <rect x="145" y="50" width="10" height="20" fill="#D1FAE5" />
      <rect x="143" y="48" width="14" height="4" rx="1" fill="#A7F3D0" />
      {/* Windows with shutters */}
      <rect x="103" y="86" width="16" height="14" rx="2" fill="#BBF7D0" />
      <rect x="103" y="86" width="4" height="14" rx="1" fill="#4ADE80" opacity="0.3" />
      <rect x="115" y="86" width="4" height="14" rx="1" fill="#4ADE80" opacity="0.3" />
      <rect x="141" y="86" width="16" height="14" rx="2" fill="#BBF7D0" />
      <rect x="141" y="86" width="4" height="14" rx="1" fill="#4ADE80" opacity="0.3" />
      <rect x="153" y="86" width="4" height="14" rx="1" fill="#4ADE80" opacity="0.3" />
      {/* Window cross lines */}
      <line x1="111" y1="86" x2="111" y2="100" stroke="#6EE7B7" strokeWidth="0.8" />
      <line x1="103" y1="93" x2="119" y2="93" stroke="#6EE7B7" strokeWidth="0.8" />
      <line x1="149" y1="86" x2="149" y2="100" stroke="#6EE7B7" strokeWidth="0.8" />
      <line x1="141" y1="93" x2="157" y2="93" stroke="#6EE7B7" strokeWidth="0.8" />
      {/* Door */}
      <rect x="122" y="104" width="16" height="26" rx="8 8 0 0" fill="#059669" opacity="0.25" />
      <circle cx="135" cy="118" r="1.5" fill="#059669" opacity="0.5" />
      {/* Steps */}
      <rect x="118" y="128" width="24" height="4" rx="1" fill="#D1FAE5" />

      {/* Ground */}
      <rect x="0" y="130" width="240" height="50" fill="#ECFDF5" opacity="0.3" />

      {/* Person - seller/owner */}
      {/* Body */}
      <path d="M38 130 C38 112 62 112 62 130" fill="#F97316" opacity="0.15" />
      <path d="M40 130 C40 114 60 114 60 130" fill="#FB923C" opacity="0.2" />
      {/* Head */}
      <circle cx="50" cy="96" r="12" fill="#FEE2E2" />
      {/* Hair */}
      <path d="M38 92 C38 82 62 82 62 92 L60 90 C60 86 40 86 40 90 Z" fill="#92400E" opacity="0.6" />
      {/* Eyes */}
      <circle cx="46" cy="94" r="1.5" fill="#1E293B" />
      <circle cx="54" cy="94" r="1.5" fill="#1E293B" />
      {/* Smile */}
      <path d="M46 100 Q50 103 54 100" stroke="#1E293B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Arm holding key */}
      <path d="M60 115 L72 108" stroke="#FEE2E2" strokeWidth="3" strokeLinecap="round" />

      {/* Key */}
      <g transform="translate(72, 105) rotate(-20)">
        <circle cx="0" cy="0" r="5" stroke="#F59E0B" strokeWidth="1.5" fill="#FEF3C7" />
        <rect x="4" y="-1.5" width="14" height="3" rx="1" fill="#F59E0B" />
        <rect x="14" y="-1.5" width="3" height="6" rx="1" fill="#F59E0B" />
        <rect x="10" y="-1.5" width="2" height="5" rx="0.5" fill="#F59E0B" />
      </g>

      {/* Tree */}
      <rect x="190" y="108" width="5" height="22" rx="2" fill="#A16207" opacity="0.3" />
      <circle cx="192" cy="100" r="14" fill="#86EFAC" opacity="0.4" />
      <circle cx="188" cy="95" r="10" fill="#4ADE80" opacity="0.3" />
      <circle cx="196" cy="92" r="8" fill="#86EFAC" opacity="0.3" />

      {/* Small flowers/grass */}
      <circle cx="80" cy="132" r="2" fill="#F9A8D4" opacity="0.4" />
      <circle cx="180" cy="134" r="2" fill="#F9A8D4" opacity="0.4" />
      <path d="M75 130 L75 136" stroke="#86EFAC" strokeWidth="1" />
      <path d="M85 131 L85 136" stroke="#86EFAC" strokeWidth="1" />
      <path d="M175 131 L175 136" stroke="#86EFAC" strokeWidth="1" />
    </svg>
  )
}
