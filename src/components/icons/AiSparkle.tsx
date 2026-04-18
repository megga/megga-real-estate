// AI sparkle — 4-point primary star + secondary small star (Apple Intelligence /
// Notion AI style). Uses `currentColor` so it inherits from the chip's text
// color. Drop-in replacement for lucide's <Sparkles/> where we want a cleaner,
// more premium feel.

interface AiSparkleProps {
  className?: string
  'aria-hidden'?: boolean
}

export default function AiSparkle({ className, ...rest }: AiSparkleProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden={rest['aria-hidden'] ?? true}
    >
      {/* Main 4-point sparkle, centered */}
      <path d="M10.5 3c.28 0 .53.18.62.44l1.4 4.2a1 1 0 0 0 .64.64l4.2 1.4a.66.66 0 0 1 0 1.24l-4.2 1.4a1 1 0 0 0-.64.64l-1.4 4.2a.66.66 0 0 1-1.24 0l-1.4-4.2a1 1 0 0 0-.64-.64l-4.2-1.4a.66.66 0 0 1 0-1.24l4.2-1.4a1 1 0 0 0 .64-.64l1.4-4.2A.66.66 0 0 1 10.5 3Z" />
      {/* Secondary small sparkle, top-right */}
      <path
        d="M18.5 13.5c.19 0 .36.12.42.3l.63 1.9c.05.15.17.27.32.32l1.9.63a.44.44 0 0 1 0 .84l-1.9.63a.67.67 0 0 0-.32.32l-.63 1.9a.44.44 0 0 1-.84 0l-.63-1.9a.67.67 0 0 0-.32-.32l-1.9-.63a.44.44 0 0 1 0-.84l1.9-.63a.67.67 0 0 0 .32-.32l.63-1.9a.44.44 0 0 1 .42-.3Z"
        opacity="0.55"
      />
    </svg>
  )
}
