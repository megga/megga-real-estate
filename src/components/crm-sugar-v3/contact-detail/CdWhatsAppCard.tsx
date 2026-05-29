// Affichage read-only des messages WhatsApp d'un contact (Phase 1 : miroir
// entrant). Pas d'envoi ici — ce sera la Phase 2.

import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages'

interface Props { contactId: string }

export function CdWhatsAppCard({ contactId }: Props) {
  const { data: messages = [], isLoading } = useWhatsAppMessages(contactId)

  return (
    <div className="rounded-xl border border-theme-border bg-theme-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-primary">WhatsApp</h3>
        <span className="text-xs text-theme-muted">{messages.length} message{messages.length > 1 ? 's' : ''}</span>
      </div>

      {isLoading && <p className="text-xs text-theme-muted">Chargement…</p>}

      {!isLoading && messages.length === 0 && (
        <p className="text-xs text-theme-muted">Aucun message WhatsApp pour ce contact.</p>
      )}

      <div className="flex flex-col gap-2">
        {messages.map(m => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.direction === 'inbound'
                ? 'self-start bg-theme-section text-theme-primary'
                : 'self-end bg-emerald-600 text-white'
            }`}
          >
            {m.media_type && (
              <span className="block text-xs opacity-70 mb-0.5">[{m.media_type}]</span>
            )}
            {m.body || <span className="opacity-60 italic">(sans texte)</span>}
            <span className="block text-[10px] opacity-60 mt-1">
              {new Date(m.wa_timestamp || m.created_at).toLocaleString('fr-CH')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
