// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HouseLock2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.78488 21.6211H17.2159C19.0509 21.6211 20.5379 20.1331 20.5379 18.2981V11.1261C20.5379 10.2341 20.1369 9.39107 19.4459 8.82707L13.8719 4.28709C12.7819 3.39909 11.2189 3.39909 10.1289 4.28709L4.5549 8.82707C3.8639 9.39107 3.46289 10.2341 3.46289 11.1261V18.2981C3.46289 20.1331 4.94988 21.6211 6.78488 21.6211Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.4492 17.4922H10.5542C9.76017 17.4922 9.11719 16.8492 9.11719 16.0552V14.4302C9.11719 13.6372 9.76017 12.9922 10.5542 12.9922H13.4492C14.2432 12.9922 14.8862 13.6372 14.8862 14.4302V16.0552C14.8862 16.8492 14.2432 17.4922 13.4492 17.4922Z" stroke="currentColor"></path>
<path d="M13.7304 13.0242V11.9923C13.7184 11.0383 12.9354 10.2733 11.9804 10.2853C11.0454 10.2963 10.2894 11.0492 10.2734 11.9852V13.0242" stroke="currentColor"></path>
    </svg>
  ),
)

HouseLock2.displayName = 'HouseLock2'

export default HouseLock2
