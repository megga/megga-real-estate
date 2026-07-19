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

import { type ReactNode, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import { SugarTopNav, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { SugarIconRail } from '@/components/crm-sugar/LiquidGlassRail'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { useAuth } from '@/hooks/useAuth'
import { useContact, useUpdateContact, useDeleteContact } from '@/hooks/useContacts'
import { useContactSentMatches } from '@/hooks/useContactSentMatches'
import { useKycDossierByContact, useInvalidateKycForContact } from '@/hooks/useKycDossier'
import type { Contact } from '@/types/contact'
import { buildSearchCriteria, parseSearchCriteria, type CriteriaInput } from '@/lib/contactCriteria'
import { formatSwissDate, identityToColumns } from '@/lib/contactIdentity'
import { pickAvatarBg } from '@/lib/sugarAdapters'
import { supabase } from '@/lib/supabase'
import ContactDetailPager, {
  type FicheContact,
  type FicheNba,
} from '@/components/crm-sugar/contacts-pager/ContactDetailPager'
import { useContactNextAction } from '@/hooks/useContactNextAction'
import { nbaToI18n } from '@/lib/contactNba'

const DARK_TONE: DarkTone = 'meggaAi'

export default function ContactDetailSugarV3Page() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t: tr } = useTranslation('contacts')

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  const { data: fetched, isLoading } = useContact(id)
  // La suppression retire la ligne du cache : sans cet instantané pris juste avant
  // la mutation, le pager serait démonté avant d'avoir pu afficher sa carte
  // « Contact supprimé » (le retour à la liste est piloté par onBack, ~1,1 s plus tard).
  const [ghost, setGhost] = useState<Contact | null>(null)
  const contact = fetched ?? ghost
  const loop = useContactSentMatches(id)
  const { data: kyc } = useKycDossierByContact(id)
  // NBA (cerveau partagé) — best-effort : null si RPC absent/erreur, la fiche vit sans.
  const { data: nbaRaw } = useContactNextAction(id)
  const update = useUpdateContact()
  const del = useDeleteContact()
  const invalidateKyc = useInvalidateKycForContact()
  const qc = useQueryClient()
  // La liste (useContactsSugar) est un useQuery « plain » ['contacts-sugar'] que
  // les mutations cache-helpers n'invalident PAS → on la rafraîchit à la main
  // après chaque écriture (sinon suppression = ligne fantôme, édition non reflétée).
  const refreshList = () => { void qc.invalidateQueries({ queryKey: ['contacts-sugar'] }) }
  // Note : sauvegarde auto débouncée (le textarea émet à chaque frappe).
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onCmd = () => openSugarSearch()
  const onNavigate = (screen: SugarScreenId | string) => {
    switch (screen) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/network'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  const shell = (inner: ReactNode) => (
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: 'Inter Tight, system-ui, sans-serif', color: sp.ink,
    }}>
      <SugarTopNav active="contacts" t={t} sp={sp} dark={dark} onNavigate={onNavigate} onCmd={onCmd} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="contacts" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
        {inner}
      </div>
    </div>
  )

  if (isLoading && !contact) {
    return shell(
      <main style={{ flex: 1, display: 'grid', placeItems: 'center', color: sp.sub, fontSize: 14, fontWeight: 600 }}>
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
          <div style={{ fontSize: 16, fontWeight: 700, color: sp.ink }}>{tr('detail.notFound')}</div>
          <button onClick={() => navigate('/dashboard/contacts')} style={{
            marginTop: 14, height: 36, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: sp.ink, color: sp.pageBg,
          }}>{tr('detail.backToContacts')}</button>
        </div>
      </main>,
    )
  }

  // ── Normalisation Contact → FicheContact ─────────────────────────────
  const fd = (contact.form_data ?? {}) as Record<string, unknown>
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
    isTenant,
    avatarBg: pickAvatarBg(contact.id),
    // Identité LBA : vraies colonnes (migration 20260718160000), pas form_data.
    // La base stocke une date ISO ; l'UI manipule le format suisse JJ.MM.AAAA.
    birth: formatSwissDate(contact.birth_date),
    nationality: contact.nationality ?? '',
    residence: contact.residence_country ?? '',
    homeAddress: contact.home_address ?? '',
    photo: typeof fd.photo === 'string' ? fd.photo : null,
    // Acheteur/Locataire : critères depuis search_criteria (matching). Vendeur/
    // Bailleur : le « bien proposé » est écrit dans form_data.offer (pas de
    // matching) → symétrie lecture/écriture, sinon l'édition ne se ré-affiche pas.
    crit: (contact.type === 'seller' || contact.type === 'landlord') && fd.offer
      ? (fd.offer as CriteriaInput)
      : parseSearchCriteria(contact.search_criteria),
    notes: contact.notes ?? '',
  }

  // ── NBA → ligne du héro (chaînes traduites ici ; le pager reste présentationnel).
  // `none` → null (sobre, pas de bruit « aucune action »).
  const nbaI = nbaRaw ? nbaToI18n(nbaRaw) : null
  const nba: FicheNba | null = nbaI
    ? {
        label: tr(nbaI.key, nbaI.params as Record<string, string | number>),
        estimateTag: tr('nba.estimateTag'),
        kycNote: nbaRaw?.hasKycNote ? tr('nba.kycNote') : null,
      }
    : null

  return shell(
    <ContactDetailPager
      fiche={fiche}
      nba={nba}
      loop={{ items: loop.items, pendingLikes: loop.pendingLikes, transmitted: loop.transmitted, opened: loop.opened }}
      sp={sp}
      dark={dark}
      onBack={() => navigate('/dashboard/contacts')}
      onSaveIdentity={async (v) => {
        const cols = identityToColumns(v)
        await update.mutateAsync({ id, first_name: v.firstName, last_name: v.lastName, ...cols })
        // `kyc_cases.contact_nationality` est une COPIE dénormalisée qui alimente le
        // scoring de risque pays : la laisser périmée est un défaut de conformité.
        // Les triggers kyc_cases ne bloquent que les DELETE et le passage manuel à
        // `verified` — un UPDATE de cette seule colonne passe.
        // Borné aux dossiers encore ouverts : un dossier validé porte une nationalité
        // constatée au moment du screening (avec son risk_score et ses résultats
        // PEP/sanctions). La réécrire laisserait un dossier « vérifié » dont l'identité
        // ne correspond plus aux contrôles qui l'ont validé. C'est à l'invalidation
        // (onInvalidateKyc, verified→pending) de rouvrir le dossier d'abord.
        if (cols.nationality !== (contact.nationality ?? null)) {
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
        // Seuls les critères d'un ACHETEUR/LOCATAIRE (côté demande) partent dans
        // search_criteria — ce qui déclenche l'auto-matching via le pont DB.
        // Pour un Vendeur/Bailleur, ce sont les caractéristiques du bien qu'il
        // PROPOSE : les écrire dans search_criteria le ferait matcher comme
        // acheteur. On les range donc dans form_data.offer (aucun matching).
        if (contact.type === 'seller' || contact.type === 'landlord') {
          await update.mutateAsync({ id, form_data: { ...fd, offer: c } })
        } else {
          await update.mutateAsync({ id, search_criteria: buildSearchCriteria(c) })
        }
        refreshList()
      }}
      onSaveNote={(note) => {
        if (noteTimer.current) clearTimeout(noteTimer.current)
        noteTimer.current = setTimeout(() => {
          void update.mutateAsync({ id, notes: note.trim() || null }).then(refreshList)
        }, 600)
      }}
      // Pas de navigate ici : le pager affiche « Contact supprimé » puis appelle
      // onBack (naviguer tout de suite démonterait la carte avant qu'on la voie).
      onDelete={async () => { setGhost(contact); await del.mutateAsync(id); refreshList() }}
      onOpenKyc={() => navigate(`/dashboard/kyc?openContactId=${id}`)}
      onOpenMatching={() => navigate(`/dashboard/matching?contact=${id}`)}
      onOpenListings={() => navigate('/dashboard/listings')}
      onProposeVisit={() => navigate(`/dashboard/matching?contact=${id}`)}
    />,
  )
}
