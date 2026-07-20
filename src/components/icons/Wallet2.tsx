// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Wallet2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M21.8806 16.7095H17.8064C16.3104 16.7087 15.0978 15.6057 15.0969 14.2438C15.0969 12.8819 16.3104 11.7789 17.8064 11.7781H21.8806" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M2.61938 5.72595H21.8807V21.25H2.61938V5.72595Z" stroke="currentColor"></path>
<path d="M19.2486 5.628V2.75074L2.61938 2.75V21.2495" stroke="currentColor"></path>
<path d="M7.18384 10.2938H12.6174" stroke="currentColor"></path>
    </svg>
  ),
)

Wallet2.displayName = 'Wallet2'

export default Wallet2
