// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MindMap4 = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="11.9815" cy="11.8301" r="2.73488" stroke="currentColor"></circle>
<circle cx="1.43" cy="1.43" r="1.43" transform="matrix(1 0 0 -1 10.5703 21.0005)" stroke="currentColor"></circle>
<path d="M12.0029 18.1406L12.0029 14.9058" stroke="currentColor"></path>
<circle cx="12.0003" cy="4.43049" r="1.43" stroke="currentColor"></circle>
<path d="M12.0029 5.86035L12.0029 9.09522" stroke="currentColor"></path>
<circle cx="1.43" cy="1.43" r="1.43" transform="matrix(0.5 0.866025 0.866025 -0.5 3.49072 15.2617)" stroke="currentColor"></circle>
<path d="M6.68408 15.0732L9.48556 13.4558" stroke="currentColor"></path>
<circle cx="18.5557" cy="8.21514" r="1.43" transform="rotate(60 18.5557 8.21514)" stroke="currentColor"></circle>
<path d="M17.3188 8.93262L14.5174 10.5501" stroke="currentColor"></path>
<circle cx="5.44414" cy="8.21535" r="1.43" transform="rotate(-60 5.44414 8.21535)" stroke="currentColor"></circle>
<path d="M6.68408 8.92773L9.48556 10.5452" stroke="currentColor"></path>
<circle cx="1.43" cy="1.43" r="1.43" transform="matrix(0.5 -0.866025 -0.866025 -0.5 19.0791 17.7388)" stroke="currentColor"></circle>
<path d="M17.3188 15.0679L14.5174 13.4504" stroke="currentColor"></path>
    </svg>
  ),
)

MindMap4.displayName = 'MindMap4'

export default MindMap4
