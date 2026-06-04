import { Link, useLocation, useParams } from 'react-router-dom'
import MEIcon from '@/components/propertyx/MEIcon'
import { useContact } from '@/hooks/useContacts'

interface BreadcrumbSegment {
  label: string
  path: string
}

const routeLabels: Record<string, string> = {
  dashboard: "Aujourd'hui",
  analytics: 'Dashboard',
  contacts: 'Contacts',
  pipeline: 'Pipeline',
  matching: 'Matching',
  listings: 'Mes biens',
  messages: 'Messages',
  calendar: 'Calendrier',
  kyc: 'KYC',
  documents: 'Documents',
  automation: 'Automatisation',
  settings: 'Paramètres',
  new: 'Nouveau',
}

// Inner component that can call hooks conditionally
function ContactBreadcrumb({ id, path, isLast }: { id: string; path: string; isLast: boolean }) {
  const { data: contact } = useContact(id)
  const label = contact ? `${contact.first_name} ${contact.last_name}` : id

  return isLast ? (
    <span className="text-theme-primary font-medium truncate max-w-[200px]">{label}</span>
  ) : (
    <Link to={path} className="hover:text-theme-secondary transition-colors duration-150 truncate max-w-[200px]">
      {label}
    </Link>
  )
}

export default function Breadcrumb() {
  const location = useLocation()
  const params = useParams()

  const pathParts = location.pathname.split('/').filter(Boolean)

  if (pathParts.length <= 2) return null

  const segments: (BreadcrumbSegment & { isContactId?: boolean })[] = []

  let currentPath = ''
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i]
    currentPath += `/${part}`

    if (part === 'dashboard') continue

    if (params.id && part === params.id) {
      const parentPart = pathParts[i - 1]
      if (parentPart === 'contacts') {
        segments.push({ label: part, path: currentPath, isContactId: true })
        continue
      }
      segments.push({ label: part, path: currentPath })
      continue
    }

    const label = routeLabels[part] || part
    segments.push({ label, path: currentPath })
  }

  if (segments.length === 0) return null

  return (
    <nav className="hidden md:flex items-center gap-1.5 text-sm text-theme-tertiary mb-4">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1
        return (
          <div key={segment.path} className="flex items-center gap-1.5">
            {i > 0 && <MEIcon name="chevron-right" className="w-3.5 h-3.5 text-theme-tertiary flex-shrink-0" />}
            {segment.isContactId ? (
              <ContactBreadcrumb id={segment.label} path={segment.path} isLast={isLast} />
            ) : isLast ? (
              <span className="text-theme-primary font-medium truncate max-w-[200px]">{segment.label}</span>
            ) : (
              <Link
                to={segment.path}
                className="hover:text-theme-secondary transition-colors duration-150 truncate max-w-[200px]"
              >
                {segment.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
