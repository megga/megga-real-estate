// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DashUp = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.10818 18.9108C5.67892 18.5579 5.27866 18.1577 4.92578 17.7188" stroke="currentColor"></path>
<path d="M3.4863 15.2415C3.26684 14.6691 3.09571 14.0591 3 13.4297" stroke="currentColor"></path>
<path d="M3.54334 8.60547C3.28617 9.22519 3.10441 9.88262 3 10.569" stroke="currentColor"></path>
<path d="M6.22322 4.97266C5.78429 5.33521 5.38404 5.7258 5.02148 6.15506" stroke="currentColor"></path>
<path d="M8.54883 20.4009H8.5585C9.17822 20.6581 9.83564 20.8399 10.5124 20.9443M10.5131 3.05859C9.89338 3.15431 9.28332 3.31673 8.70131 3.5449" stroke="currentColor"></path>
<path d="M13.373 3.05859C14.0498 3.16398 14.7082 3.34477 15.3279 3.60194C16.2242 3.95482 17.0527 4.46046 17.7778 5.08018C18.2167 5.44177 18.617 5.84299 18.9699 6.28095C19.5703 7.01572 20.0566 7.84524 20.3998 8.75017C20.6289 9.33219 20.7904 9.94224 20.8861 10.5716C20.9625 11.0386 21.0002 11.5152 21.0002 12.0015C21.0002 12.4878 20.9625 12.9645 20.8861 13.4314C20.7807 14.1179 20.5999 14.7569 20.3427 15.3766V15.3863C19.9899 16.2825 19.4842 17.1024 18.8645 17.8265C18.5116 18.2655 18.1017 18.6657 17.6637 19.0186C16.929 19.619 16.0898 20.115 15.1848 20.4582C14.6028 20.6776 13.9928 20.8488 13.373 20.9445" stroke="currentColor"></path>
<path d="M11.9998 8.53125V15.4681M11.9998 8.53125L9.29297 11.247M11.9998 8.53125L14.7042 11.247" stroke="currentColor"></path>
    </svg>
  ),
)

DashUp.displayName = 'DashUp'

export default DashUp
