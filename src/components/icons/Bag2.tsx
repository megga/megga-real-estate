// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bag2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M16.7226 7.18852C16.7226 4.89436 14.8628 3.03458 12.5686 3.03458C11.4639 3.0299 10.4028 3.46548 9.61997 4.245C8.83715 5.02452 8.39708 6.08377 8.39709 7.18852" stroke="currentColor" strokeLinecap="square"></path>
<path d="M15.4197 11.518H15.3757" stroke="currentColor" strokeLinecap="square"></path>
<path d="M9.81226 11.518H9.76825" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.1216 7.39954L21.0101 22.0347L3.48987 22.0347L4.37845 7.39954L20.1216 7.39954Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Bag2.displayName = 'Bag2'

export default Bag2
