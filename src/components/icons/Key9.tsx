// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Key9 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.7822 3.2832H16.2169C19.165 3.2832 21 5.36418 21 8.31018V16.2572C21 19.2022 19.165 21.2832 16.2159 21.2832H7.7822C4.8341 21.2832 3 19.2022 3 16.2572V8.31018C3 5.36418 4.8428 3.2832 7.7822 3.2832Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.7211 12.2805C10.7211 13.2765 9.91449 14.0825 8.91919 14.0825C7.92379 14.0825 7.11719 13.2765 7.11719 12.2805C7.11719 11.2855 7.92379 10.4785 8.91919 10.4785H8.92309C9.91649 10.4805 10.7211 11.2875 10.7211 12.2805Z" stroke="currentColor"></path>
<path d="M10.7285 12.2832H16.8757V14.0852" stroke="currentColor"></path>
<path d="M14.125 14.0852V12.2832" stroke="currentColor"></path>
    </svg>
  ),
)

Key9.displayName = 'Key9'

export default Key9
