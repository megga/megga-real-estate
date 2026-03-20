import { FileText, Upload } from 'lucide-react'

export default function MesDocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Mes documents
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vos documents KYC et pièces justificatives
        </p>
      </div>

      {/* Upload zone */}
      <div className="border-2 border-dashed border-gray-200 rounded-card p-8 text-center hover:border-accent/50 transition-colors">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Upload className="h-6 w-6 text-accent" />
        </div>
        <p className="text-sm font-medium text-primary-900 mb-1">
          Déposer vos documents ici
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, JPG ou PNG — max 10 Mo par fichier
        </p>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-card border border-border shadow-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-medium text-primary-900 mb-2">
          Aucun document
        </h2>
        <p className="text-sm text-muted-foreground">
          Vos documents apparaîtront ici une fois uploadés ou demandés par votre agent.
        </p>
      </div>
    </div>
  )
}
