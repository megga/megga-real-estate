// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Dashboard1 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.8797 19.9046C19.7906 18.2563 21 15.82 21 13.0976C21 8.12186 16.9719 4.09375 11.9961 4.09375C7.02908 4.09375 3 8.12186 3 13.0976C3 15.82 4.21038 18.2563 6.1213 19.9046" stroke="currentColor"></path>
<path d="M15.8416 9.26953L13.4004 11.7107M13.9689 13.0962C13.9689 14.185 13.0864 15.0665 11.9976 15.0665C10.9098 15.0665 10.0273 14.185 10.0273 13.0962C10.0273 12.0075 10.9098 11.125 11.9976 11.125C13.0864 11.125 13.9689 12.0075 13.9689 13.0962Z" stroke="currentColor"></path>
    </svg>
  ),
)

Dashboard1.displayName = 'Dashboard1'

export default Dashboard1
