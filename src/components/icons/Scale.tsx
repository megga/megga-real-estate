// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Scale = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M8.08789 21.2832H15.9079" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.707 14.1842L17.157 7.11523L20.648 14.1842C18.62 16.9682 15.022 16.7392 13.707 14.1842Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.35156 15.9215L6.80054 8.85352L10.2916 15.9215C8.26456 18.7055 4.66556 18.4765 3.35156 15.9215Z" stroke="currentColor"></path>
<path d="M9.81619 14.9668H3.82617" stroke="currentColor"></path>
<path d="M20.1736 13.2285H14.1836" stroke="currentColor"></path>
<path d="M17.1609 7.11621L6.79688 8.85422M12.1529 7.92722V3.2832V7.92722Z" stroke="currentColor"></path>
    </svg>
  ),
)

Scale.displayName = 'Scale'

export default Scale
