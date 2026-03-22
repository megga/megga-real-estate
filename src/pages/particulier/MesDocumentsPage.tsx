import { FileText, Upload } from 'lucide-react'

export default function MesDocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">
          Mes documents
        </h1>
        <p className="text-sm text-theme-secondary mt-1">
          Vos documents KYC et pièces justificatives
        </p>
      </div>

      {/* Upload zone */}
      <div className="border-2 border-dashed border-theme-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Upload className="h-6 w-6 text-accent" />
        </div>
        <p className="text-sm font-medium text-theme-primary mb-1">
          Déposer vos documents ici
        </p>
        <p className="text-xs text-theme-muted">
          PDF, JPG ou PNG — max 10 Mo par fichier
        </p>
      </div>

      {/* Empty state */}
      <div className="rounded-xl border border-theme-border p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-theme-hover flex items-center justify-center mx-auto mb-4">
          <FileText className="h-6 w-6 text-theme-tertiary" />
        </div>
        <h2 className="text-lg font-medium text-theme-primary mb-2">
          Aucun document
        </h2>
        <p className="text-sm text-theme-secondary">
          Vos documents apparaîtront ici une fois uploadés ou demandés par votre agent.
        </p>
      </div>
    </div>
  )
}
