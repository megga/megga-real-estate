// MEGGA — Icônes line-stroke pour le PDF KYC (sous-set du modèle Sugar Pure)
// Pas d'icône AI/sparkle/brain : volontaire (PDF notaire = compliance, pas IA).

interface PdfIconProps {
  name: 'check' | 'checkAll' | 'alert' | 'shield' | 'dot' | 'lock' | 'file'
  size?: number
  stroke?: string
  sw?: number
}

export function PdfIcon({
  name,
  size = 16,
  stroke = 'currentColor',
  sw = 1.6,
}: PdfIconProps) {
  const paths: Record<PdfIconProps['name'], React.ReactElement> = {
    check: <path d="m5 13 4 4 10-12" />,
    checkAll: (
      <>
        <path d="m2 13 4 4 10-12" />
        <path d="m9 15 3 3 10-12" />
      </>
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5M12 16h.01" />
      </>
    ),
    shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />,
    dot: <circle cx="12" cy="12" r="3" />,
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    file: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
        <path d="M14 3v6h6" />
      </>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? null}
    </svg>
  )
}
