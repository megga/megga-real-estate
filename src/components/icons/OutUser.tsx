// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const OutUser = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.52596 14.877C6.15051 14.877 3.27148 15.3872 3.27148 17.4299C3.27148 19.4727 6.13408 20.0011 9.52596 20.0011C12.8997 20.0011 15.7804 19.4891 15.7804 17.4481C15.7804 15.4054 12.9187 14.877 9.52596 14.877Z" stroke="currentColor"></path>
<path d="M20.7288 11.7378H16.2031M20.7288 11.7378L18.9032 9.91992M20.7288 11.7378L18.9032 13.5548" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.5214 7.99357C13.5214 10.1998 11.733 11.9891 9.52591 11.9891C7.31972 11.9891 5.53125 10.1998 5.53125 7.99357C5.53125 5.78739 7.31972 3.99805 9.52591 3.99805C11.733 3.99805 13.5214 5.78739 13.5214 7.99357Z" stroke="currentColor"></path>
    </svg>
  ),
)

OutUser.displayName = 'OutUser'

export default OutUser
