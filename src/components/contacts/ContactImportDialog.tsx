import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Upload, FileSpreadsheet, FileText, MessageSquareText, Users,
  ArrowLeft, Check, Loader2, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateContact } from '@/hooks/useContacts'
import { supabase } from '@/lib/supabase'
import type { ContactType } from '@/types/contact'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImportedContact {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  type?: ContactType
  source?: string
  notes?: string
}

interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

type ImportMethod = 'choose' | 'csv' | 'vcard' | 'text' | 'google'

// ─── CSV Parser ──────────────────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if ((ch === ',' || ch === ';') && !inQuotes) { result.push(current.trim()); current = ''; continue }
      current += ch
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine).filter(r => r.some(c => c))
  return { headers, rows }
}

// ─── vCard Parser ────────────────────────────────────────────────────────────

function parseVcard(text: string): ImportedContact[] {
  const cards = text.split('BEGIN:VCARD').filter(c => c.includes('END:VCARD'))
  return cards.map(card => {
    const get = (key: string): string => {
      const match = card.match(new RegExp(`${key}[^:]*:(.+)`, 'i'))
      return match?.[1]?.trim() ?? ''
    }
    const nParts = get('N').split(';')
    const fn = get('FN')
    const firstName = fn ? fn.split(' ')[0] : (nParts[1] || '')
    const lastName = fn ? fn.split(' ').slice(1).join(' ') : (nParts[0] || '')
    return {
      first_name: firstName,
      last_name: lastName,
      email: get('EMAIL') || undefined,
      phone: get('TEL') || undefined,
      type: 'lead' as ContactType,
      source: 'import_vcard',
    }
  }).filter(c => c.first_name || c.last_name)
}

// ─── Column mapping presets ──────────────────────────────────────────────────

const FIELD_OPTIONS = [
  { value: '', label: 'Ignorer' },
  { value: 'first_name', label: 'Prénom' },
  { value: 'last_name', label: 'Nom' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'type', label: 'Type' },
  { value: 'notes', label: 'Notes' },
  { value: 'source', label: 'Source' },
] as const

function autoMapColumn(header: string): string {
  const h = header.toLowerCase().replace(/[_\s-]/g, '')
  if (['prénom', 'prenom', 'firstname', 'vorname'].some(k => h.includes(k))) return 'first_name'
  if (['nom', 'lastname', 'nachname', 'familyname'].some(k => h.includes(k))) return 'last_name'
  if (['email', 'mail', 'courriel'].some(k => h.includes(k))) return 'email'
  if (['tel', 'phone', 'mobile', 'téléphone', 'telephone', 'telefon'].some(k => h.includes(k))) return 'phone'
  if (['type', 'catégorie', 'category'].some(k => h.includes(k))) return 'type'
  if (['note', 'notes', 'commentaire', 'comment'].some(k => h.includes(k))) return 'notes'
  if (['source', 'origine'].some(k => h.includes(k))) return 'source'
  if (h === 'name' || h === 'fullname' || h === 'nom complet') return 'last_name'
  return ''
}

// ─── Method Selection ────────────────────────────────────────────────────────

function MethodSelection({ onSelect }: { onSelect: (m: ImportMethod) => void }) {
  const methods = [
    { id: 'csv' as const, icon: FileSpreadsheet, title: 'CSV / Excel', desc: 'Importer depuis un fichier .csv' },
    { id: 'vcard' as const, icon: Users, title: 'vCard (.vcf)', desc: 'Depuis iPhone, Android, Outlook' },
    { id: 'text' as const, icon: MessageSquareText, title: 'Texte libre', desc: 'Coller un email ou message, l\'IA extrait les infos' },
    { id: 'google' as const, icon: Users, title: 'Google Contacts', desc: 'Bientôt disponible', disabled: true },
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-theme-muted text-center">Comment souhaitez-vous importer vos contacts ?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {methods.map(m => (
          <button
            key={m.id}
            onClick={() => !m.disabled && onSelect(m.id)}
            disabled={m.disabled}
            className={cn(
              'text-left px-4 py-3.5 rounded-xl border transition-colors group relative',
              m.disabled
                ? 'border-theme-border-subtle opacity-50 cursor-not-allowed'
                : 'border-theme-border hover:border-accent/40'
            )}
          >
            <div className="flex items-start gap-3">
              <m.icon className="w-4.5 h-4.5 mt-0.5 flex-shrink-0 text-theme-muted group-hover:text-theme-secondary transition-colors" />
              <div>
                <p className="text-[13px] font-medium text-theme-primary">{m.title}</p>
                <p className="text-[11px] text-theme-muted mt-0.5">{m.desc}</p>
              </div>
            </div>
            {m.disabled && <span className="absolute top-3 right-3 text-[10px] text-theme-muted">Bientôt</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── CSV Import Step ─────────────────────────────────────────────────────────

function CsvImport({ onImport, onBack }: { onImport: (contacts: ImportedContact[]) => void; onBack: () => void }) {
  const [step, setStep] = useState<'upload' | 'map'>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCsv(text)
      if (h.length === 0) return
      setHeaders(h)
      setRows(r)
      // Auto-map columns
      const autoMap: Record<number, string> = {}
      h.forEach((header, i) => { autoMap[i] = autoMapColumn(header) })
      setMapping(autoMap)
      setStep('map')
    }
    reader.readAsText(file)
  }

  function handleConfirm() {
    const contacts: ImportedContact[] = rows.map(row => {
      const c: Record<string, string> = {}
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field && row[Number(colIdx)]) c[field] = row[Number(colIdx)]
      })
      return {
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        email: c.email || undefined,
        phone: c.phone || undefined,
        type: (c.type as ContactType) || 'lead',
        source: c.source || 'import_csv',
        notes: c.notes || undefined,
      }
    }).filter(c => c.first_name || c.last_name)
    onImport(contacts)
  }

  const hasNameMapping = Object.values(mapping).includes('first_name') || Object.values(mapping).includes('last_name')

  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-theme-border rounded-xl p-10 text-center cursor-pointer hover:border-accent/30 transition-colors"
        >
          <Upload className="w-7 h-7 text-theme-muted mx-auto mb-2" />
          <p className="text-sm font-medium text-theme-primary">Glissez votre fichier CSV ici</p>
          <p className="text-[11px] text-theme-muted mt-1">ou cliquez pour sélectionner</p>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setStep('upload')} className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </button>

      <p className="text-sm text-theme-primary font-medium">{rows.length} contacts trouvés — Mappez les colonnes :</p>

      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
        {headers.map((h, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-theme-secondary w-32 truncate">{h}</span>
            <span className="text-theme-muted text-xs">→</span>
            <select
              value={mapping[i] || ''}
              onChange={(e) => setMapping(prev => ({ ...prev, [i]: e.target.value }))}
              className="flex-1 h-8 px-2 text-xs bg-transparent border border-theme-border rounded-lg text-theme-primary"
            >
              {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Preview */}
      <p className="text-[11px] text-theme-muted">Aperçu : {rows.slice(0, 2).map(r => r[0]).join(', ')}...</p>

      <button
        onClick={handleConfirm}
        disabled={!hasNameMapping}
        className={cn(
          'w-full h-9 rounded-lg text-sm font-medium transition-colors',
          hasNameMapping
            ? 'border border-theme-border text-theme-primary hover:border-theme-active'
            : 'border border-theme-border-subtle text-theme-muted cursor-not-allowed'
        )}
      >
        Importer {rows.length} contacts
      </button>
    </div>
  )
}

// ─── vCard Import Step ───────────────────────────────────────────────────────

function VcardImport({ onImport, onBack }: { onImport: (contacts: ImportedContact[]) => void; onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ImportedContact[] | null>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const contacts = parseVcard(e.target?.result as string)
      setParsed(contacts)
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </button>

      {!parsed ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-theme-border rounded-xl p-10 text-center cursor-pointer hover:border-accent/30 transition-colors"
        >
          <FileText className="w-7 h-7 text-theme-muted mx-auto mb-2" />
          <p className="text-sm font-medium text-theme-primary">Glissez votre fichier .vcf ici</p>
          <p className="text-[11px] text-theme-muted mt-1">Export depuis iPhone, Android, Outlook, Gmail</p>
          <input ref={fileRef} type="file" accept=".vcf,.vcard" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
        </div>
      ) : (
        <>
          <p className="text-sm text-theme-primary font-medium">{parsed.length} contacts trouvés</p>
          <div className="space-y-1 max-h-[250px] overflow-y-auto scrollbar-hide">
            {parsed.slice(0, 10).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-theme-secondary py-1">
                <span className="font-medium text-theme-primary">{c.first_name} {c.last_name}</span>
                {c.email && <span className="text-theme-muted">{c.email}</span>}
                {c.phone && <span className="text-theme-muted">{c.phone}</span>}
              </div>
            ))}
            {parsed.length > 10 && <p className="text-[11px] text-theme-muted">+{parsed.length - 10} autres...</p>}
          </div>
          <button
            onClick={() => onImport(parsed)}
            className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
          >
            Importer {parsed.length} contacts
          </button>
        </>
      )}
    </div>
  )
}

// ─── Text Free Import (AI) ───────────────────────────────────────────────────

function TextImport({ onImport, onBack }: { onImport: (contacts: ImportedContact[]) => void; onBack: () => void }) {
  const [text, setText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ImportedContact[] | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setIsExtracting(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-copilot', {
        body: {
          action: 'chat',
          message: `Extrais tous les contacts de ce texte. Retourne un JSON array strict avec les champs : first_name, last_name, email, phone, type (buyer/seller/lead), notes. Si un champ est inconnu, mets null. Retourne UNIQUEMENT le JSON array, pas de texte.\n\nTexte :\n${text}`,
          context: {},
        },
      })
      if (fnError) throw new Error(fnError.message)
      const content = data?.response ?? data?.content ?? ''
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('Aucun contact trouvé dans le texte')
      const contacts = JSON.parse(jsonMatch[0]) as ImportedContact[]
      const valid = contacts.filter((c: ImportedContact) => c.first_name || c.last_name).map((c: ImportedContact) => ({
        ...c,
        source: 'import_text_ai',
      }))
      if (valid.length === 0) throw new Error('Aucun contact identifié')
      setExtracted(valid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d\'extraction')
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </button>

      {!extracted ? (
        <>
          <p className="text-sm text-theme-muted">Collez un email, un message WhatsApp, ou tout texte contenant des coordonnées :</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex: Bonjour, je suis Marie Dupont, joignable au 079 123 45 67 ou marie.dupont@gmail.com. Je cherche un 4 pièces à Genève..."
            rows={6}
            className="w-full px-3 py-2.5 text-sm bg-transparent border border-theme-border rounded-xl text-theme-primary placeholder:text-theme-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          {error && (
            <div className="flex items-start gap-2 text-xs text-red-500">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <button
            onClick={handleExtract}
            disabled={!text.trim() || isExtracting}
            className={cn(
              'w-full h-9 rounded-lg text-sm font-medium transition-colors',
              text.trim() && !isExtracting
                ? 'border border-theme-border text-theme-primary hover:border-theme-active'
                : 'border border-theme-border-subtle text-theme-muted cursor-not-allowed'
            )}
          >
            {isExtracting ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyse en cours...</span>
            ) : 'Extraire les contacts'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-theme-primary font-medium">{extracted.length} contact{extracted.length > 1 ? 's' : ''} identifié{extracted.length > 1 ? 's' : ''} par MEGGA AI</p>
          <div className="space-y-1">
            {extracted.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-theme-secondary py-1">
                <span className="font-medium text-theme-primary">{c.first_name} {c.last_name}</span>
                {c.email && <span className="text-theme-muted">{c.email}</span>}
                {c.phone && <span className="text-theme-muted">{c.phone}</span>}
              </div>
            ))}
          </div>
          <button
            onClick={() => onImport(extracted)}
            className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
          >
            Importer {extracted.length} contact{extracted.length > 1 ? 's' : ''}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Import Results ──────────────────────────────────────────────────────────

function ImportResults({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
        <Check className="w-6 h-6 text-emerald-500" />
      </div>
      <div>
        <p className="text-lg font-semibold text-theme-primary">{result.imported} contact{result.imported > 1 ? 's' : ''} importé{result.imported > 1 ? 's' : ''}</p>
        {result.skipped > 0 && <p className="text-xs text-theme-muted mt-1">{result.skipped} ignoré{result.skipped > 1 ? 's' : ''} (doublons ou incomplets)</p>}
        {result.errors.length > 0 && (
          <div className="mt-2 text-xs text-red-500">
            {result.errors.slice(0, 3).map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="h-9 px-6 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
      >
        Fermer
      </button>
    </div>
  )
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export default function ContactImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [method, setMethod] = useState<ImportMethod>('choose')
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const createContact = useCreateContact()

  const handleImport = useCallback(async (contacts: ImportedContact[]) => {
    setIsImporting(true)
    const importResult: ImportResult = { total: contacts.length, imported: 0, skipped: 0, errors: [] }

    for (const c of contacts) {
      if (!c.first_name && !c.last_name) { importResult.skipped++; continue }
      try {
        await createContact.mutateAsync({
          firstName: c.first_name || '',
          lastName: c.last_name || '',
          email: c.email || '',
          phone: c.phone,
          type: c.type || 'lead',
        })
        importResult.imported++
      } catch (err) {
        importResult.errors.push(`${c.first_name} ${c.last_name}: ${err instanceof Error ? err.message : 'erreur'}`)
        importResult.skipped++
      }
    }

    setResult(importResult)
    setIsImporting(false)
  }, [createContact])

  function handleClose() {
    setMethod('choose')
    setResult(null)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-theme-card rounded-xl border border-theme-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto scrollbar-hide" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-base font-semibold text-theme-primary">Importer des contacts</h3>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {isImporting ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-sm text-theme-primary">Import en cours...</p>
            </div>
          ) : result ? (
            <ImportResults result={result} onClose={handleClose} />
          ) : method === 'choose' ? (
            <MethodSelection onSelect={setMethod} />
          ) : method === 'csv' ? (
            <CsvImport onImport={handleImport} onBack={() => setMethod('choose')} />
          ) : method === 'vcard' ? (
            <VcardImport onImport={handleImport} onBack={() => setMethod('choose')} />
          ) : method === 'text' ? (
            <TextImport onImport={handleImport} onBack={() => setMethod('choose')} />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
