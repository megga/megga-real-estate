/**
 * « Nouveau bien » — combien d'acquéreurs compatibles le moteur a trouvés pour un mandat qu'on vient de mettre en
 * service, EN DIRECT (lot D1, conception §7) : `matches` est dans la publication Realtime, et le moteur les écrit
 * quelques secondes après la mise en service (`on_property_active`).
 *
 * ⚠ Canal nommé par `useId()` (CLAUDE.md §4) : sans lui, un remontage recréerait un canal du même nom. Le bien est
 * aussi dans le nom : un second bien créé sans remontage (« Créer un autre bien ») ferait rendre à realtime-js le canal
 * du premier, en cours de fermeture sous le même nom, et le nouvel abonnement resterait muet.
 * ⚠ `lire` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * le module des gestes (`matchingGestes`) : ni « Nouveau bien » ni Mes biens n'ont à le charger.
 */
import { useEffect, useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { lire } from '@/components/matching-fil/filModele'
import { STATUTS_COMPATIBLES } from '@/components/matching-fil/filQuiPour'
import { DELAI_RECHERCHE_MS, etatAcquereurs, type EtatAcquereurs } from '@/components/crm/biens/nouveau/acquereurs'

/** La fenêtre de regroupement des événements du canal : le bloc du moteur arrive en quelques millisecondes. */
const REGROUPEMENT_MS = 300

/** Les acquéreurs compatibles d'un mandat mis en service ; `null` : rien n'est écouté. */
export function useAcquereursNouveauMandat(propertyId: string | null): EtatAcquereurs {
  const qc = useQueryClient()
  const canal = useId()
  // L'id du bien dont le délai est passé ET relu : un autre bien repart de zéro.
  const [ecoule, setEcoule] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['nouveau-mandat-acquereurs', propertyId],
    enabled: !!propertyId,
    // `signal` : une lecture qu'on annule s'arrête vraiment, au lieu de finir pour rien. Le moteur écrit ses matchs d'un
    // bloc, un par contact compatible — il en fabrique un par recherche, mais l'index `uq_matches_contact_property` jette
    // le doublon, et une ligne écartée n'émet aucun événement.
    queryFn: async ({ signal }) => {
      const lignes = await lire<{ contact_id: string }>(supabase.from('matches')
        .select('contact_id').eq('property_id', propertyId!).in('status', STATUTS_COMPATIBLES).limit(500)
        .abortSignal(signal))
      return new Set(lignes.map((l) => l.contact_id)).size
    },
  })
  useEffect(() => {
    if (!propertyId) return
    const cle = ['nouveau-mandat-acquereurs', propertyId]
    // ⛔ « Aucun » se conclut sur une LECTURE, jamais sur la seule minuterie. TanStack n'annule une lecture en cours que
    // si la requête a déjà une donnée : une invalidation reçue pendant la PREMIÈRE lecture se fond dans celle-ci, dont
    // l'instantané précède l'écriture du moteur, et son succès efface l'invalidation. Et un canal qui n'adhère pas
    // (`CHANNEL_ERROR`, `TIMED_OUT`) ne relit rien. La relecture du délai rattrape les deux, et une erreur passagère.
    const delai = setTimeout(() => {
      void qc.refetchQueries({ queryKey: cle }).finally(() => setEcoule(propertyId))
    }, DELAI_RECHERCHE_MS)
    // L'abonnement établi, puis chaque événement : regroupés, puis ANNULER avant d'invalider. L'annulation relance une
    // lecture même pendant la première (sans elle, l'invalidation s'y fondrait) ; le regroupement fait de la rafale du
    // moteur UNE lecture, au lieu de N dont N−1 annulées.
    let regroupement: ReturnType<typeof setTimeout> | undefined
    const relire = () => {
      clearTimeout(regroupement)
      regroupement = setTimeout(() => {
        void qc.cancelQueries({ queryKey: cle }).then(() => qc.invalidateQueries({ queryKey: cle }))
      }, REGROUPEMENT_MS)
    }
    const channel = supabase
      .channel(`nouveau-mandat-${canal}-${propertyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `property_id=eq.${propertyId}` }, relire)
      // Une reconnexion repasse aussi par `SUBSCRIBED` : ce qui s'est écrit pendant la coupure est relu.
      .subscribe((statut) => { if (statut === 'SUBSCRIBED') relire() })
    return () => {
      clearTimeout(delai)
      clearTimeout(regroupement)
      supabase.removeChannel(channel)
    }
  }, [propertyId, canal, qc])
  // `propertyId != null` : sans bien, `ecoule` et `propertyId` valent tous deux `null` — rien n'est écouté, rien n'est
  // donc « écoulé », et la ligne ne dirait pas « aucun » d'un bien qu'elle n'a jamais cherché.
  return etatAcquereurs(q.data ?? null, propertyId != null && ecoule === propertyId, q.isError)
}
