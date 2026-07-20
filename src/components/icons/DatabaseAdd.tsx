// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseAdd = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.7363 18.7986L15.4893 18.7976M17.7363 18.7986L17.7372 21.0445L17.7363 18.7986ZM17.7363 18.7986L17.7353 16.5527L17.7363 18.7986ZM17.7363 18.7986H19.9813H17.7363Z" stroke="currentColor"></path>
<path d="M3.99023 5.88965V11.6695C3.99023 11.6695 3.99023 14.5593 11.2912 14.5593C18.5921 14.5593 18.5921 11.6695 18.5921 11.6695V5.88965" stroke="currentColor"></path>
<path d="M3.99023 11.6699V17.4497C3.99023 17.4497 3.99023 20.3405 11.2912 20.3405" stroke="currentColor"></path>
<ellipse cx="11.2912" cy="5.9082" rx="7.30095" ry="2.9082" stroke="currentColor"></ellipse>
    </svg>
  ),
)

DatabaseAdd.displayName = 'DatabaseAdd'

export default DatabaseAdd
