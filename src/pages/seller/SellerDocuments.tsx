import { FileText, Download, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { SELLER_DOCUMENTS, type SellerDocument } from './sellerMockData'

function statusConfig(status: SellerDocument['status']) {
  switch (status) {
    case 'signed':    return { label: 'Signé', icon: CheckCircle2, cls: 'bg-success/10 text-success' }
    case 'available': return { label: 'Disponible', icon: Download, cls: 'bg-accent/10 text-accent' }
    case 'pending':   return { label: 'En attente', icon: Clock, cls: 'bg-warning/10 text-warning' }
  }
}

function fileIcon(type: string) {
  switch (type) {
    case 'pdf': return 'text-danger'
    case 'zip': return 'text-accent'
    default:    return 'text-primary-400'
  }
}

export default function SellerDocuments() {
  const signed = SELLER_DOCUMENTS.filter((d) => d.status === 'signed')
  const pending = SELLER_DOCUMENTS.filter((d) => d.status === 'pending')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Documents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {SELLER_DOCUMENTS.length} documents · {signed.length} signé{signed.length > 1 ? 's' : ''} · {pending.length} en attente
        </p>
      </div>

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
        {SELLER_DOCUMENTS.map((doc) => {
          const sc = statusConfig(doc.status)
          const Icon = sc.icon

          return (
            <div key={doc.id} className="p-4 flex items-center gap-4 hover:bg-primary-50/50 transition-colors">
              {/* File icon */}
              <div className={cn('h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0')}>
                <FileText className={cn('h-5 w-5', fileIcon(doc.type))} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-900 truncate">{doc.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{doc.type.toUpperCase()}</span>
                  <span>·</span>
                  <span>{doc.size}</span>
                  <span>·</span>
                  <span>{formatDate(doc.date)}</span>
                </div>
              </div>

              {/* Status badge */}
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-badge flex-shrink-0', sc.cls)}>
                <Icon className="h-3.5 w-3.5" />
                {sc.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
