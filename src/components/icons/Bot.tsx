// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bot = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.12273 7.51172H14.8779C16.89 7.51172 18.1412 8.93129 18.1412 10.9414V14.9092C18.1412 16.9194 16.89 18.339 14.8769 18.339H9.12273C7.11159 18.339 5.85938 16.9194 5.85938 14.9092V10.9414C5.85938 8.93129 7.11743 7.51172 9.12273 7.51172Z" stroke="currentColor"></path>
<path d="M10.6465 14.5234C11.5484 14.9175 12.4504 14.9175 13.3523 14.5234" stroke="currentColor"></path>
<path d="M14.207 11.01V11" stroke="currentColor"></path>
<path d="M9.79297 11.01V11" stroke="currentColor"></path>
<path d="M5.85955 11H5.62409C4.61025 11 3.78809 11.8212 3.78809 12.835C3.78809 13.8489 4.61025 14.671 5.62409 14.671H5.85955" stroke="currentColor"></path>
<path d="M18.1406 11H18.3771C19.3909 11 20.2121 11.8212 20.2121 12.835C20.2121 13.8489 19.3909 14.671 18.3771 14.671H18.1406" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.235 4.2347C13.235 3.55265 12.6824 3 12.0003 3C11.3183 3 10.7656 3.55265 10.7656 4.2347C10.7656 4.91676 11.3183 5.46949 12.0004 5.46949C12.6824 5.46949 13.235 4.91676 13.235 4.2347Z" stroke="currentColor"></path>
<path d="M12 7.51005V5.46875" stroke="currentColor"></path>
<path d="M8.6582 21H15.3435" stroke="currentColor"></path>
    </svg>
  ),
)

Bot.displayName = 'Bot'

export default Bot
