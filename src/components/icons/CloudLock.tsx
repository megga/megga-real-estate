// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CloudLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.5637 17.4771C19.9998 16.8291 21 15.3831 21 13.7031C21 11.1071 19.1699 9.56404 16.897 9.56204C16.897 7.93104 15.6166 4.66406 12 4.66406C8.38346 4.66406 7.10303 7.93104 7.10303 9.56204C4.83308 9.58304 3 11.1071 3 13.7031C3 15.3831 3.99924 16.8291 5.43632 17.4771" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.4865 19.902H10.518C9.70463 19.902 9.04492 19.242 9.04492 18.429V16.7621C9.04492 15.9491 9.70463 15.2891 10.518 15.2891H13.4865C14.2999 15.2891 14.9596 15.9491 14.9596 16.7621V18.429C14.9596 19.242 14.2999 19.902 13.4865 19.902Z" stroke="currentColor"></path>
<path d="M13.7721 15.3188V14.2228C13.7595 13.2438 12.9568 12.4598 11.9779 12.4728C11.0196 12.4848 10.2451 13.2558 10.2285 14.2148V15.3188" stroke="currentColor"></path>
    </svg>
  ),
)

CloudLock.displayName = 'CloudLock'

export default CloudLock
