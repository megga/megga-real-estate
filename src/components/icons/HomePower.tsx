// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HomePower = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17.2159 21H6.78462C4.94959 21 3.46289 19.5123 3.46289 17.6783V10.5045C3.46289 9.6133 3.86376 8.76973 4.55457 8.20638L10.1287 3.66551C11.2185 2.77816 12.782 2.77816 13.8718 3.66551L19.4459 8.20638C20.1367 8.76973 20.5376 9.6133 20.5376 10.5045V17.6783C20.5376 19.5123 19.0509 21 17.2159 21Z" stroke="currentColor"></path>
<path d="M12.0005 16.4805C10.2177 16.4805 8.77246 15.0352 8.77246 13.2524L8.77246 11.2378C8.77246 10.8844 9.05892 10.5979 9.41229 10.5979L14.5887 10.5979C14.9421 10.5979 15.2285 10.8844 15.2285 11.2378L15.2285 13.2524C15.2285 15.0352 13.7833 16.4805 12.0005 16.4805Z" stroke="currentColor"></path>
<path d="M12 16.4844V20.989" stroke="currentColor"></path>
<path d="M10.3164 10.5977L10.3164 8.51465M13.6839 10.5977L13.6839 8.51465" stroke="currentColor"></path>
    </svg>
  ),
)

HomePower.displayName = 'HomePower'

export default HomePower
