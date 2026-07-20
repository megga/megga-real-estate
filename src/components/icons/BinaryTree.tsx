// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BinaryTree = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M8.3837 20.5049H5.3C4.30589 20.5049 3.5 19.699 3.5 18.7049V17.8006C3.5 16.8065 4.30589 16.0006 5.3 16.0006H8.3837C9.37782 16.0006 10.1837 16.8065 10.1837 17.8006V18.7049C10.1837 19.699 9.37782 20.5049 8.3837 20.5049Z" stroke="currentColor"></path>
<path d="M18.7001 20.5049H15.6164C14.6223 20.5049 13.8164 19.699 13.8164 18.7049V17.8006C13.8164 16.8065 14.6223 16.0006 15.6164 16.0006H18.7001C19.6942 16.0006 20.5001 16.8065 20.5001 17.8006V18.7049C20.5001 19.699 19.6942 20.5049 18.7001 20.5049Z" stroke="currentColor"></path>
<path d="M13.6147 8.00049H10.531C9.53684 8.00049 8.73096 7.1946 8.73096 6.20049V5.29625C8.73096 4.30214 9.53685 3.49625 10.531 3.49625H13.6147C14.6088 3.49625 15.4147 4.30214 15.4147 5.29625V6.20049C15.4147 7.1946 14.6088 8.00049 13.6147 8.00049Z" stroke="currentColor"></path>
<path d="M12 11.0481V8.00049M12 11.0481L6.7168 16.0005M12 11.0481L17.2833 16.0005" stroke="currentColor"></path>
    </svg>
  ),
)

BinaryTree.displayName = 'BinaryTree'

export default BinaryTree
