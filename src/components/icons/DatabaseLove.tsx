// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseLove = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.0304 8.92142C15.0771 8.92142 18.3577 7.59805 18.3577 5.96559C18.3577 4.33313 15.0771 3.00977 11.0304 3.00977C6.98366 3.00977 3.70312 4.33313 3.70312 5.96559C3.70312 7.59805 6.98366 8.92142 11.0304 8.92142Z" stroke="currentColor"></path>
<path d="M3.70312 11.7969V17.6583C3.70312 17.6583 3.70312 20.2668 9.90663 20.5593" stroke="currentColor"></path>
<path d="M18.3571 10.8263V5.94141" stroke="currentColor"></path>
<path d="M9.90663 14.7019C3.70312 14.4094 3.70312 11.8009 3.70312 11.8009V5.93945" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.8285 17.6693C13.4583 16.512 13.8907 15.1909 15.105 14.8C15.7438 14.5967 16.4417 14.7139 16.9778 15.1163C17.515 14.717 18.2108 14.5999 18.8485 14.8C20.0618 15.1909 20.4983 16.512 20.1281 17.6693C19.5516 19.5006 16.9778 20.913 16.9778 20.913C16.9778 20.913 14.4248 19.5224 13.8285 17.6693Z" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseLove.displayName = 'DatabaseLove'

export default DatabaseLove
