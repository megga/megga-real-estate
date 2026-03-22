import { Link, useLocation, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { getContactById } from '@/lib/mockData'

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

export default function Breadcrumb() {
  const location = useLocation()
  const params = useParams()

  const pathParts = location.pathname.split('/').filter(Boolean)

  // Don't show breadcrumb on top-level dashboard pages (only 2 levels: /dashboard or /dashboard/contacts)
  if (pathParts.length <= 2) return null

  const segments: BreadcrumbSegment[] = []

  // Build segments from path parts, skipping "dashboard"
  let currentPath = ''
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i]
    currentPath += `/${part}`

    if (part === 'dashboard') continue

    // Check if this is a dynamic param (contact ID, etc.)
    if (params.id && part === params.id) {
      // Try to resolve the entity name
      const parentPart = pathParts[i - 1]
      if (parentPart === 'contacts') {
        const contact = getContactById(part)
        if (contact) {
          segments.push({ label: `${contact.first_name} ${contact.last_name}`, path: currentPath })
          continue
        }
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
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-theme-tertiary flex-shrink-0" />}
            {isLast ? (
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
