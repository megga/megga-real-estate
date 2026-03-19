import { useState, useRef, useCallback } from 'react'
import { FileText, Download, CheckCircle2, Clock, AlertTriangle, Upload, Loader2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useDocuments, formatFileSize, type Document } from '@/hooks/useDocuments'

function statusConfig(status: Document['status']) {
  switch (status) {
    case 'signed':    return { label: 'Signé', icon: CheckCircle2, cls: 'bg-success/10 text-success' }
    case 'available': return { label: 'Disponible', icon: Download, cls: 'bg-accent/10 text-accent' }
    case 'pending':   return { label: 'En attente', icon: Clock, cls: 'bg-warning/10 text-warning' }
    case 'rejected':  return { label: 'Rejeté', icon: AlertTriangle, cls: 'bg-danger/10 text-danger' }
  }
}

function fileIcon(type: string) {
  switch (type) {
    case 'pdf': return 'text-danger'
    case 'zip': return 'text-accent'
    default:    return 'text-primary-400'
  }
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.zip,.doc,.docx'

export default function SellerDocuments() {
  const { documents, isLoading, uploadDocument, isUploading, downloadDocument } = useDocuments('mock-property')
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const signed = documents.filter((d) => d.status === 'signed')
  const pending = documents.filter((d) => d.status === 'pending')

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        await uploadDocument({ file, propertyId: 'mock-property' })
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur lors de l\'upload')
    }
  }, [uploadDocument])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Documents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {documents.length} documents · {signed.length} signé{signed.length > 1 ? 's' : ''} · {pending.length} en attente
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-card p-8 text-center cursor-pointer transition-colors',
          dragOver ? 'border-accent bg-accent/5' : 'border-gray-200 hover:border-accent/50 hover:bg-gray-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-accent font-medium">Upload en cours...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-muted-foreground">
              Glissez vos fichiers ici ou <span className="text-accent font-medium">cliquez pour parcourir</span>
            </p>
            <p className="text-xs text-gray-400">PDF, JPG, PNG, ZIP, DOC — Max 50 Mo</p>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{uploadError}</p>
        </div>
      )}

      {/* Pending documents alert */}
      {pending.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-card p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary-900">
              {pending.length} document{pending.length > 1 ? 's' : ''} en attente de signature
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Veuillez signer les documents ci-dessous pour faire avancer votre dossier.
            </p>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="bg-white rounded-card border border-border divide-y divide-border">
        {documents.map((doc) => {
          const sc = statusConfig(doc.status)
          const Icon = sc.icon
          const canDownload = doc.status === 'available' || doc.status === 'signed'

          return (
            <div
              key={doc.id}
              onClick={canDownload ? () => downloadDocument(doc.storage_path, doc.name) : undefined}
              className={cn(
                'p-4 flex items-center gap-4 transition-colors',
                canDownload ? 'hover:bg-primary-50/50 cursor-pointer' : ''
              )}
            >
              {/* File icon */}
              <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <FileText className={cn('h-5 w-5', fileIcon(doc.type))} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-900 truncate">{doc.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{doc.type.toUpperCase()}</span>
                  <span>·</span>
                  <span>{formatFileSize(doc.size_bytes)}</span>
                  <span>·</span>
                  <span>{formatDate(doc.created_at)}</span>
                </div>
              </div>

              {/* Download icon for available docs */}
              {canDownload && (
                <Download className="h-4 w-4 text-accent flex-shrink-0" />
              )}

              {/* Status badge */}
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-badge flex-shrink-0', sc.cls)}>
                <Icon className="h-3.5 w-3.5" />
                {sc.label}
              </span>
            </div>
          )
        })}
      </div>

      {documents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun document pour le moment.</p>
        </div>
      )}
    </div>
  )
}
