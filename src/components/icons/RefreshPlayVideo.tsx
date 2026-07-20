// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RefreshPlayVideo = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 17.3237L5.96272 18.0087L6.64381 15.0625" stroke="currentColor"></path>
<path d="M20.9993 6.67326L18.0366 5.98828L17.3555 8.93446" stroke="currentColor"></path>
<path d="M5.96956 17.7589C2.82489 14.5053 2.8463 9.31835 6.04934 6.09097C8.05465 4.06912 10.8393 3.28977 13.445 3.75582" stroke="currentColor"></path>
<path d="M18.032 6.23828C21.1767 9.49192 21.1553 14.6789 17.9523 17.9062C15.9469 19.9281 13.1623 20.7075 10.5566 20.2414" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.6389 13.0134C13.9219 13.6624 13.0267 14.2472 12.0411 14.6441C11.2024 14.9749 10.4989 14.5624 10.3958 13.7354C10.2703 12.5162 10.2732 11.3506 10.3958 10.2609C10.5086 9.40172 11.2831 9.03783 12.0411 9.35599C13.0111 9.75394 13.882 10.293 14.6389 10.9867C15.286 11.5724 15.3006 12.4053 14.6389 13.0134Z" stroke="currentColor"></path>
    </svg>
  ),
)

RefreshPlayVideo.displayName = 'RefreshPlayVideo'

export default RefreshPlayVideo
