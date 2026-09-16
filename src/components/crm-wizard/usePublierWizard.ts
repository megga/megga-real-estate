/**
 * Publier (ou garder en brouillon) le bien saisi dans un wizard — le chemin UNIQUE.
 *
 * ⚠ Extrait de `WizardShell.handlePublish` le 16.09.2026, quand le « Nouveau bien » en
 * quatre étapes est né à côté de l'ancien wizard : deux copies de cette suite d'écritures
 * auraient divergé au premier correctif, et l'agent aurait publié autre chose selon le
 * parcours emprunté. Les deux écrans appellent ce hook.
 *
 * L'ordre des écritures, et pourquoi :
 *   1. le vendeur neuf est CRÉÉ d'abord (son id est lié au bien par une transaction) ;
 *   2. le bien : on ATTEND le brouillon automatique en vol, puis on met à jour la ligne
 *      qu'il a créée — sinon la publication sèmerait un doublon ;
 *   3. les vraies photos, qui exigent l'id du bien ;
 *   4. le lien vendeur, porté par `transactions` (le bien n'a pas de colonne vendeur).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateProperty, useUpdateProperty, useUploadPropertyPhotos } from '@/hooks/useProperties'
import { useCreateContact } from '@/hooks/useContacts'
import { useCreateTransaction } from '@/hooks/useTransactions'
import { useAuth } from '@/hooks/useAuth'
import type { WizardData } from './tokens'
import { wizardPayload } from './useWizardDraft'

/**
 * @param set   le setter partiel de l'état du wizard (le vendeur neuf y est remplacé
 *              par son id réel, pour qu'un nouvel essai ne le recrée pas).
 * @returns `publier(data, attendreEcriture, statut)` rend l'id du bien, ou `null` en
 *          cas d'échec — l'erreur, lisible, est dans `erreur`.
 */
export function usePublierWizard(set: (patch: Partial<WizardData>) => void) {
  const { t } = useTranslation('listings')
  const { profile } = useAuth()
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()
  const uploadPhotos = useUploadPropertyPhotos()
  const createContact = useCreateContact()
  const createTransaction = useCreateTransaction()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  /**
   * @param statut `active` publie ; `draft` enregistre tout — photos et vendeur compris —
   *               sans mettre en ligne (le bien reste Off-market, `published_at` vide).
   */
  async function publier(
    data: WizardData,
    attendreEcriture: () => Promise<string | null>,
    statut: 'active' | 'draft' = 'active',
  ): Promise<string | null> {
    if (enCours) return null
    setEnCours(true)
    setErreur(null)
    try {
      // 1) Le vendeur. Un vendeur neuf (`_newContact`, id synthétique) est créé d'abord.
      // Le test d'IDENTITÉ (ownerContactId === _newContact.id), et non de préfixe, ignore
      // un `_newContact` résiduel si l'agent a finalement choisi un contact existant.
      let sellerContactId: string | null = null
      if (data._newContact && data.ownerContactId === data._newContact.id) {
        // ⛔ L'id est posé ICI, pas relu dans la réponse : `useInsertMutation` ne rend pas
        // toujours la ligne créée (cf. `useCreateContact`). Relu, il valait `undefined`,
        // et le bien était publié SANS lien vendeur — sans erreur à l'écran.
        const id = crypto.randomUUID()
        await createContact.mutateAsync({
          id,
          firstName: data._newContact.firstName,
          lastName: data._newContact.lastName,
          email: data._newContact.email,
          phone: data._newContact.phone || undefined,
          type: 'seller',
          source: 'manual',
        })
        sellerContactId = id
        // Idempotence : un nouvel essai retombe sur la branche « contact existant ».
        set({ ownerContactId: id, _newContact: null, _ownerContact: null })
      } else if (data.ownerContactId) {
        sellerContactId = data.ownerContactId
      }

      // Photos réelles (dropzone) vs URLs déjà persistées. Une tuile sans `file` ni `url`
      // n'est JAMAIS persistée — aucune photo fabriquée sur l'annonce.
      const photoFiles = data.photos.map(p => p.file).filter((f): f is File => !!f)
      const existingPhotoUrls = data.photos.map(p => p.url).filter((u): u is string => !!u)

      // 2) Le bien. La charge utile est celle du brouillon (`wizardPayload`), sinon les
      // deux chemins divergeraient au premier champ ajouté.
      const charge = { ...wizardPayload(data, statut), photos: existingPhotoUrls }
      // ⛔ ON ATTEND L'ENREGISTREMENT AUTOMATIQUE AVANT DE LIRE L'IDENTIFIANT : une création
      // encore en vol laisserait `data._draftId` vide, et publier créerait le bien deux fois.
      const brouillonId = await attendreEcriture()
      const created = brouillonId
        ? await updateProperty.mutateAsync({ id: brouillonId, ...charge })
        : await createProperty.mutateAsync(charge)

      // 3) Les vraies photos, maintenant qu'on a l'id. Un échec d'envoi reste un
      // avertissement : le bien existe, l'agent complète depuis la fiche.
      if (photoFiles.length && profile?.agency_id) {
        try {
          const uploadedUrls = await uploadPhotos.mutateAsync({ propertyId: created.id, files: photoFiles })
          await updateProperty.mutateAsync({ id: created.id, photos: [...existingPhotoUrls, ...uploadedUrls] })
        } catch (photoErr) {
          console.warn('[wizard] photo upload failed:', photoErr)
        }
      }

      // 4) Le lien vendeur — dans `transactions`, le modèle du pipeline. Enum du mandat en
      // base : 'simple' | 'exclusive' | 'semi_exclusive' ; le wizard dit 'co' pour le dernier.
      if (sellerContactId && profile?.agency_id) {
        const mandateType = data.mandate?.type === 'co' ? 'semi_exclusive' : data.mandate?.type
        try {
          await createTransaction.mutateAsync({
            agency_id: profile.agency_id,
            property_id: created.id,
            contact_seller_id: sellerContactId,
            stage: data.mandate?.signed ? 'active_search' : 'new_lead',
            mandate_type: mandateType,
          })
        } catch (txErr) {
          console.warn('[wizard] vendor-link transaction failed:', txErr)
        }
      }
      return created.id
    } catch (e) {
      const message = e instanceof Error ? e.message : t('wizard.shell.unknownError')
      // Quota de plan tenu en base (audit S15) : le trigger lève un code, pas une phrase.
      setErreur(message.includes('plan_property_limit') ? t('wizard.shell.planLimit') : message)
      return null
    } finally {
      setEnCours(false)
    }
  }

  return { publier, enCours, erreur }
}
