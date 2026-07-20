// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UpGraphBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.8186 6.46767C20.8186 6.46767 20.8089 6.46767 20.8186 6.45794M16.2178 3.00027H7.78313C4.84378 3.00027 3 5.08146 3 8.02665V15.9739C3 18.9191 4.83503 21.0003 7.78313 21.0003H16.2169C19.1659 21.0003 21 18.9191 21 15.9739V8.02665C21 5.08146 19.1659 3.00027 16.2178 3.00027Z" stroke="currentColor"></path>
<path d="M3.17773 17.4636L9.7453 9.962L13.9583 13.7177L20.8177 6.46902" stroke="currentColor"></path>
    </svg>
  ),
)

UpGraphBox.displayName = 'UpGraphBox'

export default UpGraphBox
