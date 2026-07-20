// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Tools2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M16.2986 10.2473L10.4006 16.1453C9.25264 17.2933 7.39177 17.2933 6.24381 16.1453L4.02797 13.9295C2.88 12.7815 2.88 10.9206 4.02797 9.77268L9.926 3.87465C11.074 2.72668 12.9348 2.72668 14.0828 3.87465L16.2986 6.09049C17.4466 7.23845 17.4466 9.09932 16.2986 10.2473Z" stroke="currentColor"></path>
<path d="M3 20.9863H7.37137" stroke="currentColor"></path>
<path d="M15.1817 11.627L20.44 16.8852C21.1855 17.6308 21.1855 18.8401 20.44 19.5856L19.7379 20.2876C18.9924 21.0331 17.7831 21.0331 17.0376 20.2876L11.7793 15.0293" stroke="currentColor"></path>
    </svg>
  ),
)

Tools2.displayName = 'Tools2'

export default Tools2
