import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ArrowUp, Paperclip, X, Mic, StopCircle, User, Building2, Slash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContacts } from '@/hooks/useContacts'
import { useAgencyProperties } from '@/hooks/useProperties'
import { useCopilotContext } from '@/hooks/useCopilotContext'
import { formatCHF } from '@/lib/utils'

// ─── Slash Commands ──────────────────────────────────────────────────────────

const SLASH_COMMANDS = [
  { command: '/résumé', desc: 'Résumer un client ou le portefeuille', insert: 'Résume-moi ' },
  { command: '/relance', desc: 'Rédiger une relance email/message', insert: 'Rédige une relance pour ' },
  { command: '/matching', desc: 'Trouver des biens pour un client', insert: 'Quels biens proposer à ' },
  { command: '/analyse', desc: 'Analyser le marché ou un bien', insert: 'Analyse le marché pour ' },
  { command: '/mandat', desc: 'Préparer un mandat de vente', insert: 'Prépare un mandat pour ' },
  { command: '/actions', desc: 'Voir les prochaines actions', insert: 'Quelles sont les prochaines actions ?' },
  { command: '/kyc', desc: 'Vérifier la conformité d\'un client', insert: 'Vérifie le dossier KYC de ' },
  { command: '/offre', desc: 'Analyser ou rédiger une offre', insert: 'Analyse l\'offre pour ' },
] as const

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutocompleteItem {
  id: string
  label: string
  sub: string
  type: 'command' | 'contact' | 'property'
  insert: string
}

interface PromptInputBarProps {
  onSend: (message: string, files?: File[]) => void
  isLoading?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Initial text to pre-fill the input with (used for suggestion chips). */
  initialValue?: string
}

// ─── Autocomplete Dropdown ───────────────────────────────────────────────────

function AutocompleteDropdown({ items, selectedIndex, onSelect }: {
  items: AutocompleteItem[]
  selectedIndex: number
  onSelect: (item: AutocompleteItem) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (items.length === 0) return null

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-theme-border bg-theme-card overflow-hidden max-h-[240px] overflow-y-auto scrollbar-hide z-10"
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item) }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
            i === selectedIndex ? 'bg-theme-hover' : 'hover:bg-theme-hover/50'
          )}
        >
          <div className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold',
            item.type === 'command' ? 'bg-accent/10 text-accent' :
            item.type === 'contact' ? 'bg-theme-hover text-theme-secondary' :
            'bg-emerald-500/10 text-emerald-500'
          )}>
            {item.type === 'command' ? <Slash className="w-3.5 h-3.5" /> :
             item.type === 'contact' ? <User className="w-3.5 h-3.5" /> :
             <Building2 className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-theme-primary truncate">{item.label}</p>
            <p className="text-xs text-theme-muted truncate">{item.sub}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Context Pill ────────────────────────────────────────────────────────────

function ContextPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md bg-theme-hover text-xs text-theme-secondary">
      <User className="w-3 h-3 text-theme-muted" />
      <span className="truncate max-w-[140px]">{label}</span>
      <button onClick={onClear} aria-label="Retirer le contexte" className="h-4 w-4 rounded flex items-center justify-center hover:bg-theme-card transition-colors">
        <X className="w-2.5 h-2.5 text-theme-muted" />
      </button>
    </span>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PromptInputBar({
  onSend,
  isLoading = false,
  placeholder = 'Demandez-moi quelque chose...',
  disabled = false,
  className,
  initialValue = '',
}: PromptInputBarProps) {
  const [input, setInput] = useState(initialValue)
  const [files, setFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({})
  const [isRecording, setIsRecording] = useState(false)
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerPos, setTriggerPos] = useState(-1)
  const [fileSizeError, setFileSizeError] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { activeContact, setActiveContact } = useCopilotContext()
  const { contacts } = useContacts()
  const { data: properties } = useAgencyProperties()

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
  }, [input])

  // ─── Autocomplete logic ──────────────────────────────────────────────────

  const contactItems = useMemo<AutocompleteItem[]>(() =>
    (contacts || []).map(c => ({
      id: c.id,
      label: `${c.first_name} ${c.last_name}`,
      sub: c.type === 'buyer' ? 'Acheteur' : c.type === 'seller' ? 'Vendeur' : c.type,
      type: 'contact' as const,
      insert: `${c.first_name} ${c.last_name}`,
    })),
  [contacts])

  const propertyItems = useMemo<AutocompleteItem[]>(() =>
    (properties || []).map(p => ({
      id: p.id,
      label: p.title || p.address,
      sub: `${p.city} · ${formatCHF(p.price)}`,
      type: 'property' as const,
      insert: p.title || p.address,
    })),
  [properties])

  const commandItems = useMemo<AutocompleteItem[]>(() =>
    SLASH_COMMANDS.map(c => ({
      id: c.command,
      label: c.command,
      sub: c.desc,
      type: 'command' as const,
      insert: c.insert,
    })),
  [])

  // Detect trigger based on cursor position
  function detectAutocomplete() {
    const el = textareaRef.current
    if (!el) return
    const val = input
    const cursor = el.selectionStart ?? val.length

    // Slash commands: starts with /
    if (val.startsWith('/')) {
      const query = val.slice(1, cursor).toLowerCase()
      const filtered = commandItems.filter(c => c.label.toLowerCase().includes(query))
      setAutocompleteItems(filtered)
      setSelectedIndex(0)
      setTriggerPos(0)
      return
    }

    // Search backwards from cursor for @ or #
    const textBeforeCursor = val.slice(0, cursor)

    // @contact
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/)
    if (atMatch) {
      const query = atMatch[1].toLowerCase()
      const filtered = contactItems.filter(c => c.label.toLowerCase().includes(query)).slice(0, 8)
      setAutocompleteItems(filtered)
      setSelectedIndex(0)
      setTriggerPos(cursor - atMatch[0].length)
      return
    }

    // #property
    const hashMatch = textBeforeCursor.match(/#([^\s#]*)$/)
    if (hashMatch) {
      const query = hashMatch[1].toLowerCase()
      const filtered = propertyItems.filter(c => c.label.toLowerCase().includes(query)).slice(0, 8)
      setAutocompleteItems(filtered)
      setSelectedIndex(0)
      setTriggerPos(cursor - hashMatch[0].length)
      return
    }

    setAutocompleteItems([])
    setTriggerPos(-1)
  }

  // detectAutocomplete is called from handleChange, not from an effect

  // ─── Select autocomplete item ────────────────────────────────────────────

  const handleAutocompleteSelect = useCallback((item: AutocompleteItem) => {
    const rest = triggerPos >= 0 ? input.slice(0, triggerPos) : ''
    if (item.type === 'command') {
      setInput(item.insert)
    } else if (item.type === 'contact') {
      setInput(rest + item.insert + ' ')
      const contact = (contacts || []).find(c => c.id === item.id)
      if (contact) {
        setActiveContact({
          id: contact.id,
          firstName: contact.first_name,
          lastName: contact.last_name,
          type: contact.type,
          email: contact.email ?? undefined,
          phone: contact.phone ?? undefined,
        })
      }
    } else if (item.type === 'property') {
      setInput(rest + item.insert + ' ')
    }
    setAutocompleteItems([])
    setTriggerPos(-1)
    textareaRef.current?.focus()
  }, [input, triggerPos, contacts, setActiveContact])

  // ─── File handling ───────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setFileSizeError(true)
      setTimeout(() => setFileSizeError(false), 3000)
      return
    }
    setFileSizeError(false)
    setFiles([file])
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string })
      reader.readAsDataURL(file)
    } else {
      setFilePreviews({})
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles[0]) processFile(droppedFiles[0])
  }, [processFile])

  // Paste images
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) { e.preventDefault(); processFile(file); break }
        }
      }
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [processFile])

  // ─── Submit ──────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!input.trim() && files.length === 0) return
    onSend(input, files.length > 0 ? files : undefined)
    setInput('')
    setFiles([])
    setFilePreviews({})
    setAutocompleteItems([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Autocomplete navigation
    if (autocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % autocompleteItems.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + autocompleteItems.length) % autocompleteItems.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleAutocompleteSelect(autocompleteItems[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setAutocompleteItems([])
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const hasContent = input.trim() !== '' || files.length > 0

  return (
    <div className="relative">
      {/* Autocomplete dropdown */}
      <AutocompleteDropdown
        items={autocompleteItems}
        selectedIndex={selectedIndex}
        onSelect={handleAutocompleteSelect}
      />

      <div
        className={cn(
          'rounded-2xl border border-theme-border bg-theme-card p-2 transition-colors',
          'focus-within:border-accent/60',
          className
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Context pill + file preview */}
        {(activeContact || files.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 pb-1.5 px-1">
            {activeContact && (
              <ContextPill
                label={`${activeContact.firstName} ${activeContact.lastName}`}
                onClear={() => setActiveContact(null)}
              />
            )}
            {files.map((file, i) => (
              <div key={i} className="relative">
                {filePreviews[file.name] ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-theme-border">
                    <img src={filePreviews[file.name]} alt={file.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md bg-theme-hover text-xs text-theme-secondary">
                    <Paperclip className="h-3 w-3 text-theme-muted" />
                    <span className="truncate max-w-[100px]">{file.name}</span>
                  </span>
                )}
                <button
                  onClick={() => { setFiles([]); setFilePreviews({}) }}
                  aria-label="Retirer le fichier"
                  className="absolute -top-1 -right-1 rounded-full bg-theme-card border border-theme-border p-0.5"
                >
                  <X className="h-2.5 w-2.5 text-theme-muted" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* File size error */}
        {fileSizeError && (
          <p className="text-xs text-red-500 px-2 pb-1">Fichier trop volumineux (max 10 Mo)</p>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); requestAnimationFrame(detectAutocomplete) }}
          onKeyDown={handleKeyDown}
          placeholder={activeContact ? `Demandez à propos de ${activeContact.firstName}...` : placeholder}
          aria-label="Message"
          disabled={disabled || isLoading}
          rows={1}
          className="w-full bg-transparent px-2 py-1.5 text-sm text-theme-primary placeholder:text-theme-muted outline-none resize-none min-h-[36px] max-h-[120px] md:max-h-[200px] scrollbar-hide"
        />

        {/* Actions bar */}
        <div className="flex items-center justify-between pt-1">
          {/* Left: attach + hints */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Joindre un fichier"
              className="h-7 w-7 rounded-full flex items-center justify-center text-theme-muted hover:text-theme-secondary hover:bg-theme-hover transition-colors"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); e.target.value = '' }}
            />

            {/* Inline hints when empty */}
            {!hasContent && (
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-xs text-theme-muted">/commande</span>
                <span className="text-xs text-theme-muted">@contact</span>
                <span className="text-xs text-theme-muted">#bien</span>
              </div>
            )}
          </div>

          {/* Right: mic + send */}
          <div className="flex items-center gap-1">
            {/* Mic */}
            <button
              onClick={() => setIsRecording(p => !p)}
              aria-label={isRecording ? 'Arrêter l\'enregistrement' : 'Enregistrement vocal'}
              aria-pressed={isRecording}
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center transition-colors',
                isRecording ? 'text-red-500' : 'text-theme-muted hover:text-theme-secondary'
              )}
            >
              {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Send / Stop */}
            <button
              aria-label="Envoyer"
              onClick={() => {
                if (isLoading) return
                if (hasContent) handleSubmit()
              }}
              disabled={!hasContent || isLoading}
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center transition-colors',
                isLoading
                  ? 'text-theme-muted'
                  : hasContent
                  ? 'bg-theme-primary text-theme-inverse'
                  : 'text-theme-muted'
              )}
            >
              {isLoading ? (
                <StopCircle className="h-4 w-4 animate-pulse" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
