// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Forward5s = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.22852 14.6523H11.1093C11.8614 14.6523 12.4714 14.0423 12.4714 13.2901C12.4714 12.538 11.8614 11.929 11.1093 11.929H9.22852V9.35156H12.2126" stroke="currentColor"></path>
<path d="M19.4977 11.813C19.3985 7.34318 15.744 3.75 11.2498 3.75C6.6934 3.75 3 7.44437 3 11.9998C3 16.5562 6.6934 20.2496 11.2498 20.2496C14.0666 20.2496 16.5535 18.8388 18.0421 16.6837" stroke="currentColor"></path>
<path d="M20.9998 9.80078L19.7194 12.0211L17.5117 10.7475" stroke="currentColor"></path>
    </svg>
  ),
)

Forward5s.displayName = 'Forward5s'

export default Forward5s
