import { MessageCircle } from 'lucide-react'

export default function MesMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">
          Messages
        </h1>
        <p className="text-sm text-theme-secondary mt-1">
          Vos échanges avec votre agent immobilier
        </p>
      </div>

      {/* Empty state */}
      <div className="rounded-xl border border-theme-border p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-theme-hover flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="h-6 w-6 text-theme-tertiary" />
        </div>
        <h2 className="text-lg font-medium text-theme-primary mb-2">
          Aucun message
        </h2>
        <p className="text-sm text-theme-secondary">
          Vos conversations avec votre agent apparaîtront ici.
        </p>
      </div>
    </div>
  )
}
