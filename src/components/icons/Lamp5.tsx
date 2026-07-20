// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lamp5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.54492 11.455H3.64079M20.4533 11.455H20.3797M6.02152 5.47659L6.0893 5.54438M17.9773 17.4323L17.925 17.3801M17.9775 5.47659L17.9097 5.54438M6.0217 17.4323L6.07399 17.3801M12 3V3.09587" stroke="currentColor"></path>
<path d="M6.14648 11.5056C6.14648 13.8917 7.59421 15.9359 9.65782 16.8065V18.7278C9.65782 19.9789 10.6814 21.0015 11.9316 21.0015C13.1817 21.0015 14.2053 19.9789 14.2053 18.7278V16.8162C16.6108 15.7994 18.1757 13.149 17.5791 10.2738C17.1201 8.07273 15.3393 6.30351 13.1391 5.85321C9.42347 5.09981 6.14648 7.91682 6.14648 11.5056Z" stroke="currentColor"></path>
<path d="M9.6582 16.8203H14.2115" stroke="currentColor"></path>
    </svg>
  ),
)

Lamp5.displayName = 'Lamp5'

export default Lamp5
