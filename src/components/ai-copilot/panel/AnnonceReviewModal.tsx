// Modal de revue-et-enregistrement d'une annonce rédigée par MEGGA AI (P2).
// Human-in-the-loop : l'agent RELIT et ÉDITE, puis enregistre l'annonce comme
// DESCRIPTION du bien ouvert. Ne touche PAS au statut de publication (la mise en
// ligne passe par le wizard, avec sa validation d'éligibilité) — décision produit
// pour ne pas court-circuiter les exigences (photos/prix…).

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { useUpdateProperty } from '@/hooks/useProperties'
import { CpIcon } from './panelIcons'
import { revueKit, type AiPalette } from './aiPanel'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface AnnonceReviewModalProps {
  open: boolean
  sp: AiPalette
  dark: boolean
  annonce: string
  /** Bien ouvert (fiche) → cible de l'enregistrement. Null = pas de bien en contexte. */
  listingId?: string | null
  onClose: () => void
  onSaved: () => void
}

export default function AnnonceReviewModal({ open, sp, dark, annonce, listingId, onClose, onSaved }: AnnonceReviewModalProps) {
  const toast = useToast()
  const refPiegeFocus = useFocusTrap(open, onClose)
  const updateProperty = useUpdateProperty()
  const [body, setBody] = useState(annonce)

  useEffect(() => {
    if (open) setBody(annonce)
  }, [open, annonce])

  const { data: property } = useQuery({
    queryKey: ['ai-annonce-property', listingId],
    enabled: open && !!listingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('title, city')
        .eq('id', listingId as string)
        .single()
      if (error) throw error
      return data as { title: string | null; city: string | null }
    },
  })

  if (!open) return null

  const hasTarget = !!listingId
  const canSave = hasTarget && body.trim().length > 0 && !updateProperty.isPending

  const save = async () => {
    if (!canSave) return
    try {
      await updateProperty.mutateAsync({ id: listingId as string, description: body })
      toast.success('Annonce enregistrée sur le bien', {
        description: property?.title || undefined,
        duration: 2800,
      })
      onSaved()
      onClose()
    } catch (e) {
      toast.error("Échec de l'enregistrement", { description: e instanceof Error ? e.message : 'Réessayez.' })
    }
  }


  const K = revueKit(sp)

  return createPortal(
    <div
      onClick={onClose}
      style={{
        ...K.scrim,
        animation: 'anrFade .2s ease both', padding: 20,
      }}
    >
      <style>{`@keyframes anrFade{from{opacity:0}to{opacity:1}}@keyframes anrUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        ref={refPiegeFocus}
        role="dialog"
        aria-modal="true"
        aria-label="Enregistrer l'annonce sur le bien"
        style={{
          ...K.carte,
          animation: 'anrUp .28s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={K.titre}>Utiliser sur le bien</span>
          <button onClick={onClose} title="Fermer" aria-label="Fermer" style={{
            width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer',
            background: 'transparent', display: 'grid', placeItems: 'center',
          }}>
            <CpIcon name="close" size={18} color={sp.sub} />
          </button>
        </div>

        {hasTarget ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CpIcon name="folder" size={15} color={sp.sub} sw={1.9} />
            <span style={{ fontSize: 'var(--crm-text-md)', color: sp.soft, fontWeight: 500 }}>
              {property?.title || 'Bien ouvert'}{property?.city ? ` · ${property.city}` : ''}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 'var(--crm-text-md)', color: sp.soft, background: K.champ.background, borderRadius: 12, padding: '11px 13px', lineHeight: 1.5 }}>
            Ouvrez d'abord une fiche bien pour y enregistrer cette annonce.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={K.libelle}>Annonce (deviendra la description du bien)</span>
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)} rows={11}
            style={{
              width: '100%', border: K.champ.border, outline: 'none', background: K.champ.background,
              borderRadius: 12, padding: '11px 13px', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)',
              color: sp.ink, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6, minHeight: 200,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <span style={K.aide}>
            La mise en ligne reste à faire dans la fiche bien (validation photos/prix).
          </span>
          <button onClick={onClose} style={{
            height: 40, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer',
            ...K.boutonFantome,
            background: dark ? 'rgba(255,255,255,0.06)' : '#F1F4F8',
          }}>Annuler</button>
          <button onClick={save} disabled={!canSave} style={{
            height: 40, padding: '0 20px', borderRadius: 999, border: 0,
            cursor: canSave ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
            background: canSave ? sp.accent : sp.fillStrong,
            color: canSave ? sp.onAccent : sp.sub, display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <CpIcon name={updateProperty.isPending ? 'draft' : 'check'} size={15} color={canSave ? sp.onAccent : sp.sub} sw={2.2} />
            {updateProperty.isPending ? 'Enregistrement…' : 'Enregistrer sur le bien'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
