/**
 * Le fil de notes d'un contact (`contact_notes`, migration 20260916150000).
 *
 * Lecture : toutes les notes du contact, les plus récentes d'abord, avec le nom de leur
 * auteur. Écriture : ajouter une note, modifier ou supprimer une note — la base ne
 * laisse toucher qu'à SES notes d'agent (RLS), et pose elle-même l'auteur et les dates.
 *
 * ⚠ `contacts.notes` n'est plus écrit par le CRM : c'est un RÉSUMÉ que la base recalcule
 * à chaque note (lu par le copilote et l'agent WhatsApp). D'où l'invalidation de la fiche
 * après chaque geste — sa copie en cache porterait l'ancien résumé.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export type ContactNoteAuthorKind = 'user' | 'ai' | 'system'

/** Une note telle que la fiche l'affiche. */
export interface ContactNoteView {
  id: string
  body: string
  authorKind: ContactNoteAuthorKind
  /** Nom de l'agent auteur ; `null` pour MEGGA AI, le système, ou un compte supprimé. */
  authorName: string | null
  /** Note d'agent écrite par l'utilisateur connecté — la seule qu'il peut modifier. */
  mine: boolean
  createdAt: string
  /** Dernière modification du texte, `null` si jamais modifiée. */
  updatedAt: string | null
}

interface LigneNote {
  id: string
  body: string
  author_id: string | null
  author_kind: string
  created_at: string
  updated_at: string | null
  author: { full_name: string | null } | null
}

const cle = (contactId: string) => ['contact-notes', contactId] as const

/** Fil de notes d'un contact, et ses trois gestes. */
export function useContactNotes(contactId: string | undefined) {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  const moi = user?.id ?? null
  const agencyId = profile?.agency_id ?? null

  const query = useQuery({
    queryKey: cle(contactId ?? ''),
    enabled: !!contactId,
    queryFn: async (): Promise<ContactNoteView[]> => {
      const { data, error } = await supabase
        .from('contact_notes')
        // ⚠ Clé étrangère NOMMÉE : `contact_notes` pointe deux fois vers `profiles`
        // (auteur, demandeur d'une note IA) — sans le nom, l'embarquement est ambigu.
        .select('id, body, author_id, author_kind, created_at, updated_at, author:profiles!contact_notes_author_id_fkey(full_name)')
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as unknown as LigneNote[]).map((n) => ({
        id: n.id,
        body: n.body,
        authorKind: n.author_kind === 'ai' || n.author_kind === 'system' ? n.author_kind : 'user',
        authorName: n.author?.full_name?.trim() || null,
        mine: n.author_kind === 'user' && !!moi && n.author_id === moi,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      }))
    },
  })

  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: cle(contactId ?? '') })
    // Le résumé `contacts.notes` a changé côté base.
    await qc.invalidateQueries({ queryKey: ['contacts-screen'] })
  }

  const add = useMutation({
    mutationFn: async (body: string) => {
      if (!contactId || !agencyId) throw new Error('contact ou agence manquant')
      const { error } = await supabase.from('contact_notes').insert({ agency_id: agencyId, contact_id: contactId, body })
      if (error) throw error
    },
    onSuccess: rafraichir,
  })

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      // `select` pour SAVOIR si la ligne a été modifiée : une note qui n'est pas la sienne
      // n'est pas une erreur pour PostgREST, juste zéro ligne — l'écran doit le dire.
      const { data, error } = await supabase.from('contact_notes').update({ body }).eq('id', id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('note non modifiable')
    },
    onSuccess: rafraichir,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('contact_notes').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('note non supprimable')
    },
    onSuccess: rafraichir,
  })

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    add: (body: string) => add.mutateAsync(body),
    update: (id: string, body: string) => update.mutateAsync({ id, body }),
    remove: (id: string) => remove.mutateAsync(id),
  }
}
