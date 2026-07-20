// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HouseLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.49609 9.39648V18.0715C4.49609 19.7635 5.86809 21.1345 7.56009 21.1345H16.4401C18.1321 21.1345 19.5041 19.7635 19.5041 18.0715V9.39648" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.382 17.2676H10.619C9.86205 17.2676 9.24805 16.6536 9.24805 15.8966V14.3456C9.24805 13.5886 9.86205 12.9746 10.619 12.9746H13.382C14.139 12.9746 14.752 13.5886 14.752 14.3456V15.8966C14.752 16.6536 14.139 17.2676 13.382 17.2676Z" stroke="currentColor"></path>
<path d="M13.6505 13.0008V12.0168C13.6395 11.1058 12.8915 10.3768 11.9815 10.3888C11.0895 10.3988 10.3675 11.1169 10.3535 12.0099V13.0008" stroke="currentColor"></path>
<path d="M21 10.5766L13.474 4.61967C12.61 3.93667 11.39 3.93667 10.526 4.61967L3 10.5766" stroke="currentColor"></path>
    </svg>
  ),
)

HouseLock.displayName = 'HouseLock'

export default HouseLock
