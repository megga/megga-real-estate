import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ThemeProvider } from '@/hooks/useTheme'
import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CommandPalette from '@/components/layout/CommandPalette'
import NewContactDialog from '@/components/contacts/NewContactDialog'

/**
 * HybridLayout — shows sidebar when agent is logged in, navbar+footer when not.
 * Used for pages that are both public AND useful to agents (e.g., agent directory).
 */
interface HybridLayoutProps {
  children: ReactNode
  /** If true, no padding is applied to the main content (for full-width pages like directory) */
  noPadding?: boolean
}

function AgentLayoutWrapper({ children, noPadding }: HybridLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [quickContactOpen, setQuickContactOpen] = useState(false)

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), [])
  const openQuickContact = useCallback(() => setQuickContactOpen(true), [])
  const closeQuickContact = useCallback(() => setQuickContactOpen(false), [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setQuickContactOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden bg-theme-section isolate">
        <Sidebar
          mobileOpen={mobileOpen}
          collapsed={sidebarCollapsed}
          onClose={() => setMobileOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
          onOpenCommandPalette={openCommandPalette}
          onQuickContact={openQuickContact}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <header className="md:hidden h-14 bg-theme-card border-b border-theme-border flex items-center px-4 sticky top-0 z-30">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-theme-hover"
            >
              <Menu className="h-5 w-5 text-theme-secondary" />
            </button>
            <div className="ml-3 flex items-center gap-2">
              <div className="h-6 w-6 bg-theme-primary rounded flex items-center justify-center">
                <span className="text-[9px] font-bold text-theme-inverse">GG</span>
              </div>
              <span className="text-sm font-bold text-theme-primary">MEGGA</span>
            </div>
          </header>

          {/* Page content */}
          <main className={noPadding ? 'flex-1 overflow-y-auto' : 'flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto'}>
            {children}
          </main>
        </div>

        <CommandPalette isOpen={commandPaletteOpen} onClose={closeCommandPalette} onCreateContact={() => { closeCommandPalette(); openQuickContact() }} />
        <NewContactDialog open={quickContactOpen} onClose={closeQuickContact} />
      </div>
    </ThemeProvider>
  )
}

function PublicLayoutWrapper({ children }: HybridLayoutProps) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}

export default function HybridLayout({ children, noPadding }: HybridLayoutProps) {
  const { isAgent, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (isAgent) {
    return <AgentLayoutWrapper noPadding={noPadding}>{children}</AgentLayoutWrapper>
  }

  return <PublicLayoutWrapper>{children}</PublicLayoutWrapper>
}
