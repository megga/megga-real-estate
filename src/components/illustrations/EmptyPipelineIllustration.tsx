interface Props { className?: string }

export default function EmptyPipelineIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <svg viewBox="0 0 160 120" fill="none" className={className}>
      {/* Pipeline columns */}
      <rect x="10" y="20" width="28" height="80" rx="4" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" />
      <rect x="44" y="20" width="28" height="80" rx="4" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" />
      <rect x="78" y="20" width="28" height="80" rx="4" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" />
      <rect x="112" y="20" width="28" height="80" rx="4" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" />

      {/* Column headers */}
      <rect x="14" y="25" width="20" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="48" y="25" width="20" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="82" y="25" width="20" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="116" y="25" width="20" height="3" rx="1.5" fill="#CBD5E1" />

      {/* Dotted card placeholders */}
      <rect x="14" y="34" width="20" height="14" rx="2" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="3 2" fill="none" opacity="0.4" />
      <rect x="14" y="52" width="20" height="14" rx="2" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="3 2" fill="none" opacity="0.3" />
      <rect x="48" y="34" width="20" height="14" rx="2" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="3 2" fill="none" opacity="0.4" />

      {/* Arrow pointing to first column */}
      <path d="M24 112 L24 105" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M19 108 L24 103 L29 108" stroke="#3B82F6" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />

      {/* Plus icon in first column */}
      <circle cx="24" cy="75" r="6" fill="#3B82F6" opacity="0.08" />
      <line x1="24" y1="71" x2="24" y2="79" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="20" y1="75" x2="28" y2="75" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />

      {/* Connecting arrow between columns */}
      <path d="M38 45 L44 45" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      <path d="M72 45 L78 45" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      <path d="M106 45 L112 45" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
    </svg>
  )
}
