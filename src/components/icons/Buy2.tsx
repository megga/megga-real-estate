// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Buy2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M14.625 10.9637H17.2967" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.90889 20.0273C8.19889 20.0273 8.43302 20.2624 8.43302 20.5515C8.43302 20.8415 8.19889 21.0766 7.90889 21.0766C7.61889 21.0766 7.38477 20.8415 7.38477 20.5515C7.38477 20.2624 7.61889 20.0273 7.90889 20.0273Z" fill="currentColor" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.7761 20.0273C19.0661 20.0273 19.3012 20.2624 19.3012 20.5515C19.3012 20.8415 19.0661 21.0766 18.7761 21.0766C18.4861 21.0766 18.252 20.8415 18.252 20.5515C18.252 20.2624 18.4861 20.0273 18.7761 20.0273Z" fill="currentColor" stroke="currentColor"></path>
<path d="M5.87516 7.05288H21.5L20.2306 16.6875H6.74355L5.46652 3.99268H3" stroke="currentColor"></path>
    </svg>
  ),
)

Buy2.displayName = 'Buy2'

export default Buy2
