import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown } from 'lucide-react'
import EmptyMessagesIllustration from '@/components/illustrations/EmptyMessagesIllustration'
import { cn } from '@/lib/utils'
import { useMessaging } from '@/hooks/useMessaging'
import { useContacts } from '@/hooks/useContacts'
import { useAuth } from '@/hooks/useAuth'
import { useCopilotContext } from '@/hooks/useCopilotContext'
import ChatThreadList, { AI_THREAD_ID } from '@/components/chat/ChatThreadList'
import AiChatPane from '@/components/chat/AiChatPane'
import ContactChatPane from '@/components/chat/ContactChatPane'

// ── Compose Modal ───────────────────────────────────────────────────────────

type ComposeContact = { id: string; name: string; type: string }

function ComposeModal({ onClose, onSend, contacts }: { onClose: () => void; onSend: (contactName: string, message: string) => void; contacts: ComposeContact[] }) {
  const [contactId, setContactId] = useState('')
  const [message, setMessage] = useState('')
  const selectedContact = contacts.find(c => c.id === contactId)
  const isValid = contactId && message.trim()

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="compose-title" onClick={onClose}>
      <div className="bg-theme-card border border-theme-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 id="compose-title" className="text-base font-semibold text-theme-primary">Nouveau message</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Destinataire</label>
            <div className="relative">
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none"
              >
                <option value="">Sélectionner un contact...</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Écrire votre message..."
              className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none placeholder:text-theme-tertiary"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">Annuler</button>
          <button
            onClick={() => { if (selectedContact && message.trim()) { onSend(selectedContact.name, message.trim()); onClose() } }}
            disabled={!isValid}
            className={cn(
              'h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors',
              !isValid && 'opacity-50 cursor-not-allowed'
            )}
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Chat Page ───────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { profile } = useAuth()
  const { setActiveContact } = useCopilotContext()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(AI_THREAD_ID)
  const [showCompose, setShowCompose] = useState(false)
  const [archivedThreadIds, setArchivedThreadIds] = useState<Set<string>>(new Set())
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null)

  // Only fetch messages for contact threads (not AI)
  const contactThreadId = selectedThreadId && selectedThreadId !== AI_THREAD_ID ? selectedThreadId : null
  const { threads, messages: threadMessages, sendMessage, isSending, markAsRead } = useMessaging(contactThreadId)
  const { contacts: rawContacts } = useContacts()

  const composeContacts = rawContacts.map(c => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' '),
    type: c.type,
  }))

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null

  // Get last AI message for thread list preview
  const aiLastMessage = useMemo(() => {
    try {
      const saved = localStorage.getItem('megga-copilot-history')
      if (saved) {
        const msgs = JSON.parse(saved) as { role: string; content: string }[]
        const lastAssistant = msgs.filter(m => m.role === 'assistant').pop()
        if (lastAssistant) return lastAssistant.content.slice(0, 60) + (lastAssistant.content.length > 60 ? '...' : '')
      }
    } catch { /* ignore */ }
    return undefined
  }, [selectedThreadId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Context handoff: when switching from a contact thread to AI, inject that contact's context
  function handleSelectThread(threadId: string) {
    // If switching to AI from a contact thread, inject that contact's context
    if (threadId === AI_THREAD_ID && selectedThread?.contact_id) {
      const contact = rawContacts.find(c => c.id === selectedThread.contact_id)
      if (contact) {
        setActiveContact({
          id: contact.id,
          firstName: contact.first_name ?? '',
          lastName: contact.last_name ?? '',
          type: contact.type ?? 'buyer',
          email: contact.email ?? undefined,
          phone: contact.phone ?? undefined,
        })
      }
    }

    setSelectedThreadId(threadId)

    // Mark as read if selecting a contact thread
    if (threadId !== AI_THREAD_ID) {
      markAsRead()
    }
  }

  function toggleArchive(threadId: string) {
    setArchivedThreadIds(prev => {
      const next = new Set(prev)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      return next
    })
  }

  const isAiSelected = selectedThreadId === AI_THREAD_ID
  const showMobileList = selectedThreadId === null

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 -mb-20 md:-mb-4 flex h-dvh overflow-hidden">

      {/* Thread list (left) — flush, no rounded */}
      <div className={cn(
        'w-full md:w-72 flex-shrink-0 bg-theme-page border-r border-theme-border',
        !showMobileList && selectedThreadId !== null ? 'hidden md:flex md:flex-col' : 'flex flex-col'
      )}>
        <ChatThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
          onCompose={() => setShowCompose(true)}
          archivedThreadIds={archivedThreadIds}
          onArchive={toggleArchive}
          aiLastMessage={aiLastMessage}
        />
      </div>

      {/* Conversation pane (right) — full-width, page bg */}
      <div className={cn(
        'flex-1 min-w-0',
        selectedThreadId === null ? 'hidden md:flex md:flex-col' : 'flex flex-col'
      )}>
        {isAiSelected ? (
          <AiChatPane pendingPrompt={pendingAiPrompt} onPromptConsumed={() => setPendingAiPrompt(null)} />
        ) : selectedThread ? (
          <ContactChatPane
            thread={selectedThread}
            messages={threadMessages}
            threads={threads}
            onSendMessage={sendMessage}
            isSending={isSending}
            agentName={profile?.full_name ?? 'Agent'}
            onBack={() => setSelectedThreadId(null)}
            onArchive={toggleArchive}
            isArchived={archivedThreadIds.has(selectedThread.id)}
            onSwitchToAi={(prompt?: string) => {
              // Inject contact context
              if (selectedThread?.contact_id) {
                const contact = rawContacts.find(c => c.id === selectedThread.contact_id)
                if (contact) {
                  setActiveContact({
                    id: contact.id,
                    firstName: contact.first_name ?? '',
                    lastName: contact.last_name ?? '',
                    type: contact.type ?? 'buyer',
                    email: contact.email ?? undefined,
                    phone: contact.phone ?? undefined,
                  })
                }
              }
              if (prompt) setPendingAiPrompt(prompt)
              setSelectedThreadId(AI_THREAD_ID)
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-theme-page">
            <div className="w-40 h-28"><EmptyMessagesIllustration /></div>
            <p className="text-theme-muted text-sm">Sélectionnez une conversation</p>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          contacts={composeContacts}
          onClose={() => setShowCompose(false)}
          onSend={() => { /* Future: create thread */ }}
        />
      )}
    </div>
  )
}
