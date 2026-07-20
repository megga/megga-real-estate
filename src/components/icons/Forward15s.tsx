// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Forward15s = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.4977 11.8132C19.3985 7.34336 15.744 3.75018 11.2498 3.75018C6.6934 3.75018 3 7.44455 3 12C3 16.5564 6.6934 20.2498 11.2498 20.2498C14.0666 20.2498 16.5535 18.839 18.0421 16.6839" stroke="currentColor"></path>
<path d="M20.9998 9.80078L19.7194 12.0211L17.5117 10.7475" stroke="currentColor"></path>
<path d="M10.5293 14.6116H12.3828C13.1242 14.6116 13.7255 14.0103 13.7255 13.2698C13.7255 12.5275 13.1242 11.9271 12.3828 11.9271H10.5293V9.38672H13.4706" stroke="currentColor"></path>
<path d="M7.86719 14.6116V9.38672" stroke="currentColor"></path>
    </svg>
  ),
)

Forward15s.displayName = 'Forward15s'

export default Forward15s
