// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FolderShield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.641 21.2709C18.997 21.2709 20.974 19.2929 20.974 15.9379L21 11.2829C21 7.8599 19.759 6.14685 16.395 6.14685H13.742C13.069 6.14585 12.435 5.82889 12.03 5.29089L11.173 4.15289C10.77 3.61489 10.136 3.29688 9.46399 3.29688H7.58798C4.23198 3.29688 3 5.2749 3 8.6239V15.9379C3 19.2929 4.98097 21.2709 8.34497 21.2709H15.641Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.001 16.7658C12.001 16.7658 14.665 15.9599 14.665 13.7379C14.665 11.5139 14.761 11.5858 14.547 11.3698C14.333 11.1538 12.351 10.4648 12.001 10.4648C11.652 10.4648 9.66898 11.1558 9.45498 11.3698C9.24198 11.5838 9.33798 11.5139 9.33798 13.7379C9.33798 15.9609 12.001 16.7658 12.001 16.7658Z" stroke="currentColor"></path>
    </svg>
  ),
)

FolderShield.displayName = 'FolderShield'

export default FolderShield
