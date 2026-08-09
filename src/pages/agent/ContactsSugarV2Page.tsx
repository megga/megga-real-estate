// MEGGA CRM — Page « Contacts » (refonte Claude Design, conteneur).
// Monte le chrome Sugar (SugarTopNav + SugarIconRail) puis le pager plein-écran
// (liste ↕ santé du portefeuille). Premier lancement (0 contact CHARGÉ AVEC SUCCÈS)
// → ContactsFirstRun dans le cadre ; échec de chargement → écran d'erreur avec
// réessai (jamais confondu avec un compte neuf).
// Création → NouveauContact en overlay du cadre, câblée Supabase
// (search_criteria snake_case → déclenche l'auto-matching via le pont DB).
// Réf. handoff : crm-screen-contacts-proto.jsx / crm-contacts-firstrun.jsx /
// nc-bento-b-live.jsx.

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { SugarTopNav, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { SugarIconRail } from '@/components/crm-sugar/LiquidGlassRail'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { useContactsSugar } from '@/hooks/useContactsSugar'
import { useCreateContact } from '@/hooks/useContacts'
import { buildSearchCriteria, type CriteriaInput } from '@/lib/contactCriteria'
import ContactsPager from '@/components/crm-sugar/contacts-pager/ContactsPager'
import ContactsFirstRun from '@/components/crm-sugar/contacts-pager/ContactsFirstRun'
import NewContactModal, {
  type NewContactData,
} from '@/components/crm-sugar/contacts-pager/NewContactModal'

export default function ContactsSugarV2Page() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { t: tr } = useTranslation('contacts')

  // Deep-link `?source=` (handoff Dashboard) — consommé une fois puis nettoyé
  // (le pager n'affiche plus de bannière source ; param obsolète mais toléré).
  useEffect(() => {
    if (searchParams.has('source')) {
      const next = new URLSearchParams(searchParams)
      next.delete('source')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Thème dark/light, calé sur le toggle du rail (partagé Today/Pipeline) ──
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
  }, [dark])

  const sp = crmSugarPalette(dark)

  const { contacts, isLoading, isError, refetch } = useContactsSugar()
  // `fresh` = compte réellement neuf. Un échec de chargement laisse aussi
  // `contacts` vide : sans le garde `!isError`, une panne réseau présenterait
  // le carnet de l'agent comme vide via l'écran premier lancement.
  const fresh = !isLoading && !isError && contacts.length === 0

  const [modalOpen, setModalOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const createContact = useCreateContact()

  const onCmd = () => openSugarSearch()
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  const openModal = () => { setCreateError(null); setModalOpen(true) }

  // Création — mappe le NewContactData (design) vers le contrat Supabase.
  // search_criteria en snake_case (buildSearchCriteria) → le pont DB matérialise
  // client_searches et déclenche le premier matching. Rejette en cas d'échec
  // pour que la modale reste sur le formulaire (l'écran héros n'apparaît qu'au succès).
  const handleCreate = async (data: NewContactData): Promise<void> => {
    setCreateError(null)
    const buyerSide = data.type === 'buyer' || data.type === 'tenant'
    const criteria = buyerSide && data.criteria ? buildSearchCriteria(data.criteria) : null
    // Vendeur/Bailleur : le bien proposé n'est PAS un critère de recherche (aucun
    // matching). Il se range dans form_data.offer, la clé que la fiche relit
    // (ContactDetailSugarV3Page « crit »). L'écrire sous `linked_bien` le rendait
    // invisible : personne ne lisait cette clé.
    const offer: CriteriaInput | null = !buyerSide && data.linkedBien
      ? {
          transaction: data.type === 'landlord' ? 'location' : 'vente',
          types: [data.linkedBien.propType],
          cantons: [],
          cities: data.linkedBien.address ? [data.linkedBien.address] : [],
        }
      : null
    try {
      const created = await createContact.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        type: data.type,
        source: 'manual',
        score: 'warm',
        tags: [],
        notes: data.note || undefined,
        // Identité LBA art. 3 — colonnes réelles, pas form_data (cf. migration 20260718160000).
        // La modale les a déjà normalisées (date ISO, pays en alpha-2) via identityToColumns().
        birth_date: data.birth_date,
        nationality: data.nationality,
        residence_country: data.residence_country,
        home_address: data.home_address,
        search_criteria: criteria as Record<string, unknown> | null,
        form_data: {
          civility: data.civility,
          lang: data.lang,
          canal: data.canal,
          photo: data.photo ?? null,
          offer,
        },
      })
      setCreatedId(created?.id ?? null)
      // La liste (useContactsSugar) est un useQuery « plain » ['contacts-sugar'] :
      // l'auto-invalidation cache-helpers ne la couvre pas → on invalide explicitement.
      await qc.invalidateQueries({ queryKey: ['contacts-sugar'] })
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : tr('list.toast.unknownError'))
      throw e
    }
  }

  const openMatchingForCreated = () => {
    setModalOpen(false)
    navigate(createdId ? `/dashboard/matching?contact=${createdId}` : '/dashboard/matching')
  }
  const openKycForCreated = () => {
    setModalOpen(false)
    navigate(createdId ? `/dashboard/kyc?openContactId=${createdId}` : '/dashboard/kyc')
  }
  const openFicheForCreated = () => {
    setModalOpen(false)
    navigate(createdId ? `/dashboard/contacts/${createdId}` : '/dashboard/contacts')
  }

  return (
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: sp.ink,
    }}>
      <SugarTopNav active="contacts" sp={sp} dark={dark} onNavigate={onNavigate} onCmd={onCmd} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="contacts" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
        <ContactsPager
          contacts={contacts}
          sp={sp}
          dark={dark}
          fresh={fresh}
          isLoading={isLoading}
          loadError={isError}
          onRetry={refetch}
          onOpenContact={(id) => navigate(`/dashboard/contacts/${id}`)}
          onNewContact={openModal}
          firstRunSlot={<ContactsFirstRun sp={sp} dark={dark} onManual={openModal} />}
          modalOpen={modalOpen}
          modalSlot={
            <NewContactModal
              sp={sp}
              dark={dark}
              onClose={() => { setCreateError(null); setModalOpen(false) }}
              onCreate={handleCreate}
              isPending={createContact.isPending}
              error={createError}
              onOpenMatching={openMatchingForCreated}
              onOpenKyc={openKycForCreated}
              onOpenFiche={openFicheForCreated}
            />
          }
        />
      </div>
    </div>
  )
}
