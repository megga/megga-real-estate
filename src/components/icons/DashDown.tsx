// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DashDown = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.54883 20.3984H8.5585C9.1782 20.6556 9.83561 20.8374 10.5124 20.9418" stroke="currentColor"></path>
<path d="M6.10815 18.9108C5.6789 18.5579 5.27866 18.1577 4.92578 17.7188" stroke="currentColor"></path>
<path d="M3.48629 15.2414C3.26683 14.6691 3.09571 14.0591 3 13.4297" stroke="currentColor"></path>
<path d="M3.54333 8.60547C3.28617 9.22517 3.10441 9.88258 3 10.569" stroke="currentColor"></path>
<path d="M6.22319 4.97266C5.78427 5.3352 5.38403 5.72578 5.02148 6.15503" stroke="currentColor"></path>
<path d="M10.5129 3.05859C9.89321 3.1543 9.28317 3.31672 8.70117 3.54488" stroke="currentColor"></path>
<path d="M13.373 3.05859C14.0498 3.16397 14.7082 3.34476 15.3279 3.60192C16.2241 3.9548 17.0526 4.46042 17.7777 5.08013C18.2166 5.4417 18.6169 5.84292 18.9697 6.28087C19.5701 7.01562 20.0564 7.84512 20.3996 8.75002C20.6287 9.33202 20.7902 9.94206 20.8859 10.5714C20.9623 11.0384 21 11.515 21 12.0013C21 12.4876 20.9623 12.9642 20.8859 13.4312C20.7805 14.1176 20.5997 14.7566 20.3426 15.3763V15.386C19.9897 16.2822 19.4841 17.102 18.8644 17.8261C18.5115 18.2651 18.1016 18.6653 17.6636 19.0182C16.9289 19.6185 16.0897 20.1145 15.1848 20.4577C14.6028 20.6772 13.9928 20.8483 13.373 20.944" stroke="currentColor"></path>
<path d="M11.9974 15.4679V8.53125M11.9974 15.4679L14.704 12.7522M11.9974 15.4679L9.29297 12.7522" stroke="currentColor"></path>
    </svg>
  ),
)

DashDown.displayName = 'DashDown'

export default DashDown
