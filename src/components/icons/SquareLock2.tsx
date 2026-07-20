// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SquareLock2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78198 3.9668H16.217C19.165 3.9668 21 6.0478 21 8.9928V16.9398C21 19.8858 19.165 21.9668 16.216 21.9668H7.78198C4.83398 21.9668 3 19.8858 3 16.9398V8.9928C3 6.0478 4.84298 3.9668 7.78198 3.9668Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.233 13.2951C13.748 12.9161 14.084 12.3111 14.084 11.6221C14.084 10.4701 13.151 9.53711 11.999 9.53711C10.848 9.53711 9.91406 10.4701 9.91406 11.6221C9.91406 12.3111 10.252 12.9161 10.767 13.2951L10.121 15.2381C9.93103 15.8101 10.357 16.4011 10.959 16.4011H13.04C13.643 16.4011 14.0691 15.8101 13.8781 15.2381L13.233 13.2951Z" stroke="currentColor"></path>
<path d="M12.001 16.3988V21.9668M12 9.53479L12.001 3.9668L12 9.53479Z" stroke="currentColor"></path>
    </svg>
  ),
)

SquareLock2.displayName = 'SquareLock2'

export default SquareLock2
