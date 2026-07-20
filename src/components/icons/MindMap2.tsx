// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MindMap2 = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M13.5884 6.11814C13.5884 4.94859 14.5365 4.00049 15.706 4.00049H18.8825C20.052 4.00049 21.0001 4.94859 21.0001 6.11814C21.0001 7.28768 20.052 8.23578 18.8825 8.23578H15.706C14.5365 8.23578 13.5884 7.28768 13.5884 6.11814Z" stroke="currentColor"></path>
<path d="M13.5884 18.824C13.5884 17.6545 14.5365 16.7064 15.706 16.7064H18.8825C20.052 16.7064 21.0001 17.6545 21.0001 18.824C21.0001 19.9936 20.052 20.9417 18.8825 20.9417H15.706C14.5365 20.9417 13.5884 19.9936 13.5884 18.824Z" stroke="currentColor"></path>
<path d="M3 12.4711C3 11.3015 3.9481 10.3534 5.11765 10.3534H8.29412C9.46366 10.3534 10.4118 11.3015 10.4118 12.4711C10.4118 13.6406 9.46366 14.5887 8.29412 14.5887H5.11765C3.9481 14.5887 3 13.6406 3 12.4711Z" stroke="currentColor"></path>
<path d="M7.76465 10.3534V9.2946C7.76465 7.54029 9.1868 6.11813 10.9411 6.11813H13.5882" stroke="currentColor"></path>
<path d="M7.76465 14.5887V15.6476C7.76465 17.4019 9.1868 18.824 10.9411 18.824H13.5882" stroke="currentColor"></path>
    </svg>
  ),
)

MindMap2.displayName = 'MindMap2'

export default MindMap2
