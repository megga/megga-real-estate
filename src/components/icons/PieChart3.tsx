// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PieChart3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.902 11.3703C18.6436 7.20798 15.1861 3.91211 10.9587 3.91211C8.93998 3.91211 7.09679 4.66372 5.69372 5.90237C4.04183 7.36068 3 9.49409 3 11.8708C3 14.5487 4.32258 16.9177 6.35017 18.3603C7.65064 19.2855 9.24114 19.8296 10.9587 19.8296C11.7512 19.8296 12.5166 19.7137 13.239 19.4981C13.5039 19.419 13.6361 19.1296 13.5405 18.8703L11.2072 12.5445C11.0867 12.2177 11.3285 11.8708 11.6768 11.8708H18.417C18.6934 11.8708 18.9191 11.6461 18.902 11.3703Z" stroke="currentColor"></path>
<path d="M20.9989 14.4991C21.0194 14.2234 20.7933 13.9989 20.5169 13.9989H15.0869C14.7386 13.9989 14.4968 14.3458 14.6173 14.6726L16.497 19.7688C16.5927 20.0281 16.8815 20.1625 17.1329 20.0475C19.2814 19.064 20.8151 16.9695 20.9989 14.4991Z" stroke="currentColor"></path>
<path d="M11.1432 12.051L5.69385 5.9023" stroke="currentColor"></path>
    </svg>
  ),
)

PieChart3.displayName = 'PieChart3'

export default PieChart3
