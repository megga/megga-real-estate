// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Password3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.6889 12.0001C10.6889 13.0231 9.85986 13.8521 8.83686 13.8521C7.81386 13.8521 6.98486 13.0231 6.98486 12.0001C6.98486 10.9771 7.81386 10.1481 8.83686 10.1481H8.83986C9.86186 10.1491 10.6889 10.9781 10.6889 12.0001Z" stroke="currentColor"></path>
<path d="M10.6919 12.0001H17.0099V13.8521" stroke="currentColor"></path>
<path d="M14.1821 13.8521V12.0001" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M2.75 12.0001C2.75 5.06312 5.063 2.75012 12 2.75012C18.937 2.75012 21.25 5.06312 21.25 12.0001C21.25 18.9371 18.937 21.2501 12 21.2501C5.063 21.2501 2.75 18.9371 2.75 12.0001Z" stroke="currentColor"></path>
    </svg>
  ),
)

Password3.displayName = 'Password3'

export default Password3
