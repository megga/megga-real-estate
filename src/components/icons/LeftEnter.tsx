// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LeftEnter = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.39453 3.89648L6.59448 3.89648C4.60448 3.89648 2.99451 5.50949 2.99451 7.49649L2.99451 16.4965C2.99451 18.4845 4.60448 20.0965 6.59448 20.0965L8.39453 20.0965" stroke="currentColor"></path>
<path d="M8.875 9.7168L6.59497 11.9958L8.875 14.2758" stroke="currentColor"></path>
<path d="M18.5039 3.89648C19.8846 3.89648 21.0039 5.01577 21.0039 6.39648L21.0039 17.5957C21.0039 18.9764 19.8846 20.0957 18.5039 20.0957L16.3334 20.0957C14.9527 20.0957 13.8334 18.9764 13.8334 17.5957L13.8334 6.39648C13.8334 5.01577 14.9527 3.89648 16.3334 3.89648L18.5039 3.89648Z" stroke="currentColor"></path>
<path d="M13.8242 11.9961L6.59852 11.9961" stroke="currentColor"></path>
    </svg>
  ),
)

LeftEnter.displayName = 'LeftEnter'

export default LeftEnter
