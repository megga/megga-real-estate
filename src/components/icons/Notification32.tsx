// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Notification32 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M12.25 3.0238C8.83259 3.0238 6.06222 5.79417 6.06222 9.21158V13.7922L4.44959 15.4268V18.131H20.0504V15.4268L18.4378 13.7922V9.21158" stroke="currentColor"></path>
<path d="M15.4177 18.1312V18.3572C15.4177 20.1061 13.9999 21.5239 12.251 21.5239C10.5021 21.5239 9.08435 20.1061 9.08435 18.3572V18.1312" stroke="currentColor"></path>
<circle cx="16.5883" cy="5.09814" r="2.34473" stroke="currentColor"></circle>
    </svg>
  ),
)

Notification32.displayName = 'Notification32'

export default Notification32
