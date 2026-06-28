// Affichage des messages WhatsApp d'un contact + composer outbound (Phase 2).

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useWhatsAppMessages, useSendWhatsAppMessage } from '@/hooks/useWhatsAppMessages'

interface Props { contactId: string }

// Coches de livraison d'un sortant (events `statuses` Meta ingérés par le webhook).
// received/sent = ✓ (parti), delivered = ✓✓, read = ✓✓ bleu, failed = non délivré.
function DeliveryStatus({ status, error }: { status: string; error: string | null }) {
  const { t } = useTranslation('contacts')
  if (status === 'failed') {
    return (
      <span className="font-medium text-red-200" title={error ?? t('cd.waDeliveryFailedTitle')}>
        ⚠ {t('cd.waDeliveryFailed')}
      </span>
    )
  }
  if (status === 'read') return <span className="text-sky-300" title={t('cd.waDeliveryRead')}>✓✓</span>
  if (status === 'delivered') return <span className="opacity-60" title={t('cd.waDeliveryDelivered')}>✓✓</span>
  return <span className="opacity-60" title={t('cd.waDeliverySent')}>✓</span>
}

export function CdWhatsAppCard({ contactId }: Props) {
  const { t } = useTranslation('contacts')
  const { data: messages = [], isLoading } = useWhatsAppMessages(contactId)
  const send = useSendWhatsAppMessage(contactId)
  const [draft, setDraft] = useState('')

  const canSend = draft.trim().length > 0 && !send.isPending

  function handleSend() {
    if (!canSend) return
    send.mutate(draft.trim(), {
      onSuccess: () => setDraft(''),
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="rounded-xl border border-theme-border bg-theme-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-primary">WhatsApp</h3>
        <span className="text-xs text-theme-muted">{t('cd.waMessageCount', { count: messages.length })}</span>
      </div>

      {isLoading && <p className="text-xs text-theme-muted">{t('cd.waLoading')}</p>}

      {!isLoading && messages.length === 0 && (
        <p className="text-xs text-theme-muted">{t('cd.waEmpty')}</p>
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
            {m.media_type === 'audio' ? (
              <span className="block">
                <span className="text-xs opacity-70">🎤 </span>
                {m.transcript
                  ? <span>{m.transcript}</span>
                  : <span className="opacity-60 italic">
                      {m.processing_status === 'pending' || m.processing_status === 'processing'
                        ? t('cd.waTranscribing')
                        : t('cd.waTranscriptUnavailable')}
                    </span>}
              </span>
            ) : (
              <>
                {m.media_type && <span className="block text-xs opacity-70 mb-0.5">[{m.media_type}]</span>}
                {m.body || <span className="opacity-60 italic">{t('cd.waNoText')}</span>}
              </>
            )}
            <span className={`flex items-center gap-1 text-[10px] mt-1 ${m.direction === 'outbound' ? 'justify-end' : ''}`}>
              <span className="opacity-60">{new Date(m.wa_timestamp || m.created_at).toLocaleString('fr-CH')}</span>
              {m.direction === 'outbound' && <DeliveryStatus status={m.status} error={m.delivery_error} />}
            </span>
          </div>
        ))}
      </div>

      {/* Composer outbound */}
      <div className="mt-3 pt-3 border-t border-theme-border">
        <textarea
          className="w-full resize-none rounded-lg border border-theme-border bg-theme-section text-sm text-theme-primary placeholder:text-theme-muted px-3 py-2 focus:outline-none focus:ring-1 focus:ring-theme-border"
          rows={2}
          placeholder={t('cd.waReplyPlaceholder')}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={send.isPending}
        />
        {send.isError && (
          <p className="mt-1 text-xs text-red-500">
            {t('cd.waSendError')}
          </p>
        )}
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="text-xs border border-theme-border text-theme-secondary rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-theme-hover transition-colors"
          >
            {send.isPending ? t('cd.waSending') : t('cd.waSend')}
          </button>
        </div>
      </div>
    </div>
  )
}
