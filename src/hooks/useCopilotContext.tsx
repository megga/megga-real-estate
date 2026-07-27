/**
 * Contexte React partageant l'état ambiant du copilote (page courante, contact
 * actif) pour que MEGGA AI dispose du contexte de navigation sans prop drilling.
 */
import { createContext, useState, useCallback, type ReactNode } from 'react'

interface ContactContext {
  id: string
  firstName: string
  lastName: string
  type: string
  email?: string
  phone?: string
}

interface CopilotContextValue {
  currentPage: string
  activeContact: ContactContext | null
  setCurrentPage: (page: string) => void
  setActiveContact: (contact: ContactContext | null) => void
}

const CopilotContext = createContext<CopilotContextValue>({
  currentPage: 'dashboard',
  activeContact: null,
  setCurrentPage: () => {},
  setActiveContact: () => {},
})

/** Provider du contexte copilote — à monter au-dessus du shell CRM. */
export function CopilotContextProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [activeContact, setActiveContact] = useState<ContactContext | null>(null)

  const handleSetCurrentPage = useCallback((page: string) => {
    setCurrentPage(page)
  }, [])

  const handleSetActiveContact = useCallback((contact: ContactContext | null) => {
    setActiveContact(contact)
  }, [])

  return (
    <CopilotContext.Provider
      value={{
        currentPage,
        activeContact,
        setCurrentPage: handleSetCurrentPage,
        setActiveContact: handleSetActiveContact,
      }}
    >
      {children}
    </CopilotContext.Provider>
  )
}
