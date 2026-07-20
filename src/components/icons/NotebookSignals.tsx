// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const NotebookSignals = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.6857 17.1645V6.83643C20.7003 4.78054 19.0823 3.08368 17.0293 3.00098C17.0293 3.00098 8.56638 3.00098 8.53621 3.00195C6.46379 3.04671 4.82044 4.764 4.86617 6.83643V17.3435C4.91481 19.3829 6.58638 21.0087 8.6267 21.0009L17.0157 21C19.0881 20.9542 20.7305 19.237 20.6857 17.1645Z" stroke="currentColor"></path>
<path d="M3.31445 16.698H6.37427M3.31445 11.9994H6.37427M3.31445 7.30176H6.37427" stroke="currentColor"></path>
<path d="M17.397 17.1096V12.6836" stroke="currentColor"></path>
<path d="M12.0479 17.1092V12.9359" stroke="currentColor"></path>
<path d="M14.7225 17.1095V15.2685" stroke="currentColor"></path>
<path d="M9.2953 17.1095V15.2685" stroke="currentColor"></path>
<path d="M9.07715 10.589L11.7443 7.72201L14.7872 9.69795L17.3968 6.91064" stroke="currentColor"></path>
    </svg>
  ),
)

NotebookSignals.displayName = 'NotebookSignals'

export default NotebookSignals
