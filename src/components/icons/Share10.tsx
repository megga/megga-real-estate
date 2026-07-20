// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Share10 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.41438 4.54297H7.37569C4.68641 4.54297 3 6.4456 3 9.13817V16.4049C3 19.0975 4.67817 21.0001 7.37569 21.0001H15.0931C17.7915 21.0001 19.4706 19.0975 19.4706 16.4049V13.8131" stroke="currentColor"></path>
<path d="M21 6.33333H17.4C15.5098 6.33333 14.5647 6.33333 13.8428 6.69665C13.2077 7.01622 12.6914 7.52616 12.3679 8.15337C12 8.8664 12 9.79983 12 11.6667V13M21 6.33333L17.625 3M21 6.33333L17.625 9.66667" stroke="currentColor"></path>
    </svg>
  ),
)

Share10.displayName = 'Share10'

export default Share10
