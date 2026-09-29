// MEGGA CRM — Fiche contact « Pager » (refonte Claude Design, conteneur).
// Monte le chrome Sugar puis le pager 2 pages (Ses informations ↕ Boucle de
// match). Normalise le Contact Supabase → FicheContact et câble la persistance
// (édition inline, invalidation KYC à l'édition d'identité vérifiée, suppression).
// Décision produit : FIDÈLE STRICT au design (fiche minimale, pas de cartes hors-design).
// Réf. handoff : crm-screen-contact-detail-pager.jsx.
//
// NB : l'ancienne fiche (cartes Cd* de crm-sugar-v3/contact-detail/) a été
// SUPPRIMÉE (fiche strict-faithful minimale, nouvelle version finale). Les
// hooks/service de ses features (signature Skribble, fil WhatsApp, insight IA,
// relances, docs, score de contact) restent dans src/hooks/* — sans caller UI
// desktop pour l'instant — prêts à re-câbler si on ré-expose ces surfaces.

import { type ReactNode, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { crmPalette } from '@/components/crm/tokens'
import { useCrmTabsOptionnel, useTabLabel } from '@/hooks/useCrmTabs'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { useContact, useUpdateContact, useDeleteContact } from '@/hooks/useContacts'
import { useContactSentMatches } from '@/hooks/useContactSentMatches'
import { useKycDossierByContact, useInvalidateKycForContact } from '@/hooks/useKycDossier'
import type { Contact } from '@/types/contact'
import { buildSearchCriteria, parseSearchCriteria, type CriteriaInput } from '@/lib/contactCriteria'
import { formatSwissDate, identityToColumns } from '@/lib/contactIdentity'
import { porteDemande, rolesOrdonnes } from '@/lib/contactRoles'
import { mapKycStatus, pickAvatarBg } from '@/lib/crmAdapters'
import type { KycDossierStatus } from '@/types/kyc'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { supabase } from '@/lib/supabase'
import ContactDetailPager, { type FicheContact } from '@/components/crm/contacts-pager/ContactDetailPager'
import { construireSaBoucle } from '@/components/crm/contacts-pager/saBoucle'
import { useContactNotes } from '@/hooks/useContactNotes'
import { useCrmDarkPref } from '@/lib/crmDark'
import { avecArrivee } from '@/lib/jetonArrivee'

export default function ContactDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t: tr } = useTranslation('contacts')

  const [dark, setDark] = useCrmDarkPref()
  const sp = crmPalette(dark)

  const { data: fetched, isLoading } = useContact(id)
  // La suppression retire la ligne du cache : sans cet instantané pris juste avant
  // la mutation, le pager serait démonté avant d'avoir pu afficher sa carte
  // « Contact supprimé » (le retour à la liste est piloté par onBack, ~1,1 s plus tard).
  const [ghost, setGhost] = useState<Contact | null>(null)
  const contact = fetched ?? ghost
  // Le libellé de l'onglet, donné par l'écran qui a déjà la donnée en main.
  // Le serveur sait aussi le résoudre (`crm_tabs_resolve_labels`, pour les onglets
  // restaurés qu'on n'a pas encore ouverts) ; ici c'est immédiat et sans requête.
  useTabLabel(contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : null)
  const boucle = useContactSentMatches(id)
  // « Sa boucle » (lot D1) : le modèle pur ; l'identité de l'acheteur nomme un bien revenu (« Refusé par Antoine … »).
  // `chargeLe` est l'heure de la lecture : c'est contre elle que se juge un report, comme dans le fil.
  const loop = useMemo(() => construireSaBoucle(boucle.lignes, boucle.criteres, {
    id: id ?? '', prenom: contact?.first_name ?? '', nom: contact?.last_name ?? '', telephone: null, email: null, kyc: 'none',
  }, boucle.chargeLe), [boucle.lignes, boucle.criteres, boucle.chargeLe, id, contact?.first_name, contact?.last_name])
  // En lecture, ou en échec sans rien de lu, la boucle est INCONNUE, pas vide. Des lignes déjà lues restent montrées
  // quand une relecture échoue : elles valent mieux qu'un écran d'erreur.
  const lectureBoucle = boucle.isLoading ? 'chargement' : boucle.isError && boucle.chargeLe === 0 ? 'erreur' : 'pret'
  const { data: kyc } = useKycDossierByContact(id)
  const notesFil = useContactNotes(id)
  // Écrire au contact depuis l'en-tête : dans la Messagerie si une boîte est connectée
  // (le courrier part de chez l'agent et se range sur la fiche), sinon `mailto:`.
  const boites = useMailAccounts()
  const onglets = useCrmTabsOptionnel()
  const update = useUpdateContact()
  const del = useDeleteContact()
  const invalidateKyc = useInvalidateKycForContact()
  const qc = useQueryClient()
  // La liste (useContactsScreen) est un useQuery « plain » ['contacts-screen'] que
  // les mutations cache-helpers n'invalident PAS → on la rafraîchit à la main
  // après chaque écriture (sinon suppression = ligne fantôme, édition non reflétée).
  const refreshList = () => { void qc.invalidateQueries({ queryKey: ['contacts-screen'] }) }

  const shell = (inner: ReactNode) => (
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: sp.ink,
    }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace active="contacts" sp={sp} dark={dark} setDark={setDark}>
        {inner}
        </CrmWorkspace>
      </div>
    </div>
  )

  if (isLoading && !contact) {
    return shell(
      <main style={{ flex: 1, display: 'grid', placeItems: 'center', color: sp.sub, fontSize: 'var(--crm-text-lg)', fontWeight: 500 }}>
        {tr('cd.loading')}
      </main>,
    )
  }
  // `contact` retombe sur l'instantané de suppression : une erreur de refetch après
  // le DELETE ne doit pas remplacer la carte de confirmation par « introuvable ».
  if (!contact) {
    return shell(
      <main style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 500, color: sp.ink }}>{tr('detail.notFound')}</div>
          <button onClick={() => navigate('/dashboard/contacts')} style={{
            marginTop: 14, height: 36, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, background: sp.accent, color: sp.accentInk,
          }}>{tr('detail.backToContacts')}</button>
        </div>
      </main>,
    )
  }

  // ── Normalisation Contact → FicheContact ─────────────────────────────
  const fd = (contact.form_data ?? {}) as Record<string, unknown>
  // Étape 3 : les rôles font foi. `type` en dérive (déclencheur `contacts_roles_sync`) et
  // continue d'orienter ce qui n'a qu'un côté de marché — l'audience, donc le CTA du héro.
  const roles = rolesOrdonnes(contact.roles)
  const critEnregistres = parseSearchCriteria(contact.search_criteria)
  /**
   * « Il a DÉJÀ des critères » — au moins un champ substantiel d'enregistré.
   * ⚠ `transaction` en est exclue À DESSEIN : `parseSearchCriteria` la rend toujours
   * ('vente' par défaut, même sur un `null`), donc la compter ferait passer TOUT contact
   * côté demande et la disjonction ci-dessous n'aurait plus de second terme.
   */
  const aDesCriteres =
    [critEnregistres.budgetMin, critEnregistres.budgetMax, critEnregistres.roomsMin,
      critEnregistres.areaMin, critEnregistres.bedroomsMin, critEnregistres.conditionMin].some((x) => x != null)
    || [critEnregistres.types, critEnregistres.cantons, critEnregistres.cities, critEnregistres.mustHave].some((l) => (l?.length ?? 0) > 0)
    || critEnregistres.offMarketOnly === true
  /**
   * Côté DEMANDE : la SEULE dérivation qui décide où les critères s'ÉCRIVENT, d'où ils se
   * LISENT, et quel bloc la fiche AFFICHE. Elle remplace deux règles qui divergeaient (la
   * création regardait `buyer|tenant`, la fiche « tout sauf seller|landlord ») — un vendeur
   * qui achète a désormais les deux : ses critères dans `search_criteria`, son bien dans
   * `form_data.offer`.
   *
   * ⚠ C'est une DISJONCTION, et le second terme n'est pas un confort (conception §6, repris
   * dans le docstring de `porteDemande`) : `porteDemande` SEUL masquerait les critères d'un
   * contact repassé à `{seller}`, qui les a pourtant — et masquer une donnée saisie est pire
   * qu'un formulaire de trop.
   *
   * ⛔ À NE PAS confondre avec `audience`, juste dessous : « que cherche cette personne » et
   * « que fait-on avec elle » sont deux questions. L'audience garde le CTA et le budget.
   */
  const coteDemande = porteDemande(roles) || aDesCriteres
  const isTenant = contact.type === 'tenant' || contact.search_criteria?.transaction_type === 'rent'
  const audience: FicheContact['audience'] =
    contact.type === 'seller' ? 'Vendeur'
      : contact.type === 'landlord' ? 'Bailleur'
        : isTenant ? 'Locataire'
          : 'Acheteur'
  const fiche: FicheContact = {
    id: contact.id,
    firstName: contact.first_name,
    lastName: contact.last_name,
    verified: kyc?.dossier_status === 'verified',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    // La langue vit dans form_data.lang (la table contacts n'a PAS de colonne
    // `language` en prod) — cohérent avec le flux de création.
    lang: typeof fd.lang === 'string' ? fd.lang : 'fr',
    civ: typeof fd.civility === 'string' ? fd.civility : '',
    canal: typeof fd.canal === 'string' ? fd.canal : '',
    audience,
    roles,
    isTenant,
    avatarBg: pickAvatarBg(contact.id),
    // Identité LBA : vraies colonnes (migration 20260718160000), pas form_data.
    // La base stocke une date ISO ; l'UI manipule le format suisse JJ.MM.AAAA.
    birth: formatSwissDate(contact.birth_date),
    nationality: contact.nationality ?? '',
    residence: contact.residence_country ?? '',
    homeAddress: contact.home_address ?? '',
    photo: typeof fd.photo === 'string' ? fd.photo : null,
    // Côté demande : critères depuis search_criteria (matching). Sinon, le « bien proposé »
    // est lu dans form_data.offer (pas de matching) → symétrie lecture/écriture/affichage,
    // sinon l'édition ne se ré-affiche pas. ⚠ La lecture est passée à `coteDemande` EN MÊME
    // TEMPS que l'écriture, et pas seulement par souci de symétrie : laissée sur `type`, un
    // contact `{landlord, investor}` (type dérivé `landlord`) aurait vu ses critères écrits
    // dans `search_criteria` et relus dans `form_data.offer`.
    crit: !coteDemande && fd.offer ? (fd.offer as CriteriaInput) : critEnregistres,
    coteDemande,
    notes: contact.notes ?? '',
    kycStatus: mapKycStatus((kyc?.dossier_status ?? undefined) as KycDossierStatus | undefined),
    lastContactAt: contact.last_interaction_at ?? null,
  }
  const ecrire = () => {
    const email = contact.email?.trim()
    if (!email) return
    if (boites.list.length === 0) { window.location.href = `mailto:${email}`; return }
    // Un jeton par demande : la Messagerie n'ouvre le composeur qu'une fois par clic,
    // même si l'onglet est remonté (cf. `?add=` des Réglages).
    // Chemin écrit EN LITTÉRAL au point de navigation : la garde des redirections ouvertes
    // (`redirection-ouverte.spec.ts`) y lit une destination interne, pas une variable.
    const requete = `ecrire=${encodeURIComponent(email)}&j=${Date.now().toString(36)}`
    if (onglets) onglets.ouvrirDans(`/dashboard/messagerie?${requete}`)
    else navigate(`/dashboard/messagerie?${requete}`)
  }

  return shell(
    <ContactDetailPager
      fiche={fiche}
      loop={loop}
      lectureBoucle={lectureBoucle}
      onReessayer={() => { void boucle.refetch() }}
      sp={sp}
      dark={dark}
      onBack={() => navigate('/dashboard/contacts')}
      onSaveIdentity={async (v) => {
        const cols = identityToColumns(v)
        // `roles` fait foi ; `type` n'est PAS écrit ici — le déclencheur `contacts_roles_sync`
        // le pose d'après eux. L'écrire à la main ferait deux écrivains pour une colonne.
        await update.mutateAsync({ id, first_name: v.firstName, last_name: v.lastName, roles: v.roles, ...cols })
        // `kyc_cases.contact_nationality` est une COPIE dénormalisée qui alimente le
        // scoring de risque pays : la laisser périmée est un défaut de conformité.
        // Les triggers kyc_cases ne bloquent que les DELETE et le passage manuel à
        // `verified` — un UPDATE de cette seule colonne passe.
        // Borné aux dossiers encore ouverts : un dossier validé porte une nationalité
        // constatée au moment du screening (avec son risk_score et ses résultats
        // PEP/sanctions). La réécrire laisserait un dossier « vérifié » dont l'identité
        // ne correspond plus aux contrôles qui l'ont validé. C'est à l'invalidation
        // (onInvalidateKyc, verified→pending) de rouvrir le dossier d'abord.
        // On ne propage QU'UNE nationalité renseignée. Effacer le champ sur la fiche
        // ne constate rien : pousser NULL ici ferait retomber le screening sur son
        // défaut `?? 'CH'` (kyc-screening/index.ts), et un ressortissant d'une
        // juridiction FATF haut risque perdrait son drapeau sans la moindre trace.
        if (cols.nationality && cols.nationality !== (contact.nationality ?? null)) {
          const { error } = await supabase
            .from('kyc_cases')
            .update({ contact_nationality: cols.nationality })
            .eq('contact_id', id)
            .is('validated_at', null)
          if (error) throw error
        }
        refreshList()
      }}
      onInvalidateKyc={async () => {
        if (user?.id) await invalidateKyc.mutateAsync({ contactId: id, actorId: user.id })
      }}
      onSaveCoord={async (v) => {
        // Pas de colonne `language` en base : la langue va dans form_data.lang.
        await update.mutateAsync({
          id,
          email: v.email || null,
          phone: v.phone || null,
          form_data: { ...fd, civility: v.civ, canal: v.canal, lang: v.lang },
        })
        refreshList()
      }}
      onSaveCriteria={async (c) => {
        // Seuls les critères d'un contact côté DEMANDE (acquéreur, locataire, investisseur)
        // partent dans search_criteria — ce qui déclenche l'auto-matching via le pont DB.
        // Sans rôle de demande, ce sont les caractéristiques du bien qu'il PROPOSE : les
        // écrire dans search_criteria le ferait matcher comme acquéreur. On les range donc
        // dans form_data.offer (aucun matching). Même test que la lecture de `fiche.crit`
        // et que le bloc affiché — une dérivation, trois usages.
        if (!coteDemande) {
          await update.mutateAsync({ id, form_data: { ...fd, offer: c } })
        } else {
          await update.mutateAsync({ id, search_criteria: buildSearchCriteria(c) })
        }
        refreshList()
      }}
      // Le FIL de notes (`contact_notes`). Écritures NUES, promesses rendues : le pager
      // attend chaque geste et en montre l'issue. `contacts.notes` n'est plus écrit
      // ici — la base en tient le résumé.
      noteThread={notesFil.notes}
      onAddNote={async (body) => { await notesFil.add(body) }}
      onUpdateNote={async (noteId, body) => { await notesFil.update(noteId, body) }}
      onDeleteNote={async (noteId) => { await notesFil.remove(noteId) }}
      // Pas de navigate ici : le pager affiche « Contact supprimé » puis appelle
      // onBack (naviguer tout de suite démonterait la carte avant qu'on la voie).
      onDelete={async () => { setGhost(contact); await del.mutateAsync(id); refreshList() }}
      onOpenKyc={() => navigate(`/dashboard/kyc?openContactId=${id}`)}
      onEmail={ecrire}
      onOpenMatching={() => navigate(`/dashboard/matching?contact=${id}`, avecArrivee())}
      onOpenListings={() => navigate('/dashboard/listings')}
      // Chaque bien de « Sa boucle » ouvre SA place dans le fil. ⛔ Gabarit ANCRÉ : `redirection-ouverte.spec.ts`.
      onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`, avecArrivee())}
    />,
  )
}
