// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Key8 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M14.5804 6.95194L11.9174 4.29795C10.5644 2.94495 8.37043 2.94495 7.01643 4.29795L4.11143 7.19596C2.75843 8.54796 2.75843 10.7519 4.11143 12.1039L6.77343 14.7669C8.12643 16.1209 10.3214 16.1209 11.6824 14.7669L12.9324 13.5099L11.8224 14.647L13.2664 16.0899C13.4264 16.2509 13.5304 16.459 13.5624 16.683L13.6734 17.4649C13.7384 17.9199 14.0914 18.2789 14.5434 18.3509L15.5164 18.5069C15.8494 18.5609 16.1354 18.7719 16.2864 19.0729L17.0974 20.7029C17.2854 21.0809 17.6814 21.3079 18.1014 21.2809L20.9034 21.0989V19.3819C20.9034 18.4279 20.5224 17.5169 19.8534 16.8409L14.7194 11.7049C15.9254 10.3439 15.8904 8.26194 14.5804 6.95194Z" stroke="currentColor"></path>
<path d="M9.7811 7.36133L7.4541 9.68829" stroke="currentColor"></path>
    </svg>
  ),
)

Key8.displayName = 'Key8'

export default Key8
