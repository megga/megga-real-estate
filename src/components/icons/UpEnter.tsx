// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UpEnter = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.90039 8.39062V6.59058C3.90039 4.60058 5.5134 2.9906 7.5004 2.9906H16.5004C18.4884 2.9906 20.1004 4.60058 20.1004 6.59058V8.39062" stroke="currentColor"></path>
<path d="M9.7207 8.87109L11.9997 6.59106L14.2797 8.87109" stroke="currentColor"></path>
<path d="M3.90039 18.5C3.90039 19.8807 5.01968 21 6.40039 21H17.5996C18.9803 21 20.0996 19.8807 20.0996 18.5V16.3295C20.0996 14.9488 18.9803 13.8295 17.5996 13.8295H6.40039C5.01968 13.8295 3.90039 14.9488 3.90039 16.3295V18.5Z" stroke="currentColor"></path>
<path d="M12 13.8203V6.59462" stroke="currentColor"></path>
    </svg>
  ),
)

UpEnter.displayName = 'UpEnter'

export default UpEnter
