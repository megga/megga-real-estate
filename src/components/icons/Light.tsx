// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Light = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.001 6.65163C16.8114 6.65163 20.7109 10.5511 20.7109 15.3616H3.29102C3.29102 10.5511 7.19049 6.65163 12.001 6.65163ZM12.001 6.65163L12.0013 3" stroke="currentColor"></path>
<path d="M8.83008 18.3007C9.23113 19.6787 10.496 20.6808 11.9997 20.6808C13.5023 20.6808 14.7798 19.6787 15.1683 18.3007" stroke="currentColor"></path>
    </svg>
  ),
)

Light.displayName = 'Light'

export default Light
