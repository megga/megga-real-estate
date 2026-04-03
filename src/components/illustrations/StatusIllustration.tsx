interface Props { className?: string }

export default function StatusIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className}>
      {/* Background blob */}
      <ellipse cx="120" cy="95" rx="95" ry="65" fill="#D1FAE5" opacity="0.12" />

      {/* Cloud */}
      <g transform="translate(120, 65)">
        <ellipse cx="0" cy="5" rx="40" ry="20" fill="#F0FDF4" />
        <circle cx="-20" cy="0" r="18" fill="#F0FDF4" />
        <circle cx="10" cy="-8" r="22" fill="#F0FDF4" />
        <circle cx="25" cy="0" r="16" fill="#F0FDF4" />
        {/* Cloud outline */}
        <ellipse cx="0" cy="5" rx="40" ry="20" stroke="#86EFAC" strokeWidth="1" fill="none" />
        <circle cx="-20" cy="0" r="18" stroke="#86EFAC" strokeWidth="1" fill="none" />
        <circle cx="10" cy="-8" r="22" stroke="#86EFAC" strokeWidth="1" fill="none" />
        <circle cx="25" cy="0" r="16" stroke="#86EFAC" strokeWidth="1" fill="none" />
        {/* Fill over outlines for clean look */}
        <ellipse cx="0" cy="0" rx="35" ry="18" fill="#F0FDF4" />
      </g>

      {/* Big check in cloud */}
      <path d="M105 62 L116 75 L140 48" stroke="#22C55E" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Server rack below */}
      <g transform="translate(90, 110)">
        <rect width="60" height="40" rx="4" fill="#F8FAFC" />
        <rect width="60" height="40" rx="4" stroke="#E2E8F0" strokeWidth="1" fill="none" />
        {/* Server rows */}
        <rect x="6" y="6" width="48" height="8" rx="2" fill="#F1F5F9" />
        <rect x="6" y="18" width="48" height="8" rx="2" fill="#F1F5F9" />
        <rect x="6" y="30" width="48" height="6" rx="2" fill="#F1F5F9" />
        {/* Status LEDs */}
        <circle cx="12" cy="10" r="2" fill="#22C55E" />
        <circle cx="12" cy="22" r="2" fill="#22C55E" />
        <circle cx="12" cy="33" r="2" fill="#22C55E" />
        {/* Drive slots */}
        <rect x="20" y="8" width="28" height="4" rx="1" fill="#E2E8F0" />
        <rect x="20" y="20" width="28" height="4" rx="1" fill="#E2E8F0" />
      </g>

      {/* Connection lines from cloud to server */}
      <path d="M110 85 L110 110" stroke="#86EFAC" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      <path d="M130 85 L130 110" stroke="#86EFAC" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      <path d="M140 85 L140 110" stroke="#86EFAC" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />

      {/* Signal waves */}
      <g transform="translate(185, 50)">
        <path d="M0 0 C4 -4 8 -4 8 0" stroke="#22C55E" strokeWidth="1.5" fill="none" opacity="0.3" />
        <path d="M-3 -5 C4 -12 14 -12 14 -5" stroke="#22C55E" strokeWidth="1.5" fill="none" opacity="0.2" />
        <path d="M-6 -10 C4 -20 18 -20 20 -10" stroke="#22C55E" strokeWidth="1.5" fill="none" opacity="0.1" />
        <circle cx="4" cy="2" r="3" fill="#22C55E" opacity="0.4" />
      </g>

      {/* Uptime bar */}
      <g transform="translate(40, 130)">
        <rect width="30" height="4" rx="2" fill="#E2E8F0" />
        <rect width="28" height="4" rx="2" fill="#22C55E" opacity="0.4" />
        <text x="15" y="15" textAnchor="middle" fontSize="6" fill="#64748B" opacity="0.5">99.9%</text>
      </g>
    </svg>
  )
}
