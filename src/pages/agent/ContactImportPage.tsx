import { useState, useRef, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Upload, FileSpreadsheet, FileText, MessageSquareText, Users,
  ArrowLeft, Check, Loader2, AlertCircle, PenLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateContact } from '@/hooks/useContacts'
import { supabase } from '@/lib/supabase'
import type { ContactType } from '@/types/contact'
import PageTransition from '@/components/layout/PageTransition'

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

type ImportMethod = 'choose' | 'csv' | 'vcard' | 'text'

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

// ─── Column mapping ──────────────────────────────────────────────────────────

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
  if (h === 'name' || h === 'fullname' || h === 'nomcomplet') return 'last_name'
  return ''
}

// ─── Method Selection Screen ─────────────────────────────────────────────────

function MethodSelectionScreen({ onSelect }: { onSelect: (m: ImportMethod) => void }) {
  const methods = [
    { id: 'csv' as const, icon: FileSpreadsheet, title: 'CSV / Excel', desc: 'Importer depuis un fichier .csv ou .tsv', available: true },
    { id: 'vcard' as const, icon: Users, title: 'vCard (.vcf)', desc: 'Depuis iPhone, Android, Outlook, Gmail', available: true },
    { id: 'text' as const, icon: MessageSquareText, title: 'Texte libre (IA)', desc: 'Coller un email ou message, MEGGA AI extrait les infos', available: true },
    { id: 'manual' as const, icon: PenLine, title: 'Saisie manuelle', desc: 'Ajouter un contact à la main', available: true },
  ]

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold text-theme-primary mb-1">Importer des contacts</h1>
      <p className="text-sm text-theme-muted mb-8">Comment souhaitez-vous ajouter vos contacts ?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {methods.map(m => (
          <button
            key={m.id}
            onClick={() => m.id === 'manual' ? undefined : onSelect(m.id as ImportMethod)}
            className={cn(
              'text-left px-5 py-4 rounded-xl border transition-colors group relative',
              'border-theme-border hover:border-accent/40 cursor-pointer'
            )}
          >
            {m.id === 'manual' ? (
              <Link to="/dashboard/contacts" className="absolute inset-0" />
            ) : null}
            <div className="flex items-start gap-3.5">
              <m.icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-theme-muted group-hover:text-theme-secondary transition-colors" />
              <div>
                <p className="text-sm font-medium text-theme-primary">{m.title}</p>
                <p className="text-[12px] text-theme-muted mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

function CsvImportScreen({ onImport, onBack }: { onImport: (contacts: ImportedContact[]) => void; onBack: () => void }) {
  const [step, setStep] = useState<'upload' | 'map'>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCsv(text)
      if (h.length === 0) return
      setHeaders(h)
      setRows(r)
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

  return (
    <div className="min-h-[50vh] flex flex-col items-center px-4 pt-8">
      <button onClick={step === 'map' ? () => setStep('upload') : onBack} className="self-start flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">Importer depuis un CSV</h1>
      <p className="text-sm text-theme-muted mb-6">{step === 'upload' ? 'Glissez ou sélectionnez votre fichier' : `${rows.length} contacts trouvés — mappez les colonnes`}</p>

      <div className="w-full max-w-lg">
        {step === 'upload' ? (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
              dragOver ? 'border-accent/60 bg-accent/5' : 'border-theme-border hover:border-accent/30'
            )}
          >
            <Upload className="w-8 h-8 text-theme-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-theme-primary">Glissez votre fichier CSV ici</p>
            <p className="text-xs text-theme-muted mt-1">ou cliquez pour sélectionner (.csv, .tsv)</p>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-hide rounded-xl border border-theme-border p-4">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-theme-secondary w-36 truncate font-medium">{h}</span>
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

            <p className="text-[11px] text-theme-muted mt-3">Aperçu : {rows.slice(0, 3).map(r => `${r[0]} ${r[1] || ''}`).join(', ')}...</p>

            <button
              onClick={handleConfirm}
              disabled={!hasNameMapping}
              className={cn(
                'w-full h-10 rounded-xl text-sm font-medium transition-colors mt-4',
                hasNameMapping
                  ? 'border border-theme-border text-theme-primary hover:border-theme-active'
                  : 'border border-theme-border-subtle text-theme-muted cursor-not-allowed'
              )}
            >
              Importer {rows.length} contacts
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── vCard Import ────────────────────────────────────────────────────────────

function VcardImportScreen({ onImport, onBack }: { onImport: (contacts: ImportedContact[]) => void; onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ImportedContact[] | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => setParsed(parseVcard(e.target?.result as string))
    reader.readAsText(file)
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center px-4 pt-8">
      <button onClick={onBack} className="self-start flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">Importer depuis vCard</h1>
      <p className="text-sm text-theme-muted mb-6">Export depuis iPhone, Android, Outlook ou Gmail</p>

      <div className="w-full max-w-lg">
        {!parsed ? (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
              dragOver ? 'border-accent/60 bg-accent/5' : 'border-theme-border hover:border-accent/30'
            )}
          >
            <FileText className="w-8 h-8 text-theme-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-theme-primary">Glissez votre fichier .vcf ici</p>
            <p className="text-xs text-theme-muted mt-1">ou cliquez pour sélectionner</p>
            <input ref={fileRef} type="file" accept=".vcf,.vcard" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
          </div>
        ) : (
          <>
            <p className="text-sm text-theme-primary font-medium mb-3">{parsed.length} contacts trouvés</p>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-hide rounded-xl border border-theme-border p-4">
              {parsed.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1">
                  <div className="h-7 w-7 rounded-full bg-theme-hover flex items-center justify-center text-[10px] font-semibold text-theme-secondary flex-shrink-0">
                    {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-theme-primary text-[13px]">{c.first_name} {c.last_name}</span>
                    <div className="flex gap-3 text-[11px] text-theme-muted">
                      {c.email && <span>{c.email}</span>}
                      {c.phone && <span>{c.phone}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => onImport(parsed)}
              className="w-full h-10 rounded-xl text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors mt-4"
            >
              Importer {parsed.length} contacts
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Text Free Import (AI) ───────────────────────────────────────────────────

function TextImportScreen({ onImport, onBack }: { onImport: (contacts: ImportedContact[]) => void; onBack: () => void }) {
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
    <div className="min-h-[50vh] flex flex-col items-center px-4 pt-8">
      <button onClick={onBack} className="self-start flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">Extraction IA</h1>
      <p className="text-sm text-theme-muted mb-6">Collez un email, un message, ou tout texte contenant des coordonnées</p>

      <div className="w-full max-w-lg">
        {!extracted ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Ex: Bonjour, je suis Marie Dupont, joignable au 079 123 45 67 ou marie.dupont@gmail.com. Je cherche un 4 pièces à Genève..."}
              rows={8}
              autoFocus
              className="w-full px-4 py-3 text-sm bg-transparent border border-theme-border rounded-xl text-theme-primary placeholder:text-theme-muted resize-none focus:outline-none focus:border-accent/40"
            />
            {error && (
              <div className="flex items-start gap-2 text-xs text-red-500 mt-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              onClick={handleExtract}
              disabled={!text.trim() || isExtracting}
              className={cn(
                'w-full h-10 rounded-xl text-sm font-medium transition-colors mt-4',
                text.trim() && !isExtracting
                  ? 'border border-theme-border text-theme-primary hover:border-theme-active'
                  : 'border border-theme-border-subtle text-theme-muted cursor-not-allowed'
              )}
            >
              {isExtracting ? (
                <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> MEGGA AI analyse le texte...</span>
              ) : 'Extraire les contacts'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-theme-primary font-medium mb-3">{extracted.length} contact{extracted.length > 1 ? 's' : ''} identifié{extracted.length > 1 ? 's' : ''}</p>
            <div className="space-y-1.5 rounded-xl border border-theme-border p-4">
              {extracted.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1">
                  <div className="h-7 w-7 rounded-full bg-theme-hover flex items-center justify-center text-[10px] font-semibold text-theme-secondary flex-shrink-0">
                    {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-theme-primary text-[13px]">{c.first_name} {c.last_name}</span>
                    <div className="flex gap-3 text-[11px] text-theme-muted">
                      {c.email && <span>{c.email}</span>}
                      {c.phone && <span>{c.phone}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => onImport(extracted)}
              className="w-full h-10 rounded-xl text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors mt-4"
            >
              Importer {extracted.length} contact{extracted.length > 1 ? 's' : ''}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Import Results Screen ───────────────────────────────────────────────────

function ImportResultScreen({ result, onDone }: { result: ImportResult; onDone: () => void }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4">
      <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
        <Check className="w-7 h-7 text-emerald-500" />
      </div>
      <h1 className="text-xl font-semibold text-theme-primary">
        {result.imported} contact{result.imported > 1 ? 's' : ''} importé{result.imported > 1 ? 's' : ''}
      </h1>
      {result.skipped > 0 && (
        <p className="text-sm text-theme-muted mt-1">{result.skipped} ignoré{result.skipped > 1 ? 's' : ''} (doublons ou incomplets)</p>
      )}
      {result.errors.length > 0 && (
        <div className="mt-3 text-xs text-red-500 space-y-0.5">
          {result.errors.slice(0, 3).map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
      <button
        onClick={onDone}
        className="mt-6 h-10 px-8 rounded-xl text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
      >
        Voir mes contacts
      </button>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ContactImportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialMethod = searchParams.get('method') as ImportMethod | null
  const [method, setMethod] = useState<ImportMethod>(
    initialMethod && ['csv', 'vcard', 'text'].includes(initialMethod) ? initialMethod : 'choose'
  )
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

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Link
            to="/dashboard/contacts"
            className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {method !== 'choose' && !result && (
            <div className="flex-1">
              <p className="text-sm text-theme-tertiary">Importer des contacts</p>
            </div>
          )}
        </div>

        {/* Content */}
        {isImporting ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <p className="text-sm text-theme-primary">Import en cours...</p>
          </div>
        ) : result ? (
          <ImportResultScreen result={result} onDone={() => navigate('/dashboard/contacts')} />
        ) : method === 'choose' ? (
          <MethodSelectionScreen onSelect={setMethod} />
        ) : method === 'csv' ? (
          <CsvImportScreen onImport={handleImport} onBack={() => setMethod('choose')} />
        ) : method === 'vcard' ? (
          <VcardImportScreen onImport={handleImport} onBack={() => setMethod('choose')} />
        ) : method === 'text' ? (
          <TextImportScreen onImport={handleImport} onBack={() => setMethod('choose')} />
        ) : null}
      </div>
    </PageTransition>
  )
}
