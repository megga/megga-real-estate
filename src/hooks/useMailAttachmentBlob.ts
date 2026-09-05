/**
 * Une pièce jointe n'a PAS d'URL publique : on la lit par l'edge avec le JWT de
 * la session, en blob local. C'est aussi ce qui interdit qu'un lien fuite hors
 * de l'agence.
 */
import { useEffect, useState } from 'react'
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLIC_ANON_KEY } from '@/lib/supabase'

/** L'état d'une pièce en cours de lecture. */
interface EtatPiece {
  url: string | null
  /**
   * L'essence que le SERVEUR a servie, jamais celle que l'expéditeur déclarait.
   *
   * ⛔ `mail-attachment` rend l'essence d'origine pour la seule liste sûre (PDF,
   * PNG, JPEG, WebP, GIF, texte) et `application/octet-stream` pour TOUT le
   * reste — un SVG est un document scriptable, pas une image. Un aperçu qui
   * déciderait « c'est une image » sur `mail_attachments.mime_type` poserait
   * donc un `<img>` sur des octets que le serveur refuse d'afficher : une image
   * cassée servie en 200, le même mensonge que le logo absent.
   */
  type: string | null
  error: string | null
  loading: boolean
}

/** `{ url, type, error, loading }` — l'URL d'objet est révoquée au démontage. */
export function useMailAttachmentBlob(attachmentId: string | null) {
  const [state, setState] = useState<EtatPiece>({ url: null, type: null, error: null, loading: !!attachmentId })
  useEffect(() => {
    if (!attachmentId) return
    let url: string | null = null
    let cancelled = false
    void (async () => {
      setState({ url: null, type: null, error: null, loading: true })
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setState({ url: null, type: null, error: 'no_session', loading: false }); return }
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/mail-attachment?id=${encodeURIComponent(attachmentId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_PUBLIC_ANON_KEY },
      })
      if (cancelled) return
      // ⚠ 404 et non 403 pour une pièce d'une autre agence : un 403 confirmerait
      // que la ligne existe. Rien à distinguer ici, donc — « introuvable ».
      if (!res.ok) { setState({ url: null, type: null, error: `http_${res.status}`, loading: false }); return }
      const blob = await res.blob()
      url = URL.createObjectURL(blob)
      // `blob.type` EST l'en-tête `Content-Type` de la réponse : la décision du
      // serveur, pas la déclaration de l'expéditeur.
      setState({ url, type: blob.type || 'application/octet-stream', error: null, loading: false })
    })()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [attachmentId])
  return state
}
