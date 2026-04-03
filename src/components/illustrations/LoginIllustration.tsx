interface Props { className?: string }

export default function LoginIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 500 600" fill="none" className={className} preserveAspectRatio="xMidYMid slice">
      {/* Sky gradient */}
      <rect width="500" height="600" fill="#0F172A" />
      <rect width="500" height="400" fill="url(#skyGrad)" />
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="60%" stopColor="#1E3A5F" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Stars */}
      <circle cx="60" cy="50" r="1" fill="white" opacity="0.4" />
      <circle cx="140" cy="80" r="0.8" fill="white" opacity="0.3" />
      <circle cx="300" cy="40" r="1.2" fill="white" opacity="0.5" />
      <circle cx="380" cy="90" r="0.8" fill="white" opacity="0.3" />
      <circle cx="440" cy="60" r="1" fill="white" opacity="0.4" />
      <circle cx="200" cy="30" r="0.6" fill="white" opacity="0.2" />
      <circle cx="350" cy="120" r="0.7" fill="white" opacity="0.25" />

      {/* Moon */}
      <circle cx="400" cy="100" r="25" fill="#FEF3C7" opacity="0.2" />
      <circle cx="400" cy="100" r="20" fill="#FEF3C7" opacity="0.15" />

      {/* Mountains - back layer */}
      <path d="M0 350 L80 220 L150 280 L220 200 L300 260 L370 190 L450 250 L500 210 L500 400 L0 400 Z" fill="#1E3A5F" opacity="0.5" />

      {/* Mountains - front layer (Alps) */}
      <path d="M0 380 L60 280 L100 310 L160 250 L210 290 L270 230 L340 280 L400 240 L460 290 L500 260 L500 420 L0 420 Z" fill="#1E293B" opacity="0.7" />
      {/* Snow caps */}
      <path d="M160 250 L145 272 L175 272 Z" fill="white" opacity="0.08" />
      <path d="M270 230 L252 258 L288 258 Z" fill="white" opacity="0.08" />
      <path d="M400 240 L385 260 L415 260 Z" fill="white" opacity="0.06" />

      {/* Lake */}
      <ellipse cx="250" cy="420" rx="250" ry="40" fill="#1E40AF" opacity="0.15" />
      {/* Lake reflections */}
      <rect x="180" y="415" width="40" height="1" fill="white" opacity="0.04" />
      <rect x="260" y="420" width="30" height="1" fill="white" opacity="0.03" />
      <rect x="220" y="425" width="50" height="1" fill="white" opacity="0.04" />

      {/* Jet d'eau (Geneva) */}
      <g transform="translate(250, 380)">
        <rect x="-1.5" y="-100" width="3" height="100" fill="white" opacity="0.06" />
        <path d="M0 -100 Q-8 -90 -12 -80 Q-5 -95 0 -100 Q5 -95 12 -80 Q8 -90 0 -100Z" fill="white" opacity="0.08" />
        <path d="M0 -80 Q-15 -60 -20 -40" stroke="white" strokeWidth="1" opacity="0.04" fill="none" />
        <path d="M0 -80 Q15 -60 20 -40" stroke="white" strokeWidth="1" opacity="0.04" fill="none" />
      </g>

      {/* City skyline */}
      {/* Buildings */}
      <rect x="50" y="360" width="20" height="40" fill="#1E293B" />
      <rect x="55" y="365" width="4" height="4" fill="#FEF3C7" opacity="0.15" />
      <rect x="61" y="370" width="4" height="4" fill="#FEF3C7" opacity="0.1" />

      <rect x="80" y="340" width="25" height="60" fill="#1E293B" />
      <rect x="85" y="348" width="4" height="4" fill="#FEF3C7" opacity="0.12" />
      <rect x="93" y="355" width="4" height="4" fill="#FEF3C7" opacity="0.1" />
      <rect x="85" y="365" width="4" height="4" fill="#FEF3C7" opacity="0.08" />

      <rect x="115" y="350" width="18" height="50" fill="#1E293B" />
      <rect x="120" y="356" width="3" height="3" fill="#FEF3C7" opacity="0.1" />

      {/* Church/cathedral spire */}
      <rect x="145" y="330" width="12" height="70" fill="#1E293B" />
      <path d="M151 330 L145 345 L157 345 Z" fill="#1E293B" />
      <path d="M151 325 L151 330" stroke="#1E293B" strokeWidth="2" />

      <rect x="340" y="345" width="22" height="55" fill="#1E293B" />
      <rect x="345" y="352" width="4" height="4" fill="#FEF3C7" opacity="0.12" />
      <rect x="353" y="358" width="4" height="4" fill="#FEF3C7" opacity="0.08" />

      <rect x="375" y="355" width="18" height="45" fill="#1E293B" />
      <rect x="405" y="340" width="25" height="60" fill="#1E293B" />
      <rect x="410" y="348" width="4" height="4" fill="#FEF3C7" opacity="0.1" />
      <rect x="418" y="355" width="4" height="4" fill="#FEF3C7" opacity="0.12" />

      <rect x="440" y="360" width="20" height="40" fill="#1E293B" />

      {/* Houses along lakefront */}
      {/* House 1 */}
      <g transform="translate(180, 368)">
        <path d="M0 0 L10 -10 L20 0 Z" fill="#1E293B" />
        <rect x="2" y="0" width="16" height="14" fill="#1E293B" />
        <rect x="6" y="4" width="4" height="4" fill="#FEF3C7" opacity="0.12" />
      </g>
      {/* House 2 */}
      <g transform="translate(210, 365)">
        <path d="M0 0 L8 -8 L16 0 Z" fill="#1E293B" />
        <rect x="1" y="0" width="14" height="18" fill="#1E293B" />
        <rect x="4" y="5" width="3" height="3" fill="#FEF3C7" opacity="0.1" />
      </g>

      {/* Houses right side */}
      <g transform="translate(300, 365)">
        <path d="M0 0 L10 -10 L20 0 Z" fill="#1E293B" />
        <rect x="2" y="0" width="16" height="18" fill="#1E293B" />
        <rect x="6" y="4" width="4" height="4" fill="#FEF3C7" opacity="0.1" />
      </g>

      {/* Foreground - ground */}
      <path d="M0 400 Q100 395 200 410 Q300 425 400 405 Q450 395 500 410 L500 600 L0 600 Z" fill="#0F172A" />

      {/* Trees silhouettes */}
      <g transform="translate(30, 390)">
        <rect x="-1.5" y="0" width="3" height="15" fill="#0F172A" />
        <circle cx="0" cy="-5" r="10" fill="#0F172A" />
      </g>
      <g transform="translate(470, 385)">
        <rect x="-1.5" y="0" width="3" height="12" fill="#0F172A" />
        <circle cx="0" cy="-4" r="8" fill="#0F172A" />
      </g>

      {/* MEGGA branded glow at bottom */}
      <ellipse cx="250" cy="550" rx="150" ry="30" fill="#3B82F6" opacity="0.04" />
    </svg>
  )
}
