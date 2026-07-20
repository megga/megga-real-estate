// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SquareKey = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.2169 3.45264H7.78216C4.84281 3.45264 3 5.53383 3 8.47901V16.4263C3 19.3714 4.83405 21.4526 7.78216 21.4526H16.2159C19.165 21.4526 21 19.3714 21 16.4263V14.479" stroke="currentColor"></path>
<path d="M9.16471 12.5886L12.8968 8.85582C12.8343 8.5709 12.7915 8.28374 12.7915 7.98005C12.7915 5.711 14.6309 3.87158 16.8999 3.87158C19.169 3.87158 21.0084 5.711 21.0084 7.98005C21.0084 10.2491 19.169 12.0885 16.8999 12.0885C16.4594 12.0885 16.0334 12.0191 15.6356 11.8908L14.7897 12.7348H13.8073V14.2329H12.2846V15.2074C12.2846 15.483 12.0611 15.7065 11.7854 15.7065H9.51772C9.24204 15.7065 9.01855 15.483 9.01855 15.2074V12.9416C9.01855 12.8092 9.07113 12.6822 9.16471 12.5886Z" stroke="currentColor"></path>
<path d="M18.0434 8.02158C18.1612 7.33618 17.62 6.74218 16.9501 6.76998" stroke="currentColor"></path>
    </svg>
  ),
)

SquareKey.displayName = 'SquareKey'

export default SquareKey
