// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Light3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M12.0008 9.47213C14.6657 9.47213 16.8257 11.6321 16.8257 14.2971H7.17578C7.17578 11.6321 9.33578 9.47213 12.0008 9.47213ZM12.0008 9.47213L12.0007 7.44922M9.88661 14.4368C9.88661 15.6043 10.8333 16.551 12.0009 16.551C13.1685 16.551 14.1152 15.6043 14.1152 14.4368" stroke="currentColor"></path>
    </svg>
  ),
)

Light3.displayName = 'Light3'

export default Light3
