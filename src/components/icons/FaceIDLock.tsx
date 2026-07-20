// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FaceIDLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M2.99902 16.1523V17.7293C2.99902 19.8783 4.74203 21.6213 6.89203 21.6213H8.14902" stroke="currentColor"></path>
<path d="M21.0013 16.1523V17.7293C21.0013 19.8783 19.2583 21.6213 17.1083 21.6213H15.8193" stroke="currentColor"></path>
<path d="M2.99902 9.09009V7.51309C2.99902 5.36409 4.74203 3.62109 6.89203 3.62109H8.18103" stroke="currentColor"></path>
<path d="M21.0006 9.09009V7.51309C21.0006 5.36409 19.2576 3.62109 17.1076 3.62109H15.8506" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.8106 17.1309H10.1896C9.19661 17.1309 8.3916 16.3259 8.3916 15.3339V13.3009C8.3916 12.3079 9.19661 11.5039 10.1896 11.5039H13.8106C14.8036 11.5039 15.6076 12.3079 15.6076 13.3009V15.3339C15.6076 16.3259 14.8036 17.1309 13.8106 17.1309Z" stroke="currentColor"></path>
<path d="M14.1619 11.5346V10.2446C14.1469 9.05056 13.1679 8.09455 11.9729 8.10955C10.8039 8.12455 9.85887 9.06556 9.83887 10.2356V11.5346" stroke="currentColor"></path>
    </svg>
  ),
)

FaceIDLock.displayName = 'FaceIDLock'

export default FaceIDLock
