// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SavingsPig = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.90033 3.76599L8.87145 4.42267C11.3616 3.51584 14.3279 3.40931 16.715 4.67878C20.9429 6.73074 22.2646 12.2085 19.4229 15.8655C18.5818 16.8361 19.516 18.6067 18.4724 19.5439C17.6795 20.2559 16.765 20.4463 15.8101 20.1757C15.1332 19.9274 14.5834 19.119 13.8113 19.1283C12.89 19.1358 12.163 19.063 11.2417 19.1283C10.6813 19.1681 10.0367 19.8843 9.45673 20.1195C8.4217 20.4686 7.14849 20.2689 6.57223 19.3075C6.25185 18.6094 6.44675 17.2972 6.07377 16.4479C5.4341 15.3895 4.0914 15.7748 3.47971 14.7164C3.05064 13.3619 2.82753 11.0811 3.16076 9.71867C3.62699 9.09522 4.45734 8.70007 4.95482 8.30937C5.42604 7.38013 6.3302 6.45422 6.3302 6.45422L5.90033 3.76599Z" stroke="currentColor"></path>
<path d="M10.4277 7.36725C11.8749 6.56623 13.5154 6.56622 14.8683 7.36725" stroke="currentColor"></path>
    </svg>
  ),
)

SavingsPig.displayName = 'SavingsPig'

export default SavingsPig
