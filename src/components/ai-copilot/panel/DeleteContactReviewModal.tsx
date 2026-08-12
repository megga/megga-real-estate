// Carte de validation d'une SUPPRESSION de contact préparée par MEGGA AI.
// Human-in-the-loop STRUCTUREL, miroir de PublishReviewModal : le copilote a préparé
// l'action (aperçu déterministe côté serveur : ce qui part / ce qui survit) mais RIEN
// n'est supprimé tant que l'agent ne clique pas « Supprimer ». Le clic appelle ai-copilot
// (action execute_pending) qui consomme la carte et rejoue la charge figée (suppression
// DURE scopée à l'agence). Action IRRÉVERSIBLE → CTA destructif (rouge).

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/ui/Toast'
import { CpIcon } from './panelIcons'
import type { AiPalette } from './aiPanel'
import type { PendingActionCard } from '@/hooks/useCopilot'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// Rouge destructif fixe (hors palette d'accent) : signale l'irréversibilité en clair et
// vishue identique en clair/sombre. Le survol s'assombrit légèrement.
const DANGER = '#DC2626'
const DANGER_HOVER = '#B91C1C'

interface DeleteContactReviewModalProps {
  open: boolean
  sp: AiPalette
  dark: boolean
  pending: PendingActionCard | null
  onClose: () => void
  /** Exécute la suppression validée (clic « Supprimer »). `ok` distingue succès et échec
   *  métier (contact rattaché à des éléments à conserver) ; throw sur non-2xx (désactivée /
   *  carte expirée). */
  executePending: (id: string) => Promise<{ result: string; ok: boolean }>
  /** Appelé avec le texte de résultat après une suppression RÉUSSIE (bulle de confirmation). */
  onExecuted: (resultText: string) => void
}

export default function DeleteContactReviewModal({ open, sp, dark, pending, onClose, executePending, onExecuted }: DeleteContactReviewModalProps) {
  const toast = useToast()
  const refPiegeFocus = useFocusTrap(open, onClose)
  const [busy, setBusy] = useState(false)

  if (!open || !pending) return null

  const name = pending.title?.trim() || 'ce contact'

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { result, ok } = await executePending(pending.id)
      if (ok) {
        onExecuted(result || 'Contact supprimé.')
        toast.success('Contact supprimé', { description: pending.title || undefined, duration: 2800 })
        onClose()
      } else {
        // Échec MÉTIER (contact rattaché à une offre / un dossier vendeur / une conversation…) :
        // rien n'a été supprimé. Le serveur a réinséré la carte → on la laisse pour réessayer/annuler.
        toast.error('Suppression non effectuée', { description: result || 'Réessayez ou annulez.' })
      }
    } catch (e) {
      // Non-2xx : suppression désactivée, ou carte expirée/introuvable → carte invalide.
      toast.error('Échec de la suppression', { description: e instanceof Error ? e.message : 'Réessayez.' })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const surface = dark ? '#17181C' : '#FFFFFF'
  const fieldBg = dark ? 'rgba(255,255,255,0.05)' : '#F4F6F9'
  const chipBg = dark ? 'rgba(220,38,38,0.16)' : 'rgba(220,38,38,0.08)'
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
        aria-label="Supprimer le contact"
        style={{
          width: 'min(540px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: surface, borderRadius: 22, padding: '20px 22px 18px',
          boxShadow: dark ? '0 30px 80px -12px rgba(0,0,0,.7)' : '0 30px 80px -16px rgba(15,23,42,.28)',
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'prvUp .28s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: sp.ink, letterSpacing: -0.3, flex: 1 }}>Supprimer le contact</span>
          <button onClick={onClose} title="Fermer" aria-label="Fermer" style={{
            width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer',
            background: 'transparent', display: 'grid', placeItems: 'center',
          }}>
            <CpIcon name="close" size={18} color={sp.sub} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: DANGER, background: chipBg,
            borderRadius: 999, padding: '4px 11px',
          }}>Action irréversible</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Ce qui sera supprimé</span>
          <div style={{
            background: fieldBg, borderRadius: 12, padding: '12px 14px', fontSize: 13.5,
            color: sp.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{pending.preview}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: sp.sub, flex: 1 }}>
            Rien n’est supprimé tant que tu ne valides pas.
          </span>
          <button onClick={onClose} disabled={busy} style={{
            height: 40, padding: '0 18px', borderRadius: 999, border: 0, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: sp.soft,
            background: dark ? 'rgba(255,255,255,0.06)' : '#F1F4F8',
          }}>Annuler</button>
          <button
            onClick={confirm} disabled={busy}
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = DANGER_HOVER }}
            onMouseLeave={(e) => { if (!busy) e.currentTarget.style.background = DANGER }}
            style={{
              height: 40, padding: '0 20px', borderRadius: 999, border: 0,
              cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              background: busy ? sp.fillStrong : DANGER,
              color: busy ? sp.sub : '#FFFFFF', display: 'flex', alignItems: 'center', gap: 7,
            }}
            title={`Supprimer ${name}`}
          >
            <CpIcon name={busy ? 'draft' : 'check'} size={15} color={busy ? sp.sub : '#FFFFFF'} sw={2.2} />
            {busy ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
