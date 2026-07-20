// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Forward5s2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3666 15.6129C19.3666 18.2905 17.6989 20.183 15.0183 20.183H7.35022C4.66867 20.183 3 18.2905 3 15.6129V8.38652C3 5.70886 4.66867 3.81641 7.34924 3.81641H15.0183C17.6911 3.81641 19.3666 5.70886 19.3666 8.38652V12.1169" stroke="currentColor"></path>
<path d="M20.9996 10.4648L19.3475 12.117L17.7051 10.4746" stroke="currentColor"></path>
<path d="M9.41211 14.6896H11.2783C12.0246 14.6896 12.6298 14.0844 12.6298 13.3382C12.6298 12.5919 12.0246 11.9867 11.2783 11.9867H9.41211V9.42969H12.3739" stroke="currentColor"></path>
    </svg>
  ),
)

Forward5s2.displayName = 'Forward5s2'

export default Forward5s2
