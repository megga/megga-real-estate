// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DownGraphBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.8186 17.5333C20.8186 17.5333 20.8089 17.5333 20.8186 17.543M16.2178 21.0003H7.78313C4.84378 21.0003 3 18.9191 3 15.9739V8.02665C3 5.08146 4.83503 3.00027 7.78313 3.00027H16.2169C19.1659 3.00027 21 5.08146 21 8.02665V15.9739C21 18.9191 19.1659 21.0003 16.2178 21.0003Z" stroke="currentColor"></path>
<path d="M3.17773 6.53934L9.7453 14.041L13.9583 10.2853L20.8177 17.5339" stroke="currentColor"></path>
    </svg>
  ),
)

DownGraphBox.displayName = 'DownGraphBox'

export default DownGraphBox
