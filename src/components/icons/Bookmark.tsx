// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bookmark = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Bookmark" stroke="none" fill="none" fillRule="evenodd"> <g id="Bookmark" transform="translate(4.200000, 2.300000)" stroke="currentColor"> <path d="M15.5388471,3.85363409 C15.5388471,1.10275689 13.6581454,-2.13162821e-14 10.9503759,-2.13162821e-14 L4.5914787,-2.13162821e-14 C1.96691729,-2.13162821e-14 2.66453526e-15,1.02756892 2.66453526e-15,3.67017544 L2.66453526e-15,18.393985 C2.66453526e-15,19.1197995 0.780952381,19.5769424 1.41353383,19.2220551 L7.79548872,15.6421053 L14.1223058,19.2160401 C14.7558897,19.5729323 15.5388471,19.1157895 15.5388471,18.3889724 L15.5388471,3.85363409 Z" id="Stroke-1"></path> <line x1="4.071178" y1="6.72802013" x2="11.3894737" y2="6.72802013" id="Stroke-3"></line> </g> </g>
    </svg>
  ),
)

Bookmark.displayName = 'Bookmark'

export default Bookmark
