// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lock4 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path fillRule="evenodd" clipRule="evenodd" d="M18.4098 15.5565C18.4098 19.0965 15.5398 21.9665 11.9998 21.9665C8.45985 21.9665 5.58984 19.0965 5.58984 15.5565C5.58984 12.0165 8.45985 9.14648 11.9998 9.14648C15.5398 9.14648 18.4098 12.0165 18.4098 15.5565Z" stroke="currentColor"></path>
<path d="M12 14.5605V16.5605" stroke="currentColor"></path>
<path d="M7.89844 10.6461V7.99909C7.93444 5.77609 9.73443 3.9951 11.9484 3.9671C14.2164 3.9401 16.0794 5.75009 16.1074 8.01809V10.6461" stroke="currentColor"></path>
    </svg>
  ),
)

Lock4.displayName = 'Lock4'

export default Lock4
