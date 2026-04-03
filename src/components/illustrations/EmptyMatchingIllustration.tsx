interface Props { className?: string }

export default function EmptyMatchingIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 160 120" fill="none" className={className}>
      {/* Left puzzle piece */}
      <g transform="translate(25, 35)">
        <path d="M0 10 L0 0 L40 0 L40 15 C40 15 45 15 45 20 C45 25 40 25 40 25 L40 40 L0 40 L0 30 C0 30 5 30 5 25 C5 20 0 20 0 20 Z" fill="#DBEAFE" />
        <path d="M0 10 L0 0 L40 0 L40 15 C40 15 45 15 45 20 C45 25 40 25 40 25 L40 40 L0 40 L0 30 C0 30 5 30 5 25 C5 20 0 20 0 20 Z" stroke="#93C5FD" strokeWidth="1" fill="none" />
        {/* Person icon inside */}
        <circle cx="18" cy="14" r="5" fill="#3B82F6" opacity="0.15" />
        <path d="M12 26 C12 22 24 22 24 26" fill="#3B82F6" opacity="0.15" />
      </g>

      {/* Right puzzle piece */}
      <g transform="translate(85, 35)">
        <path d="M0 0 L40 0 L40 20 C40 20 45 20 45 25 C45 30 40 30 40 30 L40 40 L0 40 L0 25 C0 25 -5 25 -5 20 C-5 15 0 15 0 15 Z" fill="#F3E8FF" />
        <path d="M0 0 L40 0 L40 20 C40 20 45 20 45 25 C45 30 40 30 40 30 L40 40 L0 40 L0 25 C0 25 -5 25 -5 20 C-5 15 0 15 0 15 Z" stroke="#C4B5FD" strokeWidth="1" fill="none" />
        {/* House icon inside */}
        <path d="M15 14 L22 8 L29 14 L29 24 L15 24 Z" fill="#7C3AED" opacity="0.12" />
        <rect x="19" y="18" width="6" height="6" rx="1" fill="#7C3AED" opacity="0.15" />
      </g>

      {/* Gap between pieces - dotted line */}
      <path d="M70 55 L85 55" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />

      {/* Question marks */}
      <text x="77" y="45" textAnchor="middle" fontSize="12" fill="#CBD5E1" fontWeight="500" opacity="0.4">?</text>

      {/* Arrows suggesting connection */}
      <path d="M72 90 L80 85 M80 85 L88 90" stroke="#CBD5E1" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M80 85 L80 80" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
    </svg>
  )
}
