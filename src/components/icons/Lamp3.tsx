// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lamp3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.32544 16.0545C6.89307 15.029 5.1875 12.62 5.1875 9.80723C5.1875 5.57686 9.04912 2.25716 13.4293 3.14449C16.0222 3.67475 18.1199 5.76074 18.6618 8.35462C19.3653 11.7434 17.5206 14.8675 14.6854 16.0662V18.3195C14.6854 19.7935 13.4789 21 12.0059 21C10.5319 21 9.32544 19.7935 9.32544 18.3195V16.0545Z" stroke="currentColor"></path>
<path d="M12.252 16.0703H14.6902" stroke="currentColor"></path>
<path d="M9.15234 9.09283C9.15234 7.85038 10.2858 6.87548 11.5721 7.13623" stroke="currentColor"></path>
    </svg>
  ),
)

Lamp3.displayName = 'Lamp3'

export default Lamp3
