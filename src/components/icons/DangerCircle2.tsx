// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DangerCircle2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M21.2502 11.9999C21.2502 18.9369 18.9372 21.2499 12.0002 21.2499C5.06324 21.2499 2.75024 18.9369 2.75024 11.9999C2.75024 5.06288 5.06324 2.74988 12.0002 2.74988C18.9372 2.74988 21.2502 5.06288 21.2502 11.9999Z" stroke="currentColor"></path>
<path d="M12.0002 15.895V12" stroke="currentColor"></path>
<path d="M12.0045 8.5H11.9955" stroke="currentColor"></path>
    </svg>
  ),
)

DangerCircle2.displayName = 'DangerCircle2'

export default DangerCircle2
