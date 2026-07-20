// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Call2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M18.066 21.8417C8.9168 22.2605 2.10348 11.8871 3.05009 6.82576C3.91863 5.33331 5.0319 4.22792 6.52185 3.354L9.76237 7.80524L8.11897 10.6593C8.11897 10.6593 8.57276 12.5647 10.2807 14.2726C12.0733 16.0652 14.073 16.6133 14.073 16.6133L16.9271 14.9699L21.5378 18.3699C20.68 19.9025 19.5986 20.9839 18.066 21.8417Z" stroke="currentColor"></path>
    </svg>
  ),
)

Call2.displayName = 'Call2'

export default Call2
