// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Tools = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.4006 16.1453L16.2986 10.2473C17.4466 9.09932 17.4466 7.23845 16.2986 6.09049L14.0828 3.87465C12.9348 2.72668 11.074 2.72668 9.926 3.87465L4.02797 9.77268C2.88 10.9206 2.88 12.7815 4.02797 13.9295L6.24381 16.1453C7.39177 17.2933 9.25264 17.2933 10.4006 16.1453Z" stroke="currentColor"></path>
<path d="M3 20.9863H7.37137" stroke="currentColor"></path>
<path d="M16.8076 6.76172H7.03852M16.293 10.262H3.63672M12.7829 13.7623H3.88391" stroke="currentColor"></path>
<path d="M15.1817 11.627L20.44 16.8852C21.1855 17.6308 21.1855 18.8401 20.44 19.5856L19.7379 20.2876C18.9924 21.0331 17.7831 21.0331 17.0376 20.2876L11.7793 15.0293" stroke="currentColor"></path>
<path d="M16.1406 19.1583L19.3106 15.9883" stroke="currentColor"></path>
    </svg>
  ),
)

Tools.displayName = 'Tools'

export default Tools
