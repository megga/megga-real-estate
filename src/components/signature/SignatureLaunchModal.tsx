// SignatureLaunchModal — lance une demande de signature qualifiée sur un PDF
// (Phase 2/3 e-signature). Réutilisable : DocumentGenerator (générer & signer),
// liste documents, dossier… Le PDF est fourni en base64 par l'appelant.
//
// Livraison du lien au signataire :
//   - Email  : le provider (Skribble) notifie le signataire (notify=true).
//   - WhatsApp : on n'active PAS la notif provider, on envoie le signing_url
//     dans le fil WhatsApp du client via l'edge whatsapp-send (human-in-the-loop,
//     c'est l'agent qui déclenche).
//
// Design = thème CRM (tokens theme-*, lucide), modal accessible ui/modal.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Mail, MessageCircle, Plus, Trash2, Check, Copy, ExternalLink, AlertCircle,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  useEsignSignature,
  type SignatureQuality,
  type CreateSignatureResult,
} from '@/hooks/useEsignSignature'

export interface SignatureLaunchSigner {
  name?: string
  email?: string
  phone?: string
}

interface SignatureLaunchModalProps {
  open: boolean
  onClose: () => void
  /** PDF à signer, base64 brut (sans préfixe data:). */
  pdfBase64: string | null
  /** Lie la signature au document CRM (le statut « signé » s'y reflète). */
  documentId?: string
  defaultTitle: string
  defaultSigners?: SignatureLaunchSigner[]
  /** Contexte métier (mandate/offer/contract + id du listing/transaction). */
  contextType?: string
  contextId?: string
  /** Contact CRM pour la livraison WhatsApp (id prioritaire sur le téléphone). */
  contact?: { id?: string; phone?: string | null }
}

const QUALITIES: { id: SignatureQuality; label: string }[] = [
  { id: 'QES', label: 'QES' },
  { id: 'AES', label: 'AES' },
  { id: 'SES', label: 'SES' },
]

const inputCls =
  'w-full h-9 rounded-lg border border-theme-border bg-theme-page px-3 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/20'

export function SignatureLaunchModal({
  open,
  onClose,
  pdfBase64,
  documentId,
  defaultTitle,
  defaultSigners,
  contextType,
  contextId,
  contact,
}: SignatureLaunchModalProps) {
  const navigate = useNavigate()
  const { hasActiveProvider, isLoading, getConnection, createSignature, isCreating } = useEsignSignature()

  const initialSigners = useMemo<SignatureLaunchSigner[]>(
    () => (defaultSigners && defaultSigners.length > 0 ? defaultSigners : [{ name: '', email: '', phone: '' }]),
    [defaultSigners],
  )

  const [signers, setSigners] = useState<SignatureLaunchSigner[]>(initialSigners)
  const [quality, setQuality] = useState<SignatureQuality>(
    (getConnection('skribble')?.default_quality as SignatureQuality) || 'QES',
  )
  const [delivery, setDelivery] = useState<'email' | 'whatsapp'>('email')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateSignatureResult | null>(null)
  const [waState, setWaState] = useState<'idle' | 'sent' | 'failed'>('idle')
  const [copied, setCopied] = useState(false)

  const firstPhone = signers[0]?.phone || contact?.phone || ''
  const canWhatsApp = !!(contact?.id || firstPhone)
  const validEmail = signers.some((s) => (s.email ?? '').includes('@'))
  const canSend = !!pdfBase64 && validEmail && hasActiveProvider && !isCreating

  function updateSigner(i: number, patch: Partial<SignatureLaunchSigner>) {
    setSigners((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  async function deliverWhatsApp(signingUrl: string) {
    const name = signers[0]?.name?.trim() || ''
    const message =
      `Bonjour${name ? ' ' + name : ''}, votre document « ${defaultTitle} » est prêt à être signé.\n` +
      `Signez en toute sécurité ici : ${signingUrl}`
    const body: Record<string, unknown> = { body: message }
    if (contact?.id) body.contactId = contact.id
    else body.toPhone = firstPhone
    const { error: waErr } = await supabase.functions.invoke('whatsapp-send', { body })
    setWaState(waErr ? 'failed' : 'sent')
  }

  async function handleSend() {
    if (!pdfBase64 || !canSend) return
    setError(null)
    try {
      const res = await createSignature({
        pdf_base64: pdfBase64,
        title: defaultTitle,
        document_id: documentId,
        context_type: contextType,
        context_id: contextId,
        quality,
        legislation: 'ZERTES',
        notify: delivery === 'email', // WhatsApp → pas de notif email provider
        signers: signers
          .filter((s) => (s.email ?? '').includes('@'))
          .map((s, i) => ({
            email: (s.email ?? '').trim(),
            name: s.name?.trim() || undefined,
            mobile: s.phone?.trim() || undefined,
            sequence: i + 1,
          })),
      })
      setResult(res)
      if (delivery === 'whatsapp' && res.signing_url) {
        await deliverWhatsApp(res.signing_url)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible')
    }
  }

  function reset() {
    setResult(null)
    setError(null)
    setWaState('idle')
    setCopied(false)
    onClose()
  }

  // ── Chargement de l'état provider ──────────────────────────────────────────
  if (open && isLoading) {
    return (
      <Modal open={open} onClose={onClose} title="Envoyer en signature" size="md">
        <div className="p-10 flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-theme-border border-t-theme-primary animate-spin" />
        </div>
      </Modal>
    )
  }

  // ── Provider non connecté ──────────────────────────────────────────────────
  if (open && !hasActiveProvider) {
    return (
      <Modal open={open} onClose={onClose} title="Envoyer en signature" size="md">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-theme-border bg-theme-section p-4">
            <AlertCircle className="w-5 h-5 text-theme-muted shrink-0 mt-0.5" />
            <p className="text-sm text-theme-secondary leading-relaxed">
              Aucun fournisseur de signature n'est connecté. Connectez Skribble dans
              <span className="text-theme-primary font-medium"> Réglages › Intégrations</span> pour
              envoyer vos documents en signature qualifiée.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
            <Button onClick={() => navigate('/settings?tab=applications')}>
              Connecter Skribble
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Succès ─────────────────────────────────────────────────────────────────
  if (open && result) {
    const link = result.signing_url
    return (
      <Modal open={open} onClose={reset} title="Demande de signature envoyée" size="md">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-theme-primary">Document prêt à signer</p>
              <p className="text-xs text-theme-tertiary">
                {delivery === 'whatsapp'
                  ? waState === 'sent'
                    ? 'Lien envoyé par WhatsApp au signataire.'
                    : waState === 'failed'
                      ? 'Demande créée, mais l’envoi WhatsApp a échoué — partagez le lien manuellement.'
                      : 'Demande créée.'
                  : 'Le signataire a reçu le lien par email.'}
              </p>
            </div>
          </div>

          {link && (
            <div className="flex items-center gap-2 rounded-lg border border-theme-border bg-theme-page px-3 py-2">
              <span className="flex-1 truncate text-xs text-theme-secondary">{link}</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="p-1.5 rounded-md hover:bg-theme-hover text-theme-tertiary hover:text-theme-primary transition-colors"
                aria-label="Copier le lien"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={link} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-theme-hover text-theme-tertiary hover:text-theme-primary transition-colors"
                aria-label="Ouvrir le lien"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={reset}>Terminé</Button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Formulaire ─────────────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={onClose} title="Envoyer en signature" size="lg">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm text-theme-secondary">
          <ShieldCheck className="w-4 h-4 text-theme-muted" />
          Document : <span className="text-theme-primary font-medium">{defaultTitle}</span>
        </div>

        {/* Signataires */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-theme-muted">Signataires</p>
          {signers.map((s, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <input
                className={inputCls}
                placeholder="Nom"
                value={s.name ?? ''}
                onChange={(e) => updateSigner(i, { name: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="Email"
                type="email"
                value={s.email ?? ''}
                onChange={(e) => updateSigner(i, { email: e.target.value })}
              />
              {signers.length > 1 ? (
                <button
                  onClick={() => setSigners((prev) => prev.filter((_, idx) => idx !== i))}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-theme-border text-theme-muted hover:text-red-500 hover:border-red-500/40 transition-colors"
                  aria-label="Retirer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <div className="hidden sm:block w-9" />
              )}
            </div>
          ))}
          <button
            onClick={() => setSigners((prev) => [...prev, { name: '', email: '', phone: '' }])}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter un signataire
          </button>
        </div>

        {/* Niveau de signature */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-theme-muted">Niveau</p>
          <div className="flex gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                className={cn(
                  'flex-1 h-9 rounded-lg border text-sm font-medium transition-colors',
                  quality === q.id
                    ? 'border-theme-active bg-theme-active/10 text-theme-primary'
                    : 'border-theme-border text-theme-secondary hover:border-theme-active',
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Livraison du lien */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-theme-muted">Livraison du lien</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDelivery('email')}
              className={cn(
                'flex items-center gap-2 h-10 px-3 rounded-lg border text-sm transition-colors',
                delivery === 'email'
                  ? 'border-theme-active bg-theme-active/10 text-theme-primary'
                  : 'border-theme-border text-theme-secondary hover:border-theme-active',
              )}
            >
              <Mail className="w-4 h-4" /> Email
            </button>
            <button
              onClick={() => canWhatsApp && setDelivery('whatsapp')}
              disabled={!canWhatsApp}
              className={cn(
                'flex items-center gap-2 h-10 px-3 rounded-lg border text-sm transition-colors',
                delivery === 'whatsapp'
                  ? 'border-theme-active bg-theme-active/10 text-theme-primary'
                  : 'border-theme-border text-theme-secondary hover:border-theme-active',
                !canWhatsApp && 'opacity-50 cursor-not-allowed',
              )}
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
          </div>
          {delivery === 'whatsapp' && (
            <p className="text-xs text-theme-tertiary">
              Le lien sera envoyé dans le fil WhatsApp du client (validé par vous).
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {isCreating
              ? 'Envoi…'
              : delivery === 'whatsapp'
                ? 'Envoyer via WhatsApp'
                : 'Envoyer pour signature'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
