/**
 * Brouillon automatique du wizard « Créer un bien ».
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Le pied du wizard affichait
 * « Enregistrement automatique » et faisait clignoter « Enregistré » à chaque
 * frappe — alors que RIEN n'était écrit. `createProperty` n'était appelé que
 * dans `handlePublish` : ni ligne en base, ni `localStorage`. Un agent qui
 * fermait l'onglet à l'étape 6 perdait tout, après avoir vu « Enregistré »
 * cinquante fois. Le témoin lit désormais l'état RÉEL de l'écriture.
 *
 * QUAND LA LIGNE EST CRÉÉE. À la première adresse saisie, pas avant. Deux
 * raisons : `properties.title` est NOT NULL et se synthétise depuis l'adresse ;
 * et créer dès l'ouverture sèmerait un brouillon sans nom dans « Mes biens »
 * pour chaque wizard ouvert puis refermé. Avant l'adresse, le témoin ne
 * promet rien — c'est le seul moment où il n'affiche rien.
 *
 * VERROU OPTIMISTE. Chaque mise à jour passe `expected_updated_at`. Si la
 * fiche a bougé ailleurs (autre onglet, édition depuis `/:id/edit`), la
 * requête ne matche aucune ligne et l'écriture échoue au lieu d'écraser :
 * l'état passe à `echec`, et le témoin le dit.
 *
 * ⚠ LE HOOK EST GÉNÉRIQUE, la charge utile ne l'est pas. Deux wizards écrivent
 * dans `properties` — celui du bureau (7 étapes, `WizardData`) et celui du
 * mobile (4 étapes, `WData`) — et leurs états n'ont ni les mêmes champs ni les
 * mêmes noms. Ce qui doit rester UNIQUE, c'est la mécanique d'écriture : le
 * verrou optimiste, la reprise de la passe arrivée en vol, le moment de la
 * première création. Chaque appelant apporte donc son `payload` ; le reste est
 * partagé. Écrire un second hook aurait dupliqué précisément la partie où les
 * bugs se logent.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCreateProperty, useUpdateProperty, type CreatePropertyInput } from '@/hooks/useProperties'
import type { WizardData } from './tokens'

/** Ce que le pied de page a le droit d'affirmer. */
export type EtatBrouillon = 'inactif' | 'enregistrement' | 'enregistre' | 'echec'

/** Délai après la dernière frappe avant d'écrire — une écriture par rafale de saisie. */
const REPOS_MS = 1200

/**
 * Type wizard (FR, 10 valeurs liste Gregory) → enum DB `property_type`
 * (EN : apartment|house|villa|commercial|land). Sans ce mapping, tout type non
 * couvert viole l'enum → l'insert échoue (22P02, avalé) et le bien n'est jamais
 * créé. Étendre AVEC le type union de `WizardData` (tokens.ts).
 *
 * ⚠ Vit ICI et nulle part ailleurs. Il existait en TRIPLE — une copie dans
 * `WizardShell`, une dans le wizard mobile (`WTYPE_TO_ENUM`) — et elles avaient
 * déjà divergé sur `villa`. Les deux copies sont parties (bureau le 11 août,
 * mobile le 12) ; le mobile importe désormais celle-ci, ses quatre types étant
 * un sous-ensemble des dix.
 */
export const TYPE_TO_ENUM: Record<WizardData['type'], CreatePropertyInput['type']> = {
  appartement: 'apartment', attique: 'apartment', duplex: 'apartment',
  triplex: 'apartment', loft: 'apartment', maison: 'house', villa: 'villa',
  chalet: 'house', terrain: 'land', commerce: 'commercial',
}

/**
 * Titre d'affichage synthétisé depuis les données saisies. La colonne est NOT
 * NULL ; l'agent renomme depuis la fiche s'il le souhaite.
 *
 * ⚠ Signature STRUCTURELLE, pas `WizardData` : le wizard mobile appelle la même
 * fonction avec son propre état, dont le `type` peut être nul (ses quatre
 * tuiles commencent non choisies). C'était la troisième copie de ces trois
 * lignes ; la garder en aurait fait une quatrième.
 */
export function wizardTitre(data: {
  type: WizardData['type'] | null
  rooms: number | null
  city?: string
  addr: string
}): string {
  return [
    data.type ? data.type.charAt(0).toUpperCase() + data.type.slice(1) : 'Bien',
    data.rooms ? `${data.rooms} pièces` : null,
    data.city || data.addr ? `— ${data.city || data.addr}` : null,
  ].filter(Boolean).join(' ')
}

/**
 * Charge utile `properties` dérivée de l'état du wizard.
 *
 * ⚠ Partagée par le brouillon ET la publication : deux constructions parallèles
 * divergeraient au premier champ ajouté, et le brouillon écrirait alors autre
 * chose que ce que l'agent voit publié. Les photos et le lien vendeur n'en font
 * PAS partie — ils exigent l'id du bien (upload) ou une ligne `transactions`,
 * et n'ont donc lieu qu'à la publication.
 */
export function wizardPayload(data: WizardData, status: 'draft' | 'active'): CreatePropertyInput {
  return {
    title: wizardTitre(data),
    type: TYPE_TO_ENUM[data.type] ?? 'apartment',
    transaction_type: data.transaction === 'location' ? 'rent' : 'buy',
    status,
    price: data.transaction === 'vente' ? (data.price ?? 0) : (data.rent ?? 0),
    rooms: data.rooms ?? 0,
    bedrooms: data.bedrooms ?? 0,
    bathrooms: data.bathrooms ?? 0,
    surface_m2: data.area ?? 0,
    floor: data.floor ?? undefined,
    total_floors: data.floorsTotal ?? undefined,
    year_built: data.year ?? undefined,
    charges_monthly: data.charges ?? undefined,
    mandate_type: data.mandate?.type,
    mandate_commission_pct: data.mandate?.commission ?? null,
    mandate_signed_at: data.mandate?.signed ? new Date().toISOString() : null,
    mandate_expires_at: data.mandate?.duration && data.mandate?.signed
      ? new Date(Date.now() + data.mandate.duration * 30 * 24 * 3600 * 1000).toISOString()
      : null,
    energy_class: data.energy ?? null,
    description: data.description || undefined,
    address: data.addr,
    city: data.city ?? '',
    canton: data.cantonShort ?? data.canton,
    postal_code: data.postCode,
    features: data.features,
  }
}

/**
 * Ce qu'un état de wizard doit porter pour être persistable : l'adresse, qui
 * déclenche la première écriture, et l'id de la ligne créée.
 */
export interface WizardDraftable {
  addr: string
  _draftId?: string
}

/**
 * Persiste l'état du wizard en brouillon, et rend ce que le témoin peut dire.
 *
 * @param data    état courant du wizard
 * @param set     applique un patch sur cet état (pour y ranger `_draftId`)
 * @param actif   faux pendant la publication et après — sinon la sauvegarde
 *                repasserait le bien en `draft` juste après l'avoir activé.
 *                Faux aussi dans les harnais de démonstration, qui n'écrivent
 *                jamais.
 * @param payload construit la charge `properties` depuis l'état. DOIT être
 *                défini au niveau module : une lambda recréée à chaque rendu
 *                changerait l'identité de `ecrire` sans raison.
 */
export function useWizardDraft<T extends WizardDraftable>(
  data: T,
  set: (patch: Partial<T>) => void,
  actif: boolean,
  payload: (d: T, status: 'draft' | 'active') => CreatePropertyInput,
): { etat: EtatBrouillon } {
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()

  const [etat, setEtat] = useState<EtatBrouillon>('inactif')
  /** `updated_at` de la dernière écriture réussie — jeton du verrou optimiste. */
  const version = useRef<string | null>(null)
  /** Empêche deux écritures concurrentes (la création surtout, qui doublerait la ligne). */
  const enVol = useRef(false)
  /**
   * ⛔ Une passe est arrivée pendant qu'une écriture était en vol.
   *
   * La première version faisait `if (enVol.current) return` — et cette passe
   * était perdue DÉFINITIVEMENT : rien ne la reprogrammait. Comme le témoin
   * gardait l'état `enregistre` de l'écriture précédente, il affichait
   * « Enregistré » sur des données jamais écrites. C'est-à-dire exactement le
   * défaut que ce fichier existe pour corriger, en plus discret : un témoin qui
   * dit vrai la plupart du temps est plus trompeur qu'un témoin qui ment
   * toujours, parce qu'on cesse de le vérifier.
   */
  const enAttente = useRef(false)
  /** Lu dans le timer sans le relancer à chaque frappe. */
  const dernier = useRef(data)
  dernier.current = data

  const ecrire = useCallback(async function ecrireImpl(): Promise<void> {
    if (enVol.current) { enAttente.current = true; return }
    const d = dernier.current
    if (!d.addr?.trim()) return
    enVol.current = true
    enAttente.current = false
    setEtat('enregistrement')
    try {
      if (!d._draftId) {
        const cree = await createProperty.mutateAsync(payload(d, 'draft'))
        version.current = cree.updated_at
        // `T` garantit `_draftId?: string`, mais TS ne sait pas prouver qu'un
        // littéral le satisfait pour un T quelconque.
        set({ _draftId: cree.id } as Partial<T>)
      } else {
        const maj = await updateProperty.mutateAsync({
          id: d._draftId,
          ...(version.current ? { expected_updated_at: version.current } : {}),
          ...payload(d, 'draft'),
        })
        version.current = (maj as { updated_at?: string })?.updated_at ?? null
      }
      setEtat('enregistre')
    } catch (err) {
      // Un échec doit se VOIR : c'est tout l'objet de ce fichier. Le conflit de
      // verrou (édition concurrente) tombe ici comme le reste.
      console.warn('[wizard] brouillon non enregistré:', err)
      setEtat('echec')
    } finally {
      enVol.current = false
      // La frappe survenue pendant l'écriture n'est pas perdue : on repart
      // aussitôt, avec `dernier.current` qui porte déjà la valeur à jour.
      if (enAttente.current) { enAttente.current = false; void ecrireImpl() }
    }
  }, [createProperty, updateProperty, set, payload])

  useEffect(() => {
    if (!actif || !data.addr?.trim()) return
    const t = setTimeout(() => { void ecrire() }, REPOS_MS)
    return () => clearTimeout(t)
    // `ecrire` lit `dernier.current` : le relancer à chaque frappe suffit, la
    // fonction elle-même n'a pas besoin d'être dans les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, data])

  return { etat }
}
