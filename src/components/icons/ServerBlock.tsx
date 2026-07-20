// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerBlock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9998 11.3519V7.78212C20.9998 4.84279 18.9187 3 15.9735 3H8.02633C5.08117 3 3 4.83404 3 7.78212V16.2158C3 19.1648 5.08117 20.9998 8.02633 20.9998H11.1087" stroke="currentColor"></path>
<path d="M7.36328 16.1348H7.88576" stroke="currentColor"></path>
<path d="M7.36328 7.86523H7.88576M12.1017 7.86523H16.6357" stroke="currentColor"></path>
<path d="M12.2199 12H3.02344" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.0005 17.6311C21.0005 15.7708 19.4924 14.2627 17.6321 14.2627C15.7718 14.2627 14.2637 15.7708 14.2637 17.6311C14.2637 19.4914 15.7718 20.9995 17.6321 20.9995C19.4924 20.9995 21.0005 19.4914 21.0005 17.6311Z" stroke="currentColor"></path>
<path d="M20.0332 15.2666L15.2754 20.0341" stroke="currentColor"></path>
    </svg>
  ),
)

ServerBlock.displayName = 'ServerBlock'

export default ServerBlock
