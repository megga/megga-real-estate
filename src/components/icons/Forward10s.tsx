// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Forward10s = forwardRef<SVGSVGElement, Props>(
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
<path d="M7.92578 14.6116V9.38672" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.1855 14.7134C11.2991 14.7134 10.5801 13.9944 10.5801 13.108V10.8954C10.5801 10.0081 11.2991 9.28906 12.1855 9.28906C13.0719 9.28906 13.7909 10.0081 13.7909 10.8954V13.108C13.7909 13.9944 13.0719 14.7134 12.1855 14.7134Z" stroke="currentColor"></path>
<path d="M20.9998 9.80078L19.7194 12.0211L17.5117 10.7475" stroke="currentColor"></path>
    </svg>
  ),
)

Forward10s.displayName = 'Forward10s'

export default Forward10s
