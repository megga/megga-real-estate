// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldFail3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.9852 21.6057C14.3192 21.6057 19.6572 19.2837 19.6572 12.8787C19.6572 6.47473 19.9352 5.97373 19.3192 5.35773C18.7032 4.74173 15.4942 2.75073 11.9852 2.75073C8.4762 2.75073 5.2662 4.74173 4.6502 5.35773C4.0342 5.97373 4.3122 6.47473 4.3122 12.8787C4.3122 19.2837 9.6502 21.6057 11.9852 21.6057Z" stroke="currentColor"></path>
<path d="M13.8641 13.8245L10.1051 10.0665" stroke="currentColor"></path>
<path d="M10.1053 13.8245L13.8643 10.0665" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldFail3.displayName = 'ShieldFail3'

export default ShieldFail3
