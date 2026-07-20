// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const WebsiteShield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.7287 12.0931V8.16016C20.7287 5.30316 18.9501 3.28516 16.0905 3.28516H7.90967C5.05884 3.28516 3.27148 5.30316 3.27148 8.16016V15.8672C3.27148 18.7232 5.05009 20.7411 7.90967 20.7411H9.60748" stroke="currentColor"></path>
<path d="M11.5783 6.72656H11.5141M6.47828 6.72656H6.41406H6.47828ZM9.02807 6.72656H8.96385H9.02807Z" stroke="currentColor"></path>
<path d="M20.7287 9.57812H3.27148" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.5888 21.2822C16.5888 21.2822 19.7218 20.3341 19.7218 17.7181C19.7218 15.1021 19.8356 15.1872 19.5846 14.9332C19.3326 14.6792 16.9994 13.8672 16.5888 13.8672C16.1782 13.8672 13.845 14.6812 13.593 14.9332C13.341 15.1842 13.4558 15.1021 13.4558 17.7181C13.4558 20.3341 16.5888 21.2822 16.5888 21.2822Z" stroke="currentColor"></path>
    </svg>
  ),
)

WebsiteShield.displayName = 'WebsiteShield'

export default WebsiteShield
