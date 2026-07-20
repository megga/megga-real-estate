// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lamp7 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.1875 9.80723C5.1875 12.62 6.89307 15.029 9.32544 16.0545V18.3195C9.32544 19.7935 10.5319 21 12.0059 21C13.4789 21 14.6854 19.7935 14.6854 18.3195V16.0662C17.5206 14.8675 19.3653 11.7434 18.6618 8.35462C18.1199 5.76074 16.0222 3.67475 13.4293 3.14449C9.04912 2.25716 5.1875 5.57686 5.1875 9.80723Z" stroke="currentColor"></path>
<path d="M9.31641 16.0703H14.6822" stroke="currentColor"></path>
<path d="M13.0378 16.0523L14.755 8.25781L14.2054 9.23118L12.9561 8.31369L11.8606 9.23118L10.8292 8.31369L9.80569 9.23118L9.24512 8.25781L10.9324 16.0523" stroke="currentColor"></path>
    </svg>
  ),
)

Lamp7.displayName = 'Lamp7'

export default Lamp7
