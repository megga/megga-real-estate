// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Key4 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.7032 11.9566C10.7032 14.2016 8.88322 16.0206 6.63922 16.0206C4.39422 16.0206 2.57422 14.2016 2.57422 11.9566C2.57422 9.7116 4.39422 7.89258 6.63922 7.89258C8.88322 7.89258 10.7032 9.7116 10.7032 11.9566Z" stroke="currentColor"></path>
<path d="M20.5741 15.443V12.753C20.5741 12.315 20.2181 11.959 19.7801 11.959H10.7031" stroke="currentColor"></path>
<path d="M16.5742 15.443V11.959" stroke="currentColor"></path>
    </svg>
  ),
)

Key4.displayName = 'Key4'

export default Key4
