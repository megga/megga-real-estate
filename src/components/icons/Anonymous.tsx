// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Anonymous = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.1759 17.4459C10.1759 19.2189 8.73886 20.6558 6.96586 20.6558C5.19286 20.6558 3.75586 19.2189 3.75586 17.4459C3.75586 15.6729 5.19286 14.2358 6.96586 14.2358C8.73886 14.2358 10.1759 15.6729 10.1759 17.4459Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.2462 17.4459C20.2462 19.2189 18.8092 20.6558 17.0362 20.6558C15.2632 20.6558 13.8262 19.2189 13.8262 17.4459C13.8262 15.6729 15.2632 14.2358 17.0362 14.2358C18.8092 14.2358 20.2462 15.6729 20.2462 17.4459Z" stroke="currentColor"></path>
<path d="M10.1758 17.4067C11.0399 16.3766 12.6945 16.5121 13.8258 17.4067" stroke="currentColor"></path>
<path d="M18.753 10.1248L18.483 7.39977C18.286 5.41777 16.5213 4.64194 14.627 3.90776C12.7149 3.16669 11.4703 6.26113 9.376 3.90776C8.03002 2.73563 5.85446 5.33117 5.52 7.39977L5.25 10.1248" stroke="currentColor"></path>
<path d="M3 10.7906C8.955 9.80957 14.956 9.82357 21 10.7906" stroke="currentColor"></path>
    </svg>
  ),
)

Anonymous.displayName = 'Anonymous'

export default Anonymous
