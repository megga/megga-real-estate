// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Notification2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M6.06222 8.93778C6.06222 5.52036 8.83258 2.75 12.25 2.75C15.6674 2.75 18.4378 5.52036 18.4378 8.93777V13.5184L20.0504 17.8572H4.44958L6.06222 13.5184V8.93778Z" stroke="currentColor"></path>
<path d="M15.4177 17.8574V18.0834C15.4177 19.8323 13.9999 21.2501 12.251 21.2501C10.5021 21.2501 9.08435 19.8323 9.08435 18.0834V17.8574" stroke="currentColor"></path>
    </svg>
  ),
)

Notification2.displayName = 'Notification2'

export default Notification2
