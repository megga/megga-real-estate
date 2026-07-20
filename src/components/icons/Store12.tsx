// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store12 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.5 8.71512C7.5 9.88755 6.54941 10.8384 5.37697 10.8384H5.12303C3.95059 10.8384 3 9.88784 3 8.7154V5.37129C3 4.09962 4.03135 3.06827 5.30303 3.06827H18.697C19.9686 3.06827 21 4.09962 21 5.37129V8.7154C21 9.88784 20.0494 10.8384 18.877 10.8384H18.623C17.4506 10.8384 16.5 9.88755 16.5 8.71512" stroke="currentColor"></path>
<path d="M12 8.71533C12 9.88776 11.0494 10.8384 9.87697 10.8384H9.62303C8.45059 10.8384 7.5 9.88776 7.5 8.71533" stroke="currentColor"></path>
<path d="M12 8.71533C12 9.88776 12.9506 10.8384 14.123 10.8384H14.377C15.5494 10.8384 16.5 9.88776 16.5 8.71533" stroke="currentColor"></path>
<path d="M3.88672 10.5512V18.0285C3.8945 19.6398 5.20704 20.9397 6.81926 20.9319H16.9946C18.6059 20.9416 19.9203 19.6427 19.9291 18.0305V10.5435" stroke="currentColor"></path>
<path d="M7.5 14.6423V15.9393" stroke="currentColor"></path>
<path d="M15.9524 20.9316V14.6423H11.9067V20.9316" stroke="currentColor"></path>
    </svg>
  ),
)

Store12.displayName = 'Store12'

export default Store12
