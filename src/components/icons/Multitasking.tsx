// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Multitasking = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3.46777 14.5235V9.44939C3.46777 7.72139 4.86788 6.32031 6.59588 6.32031H17.4037C19.1317 6.32031 20.5328 7.72139 20.5328 9.44939V14.5235C20.5328 16.2515 19.1317 17.6516 17.4037 17.6516H6.59588C4.86788 17.6516 3.46777 16.2515 3.46777 14.5235Z" stroke="currentColor"></path>
<path d="M6.45801 17.6914V19.0536C6.45801 20.4284 7.57887 21.056 8.95368 21.056H15.0484C16.4329 21.056 17.5441 20.4284 17.5441 19.0536V17.6914" stroke="currentColor"></path>
<path d="M6.45801 6.29032V4.92816C6.45801 3.55335 7.57887 2.92578 8.95368 2.92578H15.0484C16.4329 2.92578 17.5441 3.55335 17.5441 4.92816V6.29032" stroke="currentColor"></path>
    </svg>
  ),
)

Multitasking.displayName = 'Multitasking'

export default Multitasking
