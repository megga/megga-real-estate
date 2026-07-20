// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RemoveUser2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M13.4628 7.99553C13.4628 10.2017 11.6744 11.9911 9.46732 11.9911C7.26113 11.9911 5.47266 10.2017 5.47266 7.99553C5.47266 5.78934 7.26113 4 9.46732 4C11.6744 4 13.4628 5.78934 13.4628 7.99553Z" stroke="currentColor"></path>
<path d="M20.7873 11.8125H16.8281" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.46736 14.875C6.09192 14.875 3.21289 15.3853 3.21289 17.428C3.21289 19.4707 6.07549 19.9991 9.46736 19.9991C12.8411 19.9991 15.7218 19.4872 15.7218 17.4461C15.7218 15.4034 12.8601 14.875 9.46736 14.875Z" stroke="currentColor"></path>
    </svg>
  ),
)

RemoveUser2.displayName = 'RemoveUser2'

export default RemoveUser2
