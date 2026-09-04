/**
 * Une pièce jointe n'a PAS d'URL publique : on la lit par l'edge avec le JWT de
 * la session, en blob local. C'est aussi ce qui interdit qu'un lien fuite hors
 * de l'agence.
 */
import { useEffect, useState } from 'react'
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLIC_ANON_KEY } from '@/lib/supabase'

/** `{ url, error, loading }` — l'URL d'objet est révoquée au démontage. */
export function useMailAttachmentBlob(attachmentId: string | null) {
  const [state, setState] = useState<{ url: string | null; error: string | null; loading: boolean }>({ url: null, error: null, loading: !!attachmentId })
  useEffect(() => {
    if (!attachmentId) return
    let url: string | null = null
    let cancelled = false
    void (async () => {
      setState({ url: null, error: null, loading: true })
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setState({ url: null, error: 'no_session', loading: false }); return }
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/mail-attachment?id=${encodeURIComponent(attachmentId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_PUBLIC_ANON_KEY },
      })
      if (cancelled) return
      // ⚠ 404 et non 403 pour une pièce d'une autre agence : un 403 confirmerait
      // que la ligne existe. Rien à distinguer ici, donc — « introuvable ».
      if (!res.ok) { setState({ url: null, error: `http_${res.status}`, loading: false }); return }
      url = URL.createObjectURL(await res.blob())
      setState({ url, error: null, loading: false })
    })()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [attachmentId])
  return state
}
