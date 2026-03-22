import { NavLink, Outlet } from 'react-router-dom'
import { Home, Eye, HandCoins, FileText, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

const tabs = [
  { label: 'Mon bien', path: '/portail', icon: Home, end: true },
  { label: 'Visites', path: '/portail/visites', icon: Eye },
  { label: 'Offres', path: '/portail/offres', icon: HandCoins },
  { label: 'Documents', path: '/portail/documents', icon: FileText },
  { label: 'Messages', path: '/portail/messages', icon: MessageCircle },
]

export default function ParticulierLayout() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />

      {/* Tab navigation */}
      <div className="border-b border-gray-200 bg-white sticky top-16 z-40">
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
                        ? 'border-[#1A1A1A] text-[#1A1A1A]'
                        : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
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
