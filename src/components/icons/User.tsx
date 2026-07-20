// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/2-User" stroke="none" fill="none" fillRule="evenodd"> <g id="2-User" transform="translate(2.000000, 2.500000)" stroke="currentColor"> <path d="M7.5915,12.7068 C11.2805,12.7068 14.4335,13.2658 14.4335,15.4988 C14.4335,17.7318 11.3015,18.3068 7.5915,18.3068 C3.9015,18.3068 0.7495,17.7528 0.7495,15.5188 C0.7495,13.2848 3.8805,12.7068 7.5915,12.7068 Z" id="Stroke-1"></path> <path d="M7.5915,9.5198 C5.1695,9.5198 3.2055,7.5568 3.2055,5.1348 C3.2055,2.7128 5.1695,0.7498 7.5915,0.7498 C10.0125,0.7498 11.976531,2.7128 11.976531,5.1348 C11.9855,7.5478 10.0355,9.5108 7.6225,9.5198 L7.5915,9.5198 Z" id="Stroke-3"></path> <path d="M14.4831,8.3816 C16.0841,8.1566 17.3171,6.7826 17.3201,5.1196 C17.3201,3.4806 16.1251,2.1206 14.5581,1.8636" id="Stroke-5"></path> <path d="M16.5954,12.2322 C18.1464,12.4632 19.2294,13.0072 19.2294,14.1272 C19.2294,14.8982 18.7194,15.3982 17.8954,15.7112" id="Stroke-7"></path> </g> </g>
    </svg>
  ),
)

User.displayName = 'User'

export default User
