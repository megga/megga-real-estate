// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DownEnter = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.90039 15.6016V17.4016C3.90039 19.3916 5.5134 21.0016 7.5004 21.0016H16.5004C18.4884 21.0016 20.1004 19.3916 20.1004 17.4016V15.6016" stroke="currentColor"></path>
<path d="M9.7207 15.1211L11.9997 17.4011L14.2797 15.1211" stroke="currentColor"></path>
<path d="M3.90039 5.49219C3.90039 4.11147 5.01968 2.99219 6.40039 2.99219H17.5996C18.9803 2.99219 20.0996 4.11148 20.0996 5.49219V7.66272C20.0996 9.04343 18.9803 10.1627 17.5996 10.1627H6.40039C5.01968 10.1627 3.90039 9.04343 3.90039 7.66271V5.49219Z" stroke="currentColor"></path>
<path d="M12 10.1719V17.3976" stroke="currentColor"></path>
    </svg>
  ),
)

DownEnter.displayName = 'DownEnter'

export default DownEnter
