import { NavLink, Outlet } from 'react-router-dom'
import { FileText, MessageCircle, User, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

const tabs = [
  { label: 'Mon dossier', path: '/portal', icon: FolderOpen, end: true },
  { label: 'Documents', path: '/portal/documents', icon: FileText },
  { label: 'Messages', path: '/portal/messages', icon: MessageCircle },
  { label: 'Profil', path: '/portal/profil', icon: User },
]

export default function ParticulierLayout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      {/* Tab navigation */}
      <div className="border-b border-border bg-white sticky top-16 z-40">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      isActive
                        ? 'border-accent text-accent'
                        : 'border-transparent text-gray-500 hover:text-primary-900 hover:border-gray-300'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Page content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  )
}
