// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.8107 17.576H6.1904C4.22499 17.576 3.00293 16.1895 3.00293 14.226V6.82847C3.00293 4.86598 4.23083 3.47852 6.1904 3.47852H17.8116C19.777 3.47852 21.0001 4.86598 21.0001 6.82847V11.226" stroke="currentColor"></path>
<path d="M3 13.2019C4.16076 12.8244 5.49277 13.0939 6.41904 14.0212C7.38229 14.9834 7.63429 16.3787 7.19353 17.5755" stroke="currentColor"></path>
<path d="M7.18477 3.47424C7.64402 4.66225 7.38229 6.06625 6.42001 7.03728C5.49277 7.96453 4.16173 8.23405 3 7.85653" stroke="currentColor"></path>
<path d="M16.8135 3.47424C16.3543 4.66225 16.616 6.06625 17.587 7.03728C18.5143 7.96453 19.8278 8.23405 20.9983 7.85653" stroke="currentColor"></path>
<path d="M14.2898 10.5265C14.2898 9.26362 13.2652 8.23907 12.0023 8.23907C10.7394 8.23907 9.71484 9.26362 9.71484 10.5265C9.71484 11.7895 10.7394 12.814 12.0023 12.814" stroke="currentColor"></path>
<path d="M17.5 13.525C19.4324 13.525 21 15.0926 21 17.025C21 18.9573 19.4324 20.525 17.5 20.525C15.5676 20.525 14 18.9573 14 17.025C14 15.0926 15.5676 13.525 17.5 13.525Z" stroke="currentColor"></path>
<path d="M17.5 16.4421V17.6087" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperCircle.displayName = 'MoneyPaperCircle'

export default MoneyPaperCircle
