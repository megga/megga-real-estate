// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Preferences6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.5779 18.8573C17.5692 20.0492 16.5962 21.0086 15.4043 21.0008C14.2162 20.9969 13.2559 20.0307 13.2598 18.8417V18.8281C13.2685 17.6352 14.2415 16.6759 15.4334 16.6836C16.6254 16.6914 17.5857 17.6644 17.5779 18.8573Z" stroke="currentColor"></path>
<path d="M10.8475 12.0146C10.8387 13.2074 9.86571 14.1668 8.67379 14.159C7.48576 14.1551 6.52542 13.188 6.52931 12V11.9854C6.53807 10.7934 7.51106 9.8331 8.70298 9.84186C9.8949 9.84964 10.8552 10.8226 10.8475 12.0146Z" stroke="currentColor"></path>
<path d="M17.1717 5.17372C17.1629 6.36563 16.1899 7.32501 14.998 7.31722C13.81 7.31333 12.8496 6.34715 12.8535 5.15815V5.14453C12.8623 3.95164 13.8353 2.99226 15.0272 3.00005C16.2191 3.00783 17.1795 3.98083 17.1717 5.17372Z" stroke="currentColor"></path>
<path d="M3.66797 18.8418H13.2597M17.5806 18.8418H20.3303" stroke="currentColor"></path>
<path d="M3.66797 12.002H6.5276M10.8476 12.002H20.3304" stroke="currentColor"></path>
<path d="M3.66797 5.1582H12.8491M17.1683 5.1582H20.3295" stroke="currentColor"></path>
    </svg>
  ),
)

Preferences6.displayName = 'Preferences6'

export default Preferences6
