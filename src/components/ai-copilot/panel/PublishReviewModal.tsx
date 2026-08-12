// Carte de validation d'une PUBLICATION immobilier.ch préparée par MEGGA AI (Phase C).
// Human-in-the-loop STRUCTUREL : le copilote a préparé l'action (aperçu déterministe de
// l'annonce, côté serveur) mais RIEN n'est envoyé au portail tant que l'agent ne clique
// pas « Publier ». Le clic appelle ai-copilot (action execute_pending) qui consomme la
// carte et rejoue la charge figée. Miroir visuel d'AnnonceReviewModal.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/ui/Toast'
import { CpIcon } from './panelIcons'
import type { AiPalette } from './aiPanel'
import type { PendingActionCard } from '@/hooks/useCopilot'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const PORTAL_LABELS: Record<string, string> = { immobilier_ch: 'immobilier.ch' }
const portalLabel = (p: string) => PORTAL_LABELS[p] ?? p

interface PublishReviewModalProps {
  open: boolean
  sp: AiPalette
  dark: boolean
  pending: PendingActionCard | null
  onClose: () => void
  /** Exécute l'action validée (clic « Publier »/« Retirer »). `ok` distingue succès et
   *  échec métier ; throw sur non-2xx (désactivée / carte expirée). */
  executePending: (id: string) => Promise<{ result: string; ok: boolean }>
  /** Appelé avec le texte de résultat après une exécution RÉUSSIE (bulle de confirmation). */
  onExecuted: (resultText: string) => void
}

export default function PublishReviewModal({ open, sp, dark, pending, onClose, executePending, onExecuted }: PublishReviewModalProps) {
  const toast = useToast()
  const refPiegeFocus = useFocusTrap(open, onClose)
  const [busy, setBusy] = useState(false)

  if (!open || !pending) return null

  const isWithdraw = pending.kind === 'withdraw'
  const heading = isWithdraw ? 'Retirer d’immobilier.ch' : 'Publier sur immobilier.ch'
  const cta = isWithdraw ? 'Retirer l’annonce' : 'Publier l’annonce'
  const portals = pending.portals.length ? pending.portals : ['immobilier_ch']

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { result, ok } = await executePending(pending.id)
      if (ok) {
        onExecuted(result || (isWithdraw ? 'Bien retiré.' : 'Bien publié.'))
        toast.success(isWithdraw ? 'Bien retiré du portail' : 'Bien envoyé au portail', {
          description: pending.title || undefined, duration: 2800,
        })
        onClose()
      } else {
        // Échec MÉTIER (bien passé hors-marché, erreur DB…) : rien n'est parti au portail.
        // Le serveur n'a pas consommé la carte → on la laisse ouverte pour réessayer/annuler.
        toast.error(isWithdraw ? 'Retrait non effectué' : 'Publication non effectuée', {
          description: result || 'Réessayez ou annulez.',
        })
      }
    } catch (e) {
      // Non-2xx : publication désactivée, ou carte expirée/introuvable → carte invalide.
      toast.error(isWithdraw ? 'Échec du retrait' : 'Échec de la publication', {
        description: e instanceof Error ? e.message : 'Réessayez.',
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const surface = dark ? '#17181C' : '#FFFFFF'
  const fieldBg = dark ? 'rgba(255,255,255,0.05)' : '#F4F6F9'
  const chipBg = dark ? 'rgba(127,176,255,0.12)' : 'rgba(30,91,198,0.08)'
  const chipInk = sp.aiInk
  const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: sp.sub } as const

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center',
        background: dark ? 'rgba(0,0,2,0.55)' : 'rgba(15,23,42,0.28)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        animation: 'prvFade .2s ease both', padding: 20,
        fontFamily: "'Inter Tight', system-ui, sans-serif",
      }}
    >
      <style>{`@keyframes prvFade{from{opacity:0}to{opacity:1}}@keyframes prvUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        ref={refPiegeFocus}
        role="dialog"
        aria-label={heading}
        style={{
          width: 'min(540px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: surface, borderRadius: 22, padding: '20px 22px 18px',
          boxShadow: dark ? '0 30px 80px -12px rgba(0,0,0,.7)' : '0 30px 80px -16px rgba(15,23,42,.28)',
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'prvUp .28s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: sp.ink, letterSpacing: -0.3, flex: 1 }}>{heading}</span>
          <button onClick={onClose} title="Fermer" aria-label="Fermer" style={{
            width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer',
            background: 'transparent', display: 'grid', placeItems: 'center',
          }}>
            <CpIcon name="close" size={18} color={sp.sub} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {portals.map((p) => (
            <span key={p} style={{
              fontSize: 12, fontWeight: 700, color: chipInk, background: chipBg,
              borderRadius: 999, padding: '4px 11px',
            }}>{portalLabel(p)}</span>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>{isWithdraw ? 'Action' : 'Aperçu de l’annonce'}</span>
          <div style={{
            background: fieldBg, borderRadius: 12, padding: '12px 14px', fontSize: 13.5,
            color: sp.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{pending.preview}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: sp.sub, flex: 1 }}>
            {isWithdraw
              ? 'Le bien disparaîtra au prochain import du portail.'
              : 'Rien n’est envoyé au portail tant que tu ne valides pas.'}
          </span>
          <button onClick={onClose} disabled={busy} style={{
            height: 40, padding: '0 18px', borderRadius: 999, border: 0, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: sp.soft,
            background: dark ? 'rgba(255,255,255,0.06)' : '#F1F4F8',
          }}>Annuler</button>
          <button onClick={confirm} disabled={busy} style={{
            height: 40, padding: '0 20px', borderRadius: 999, border: 0,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
            background: busy ? sp.fillStrong : sp.accent,
            color: busy ? sp.sub : sp.onAccent, display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <CpIcon name={busy ? 'draft' : 'check'} size={15} color={busy ? sp.sub : sp.onAccent} sw={2.2} />
            {busy ? 'Envoi…' : cta}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
