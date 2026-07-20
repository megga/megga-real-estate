// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Discount2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M9.9082 14.6687L14.3828 10.1941" stroke="currentColor"></path>
<path d="M14.3161 14.6062H14.324" stroke="currentColor"></path>
<path d="M9.96456 10.2536H9.97239" stroke="currentColor"></path>
<path d="M12.25 3.28467C13.7806 5.30323 16.2811 6.33899 18.7907 5.99393C18.4457 8.50355 19.4814 11.0041 21.5 12.5347C19.4814 14.0652 18.4457 16.5658 18.7907 19.0754C16.2811 18.7303 13.7806 19.7661 12.25 21.7847C10.7194 19.7661 8.21888 18.7303 5.70926 19.0754C6.05432 16.5658 5.01856 14.0652 3 12.5347C5.01856 11.0041 6.05432 8.50355 5.70926 5.99393C8.21888 6.33899 10.7194 5.30323 12.25 3.28467Z" stroke="currentColor"></path>
    </svg>
  ),
)

Discount2.displayName = 'Discount2'

export default Discount2
