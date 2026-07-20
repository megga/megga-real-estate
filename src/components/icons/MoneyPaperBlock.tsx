// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperBlock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.4116 18.8758H6.18941C4.22303 18.8758 3 17.4864 3 15.52V8.11085C3 6.14545 4.22303 4.75604 6.18843 4.75604H17.8116C19.7711 4.75604 21 6.14545 21 8.11085V10.1123" stroke="currentColor"></path>
<path d="M6.21289 8.26172H7.61592" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.71094 11.8158C9.71094 10.5499 10.7355 9.52441 11.9984 9.52441C13.2623 9.52441 14.2868 10.5499 14.2868 11.8158C14.2868 13.0806 13.2623 14.1071 11.9984 14.1071C10.7355 14.1071 9.71094 13.0806 9.71094 11.8158Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.375 16.4526C15.375 14.9114 16.6224 13.6621 18.1616 13.6621C19.7008 13.6621 20.9492 14.9114 20.9492 16.4526C20.9492 17.9938 19.7008 19.2441 18.1616 19.2441C16.6224 19.2441 15.375 17.9938 15.375 16.4526Z" stroke="currentColor"></path>
<path d="M16.2461 14.5332L20.0786 18.3706" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperBlock.displayName = 'MoneyPaperBlock'

export default MoneyPaperBlock
