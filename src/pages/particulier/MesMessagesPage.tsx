import { MessageCircle } from 'lucide-react'

export default function MesMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Messages
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vos échanges avec votre agent immobilier
        </p>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-card border border-border shadow-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="h-6 w-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-medium text-primary-900 mb-2">
          Aucun message
        </h2>
        <p className="text-sm text-muted-foreground">
          Vos conversations avec votre agent apparaîtront ici.
        </p>
      </div>
    </div>
  )
}
