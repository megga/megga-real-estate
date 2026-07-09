// MEGGA CRM — Page « Contacts » (refonte Claude Design, conteneur).
// Monte le chrome Sugar (SugarTopNav + SugarIconRail) puis le pager plein-écran
// (liste ↕ santé du portefeuille). Premier lancement (0 contact) → ContactsFirstRun
// dans le cadre. Création → NouveauContact en overlay du cadre, câblée Supabase
// (search_criteria snake_case → déclenche l'auto-matching via le pont DB).
// Réf. handoff : crm-screen-contacts-proto.jsx / crm-contacts-firstrun.jsx /
// nc-bento-b-live.jsx.

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import { SugarTopNav, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { SugarIconRail } from '@/components/crm-sugar/LiquidGlassRail'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { useContactsSugar } from '@/hooks/useContactsSugar'
import { useCreateContact } from '@/hooks/useContacts'
import { buildSearchCriteria } from '@/lib/contactCriteria'
import ContactsPager from '@/components/crm-sugar/contacts-pager/ContactsPager'
import ContactsFirstRun from '@/components/crm-sugar/contacts-pager/ContactsFirstRun'
import NewContactModal, {
  type NewContactData,
} from '@/components/crm-sugar/contacts-pager/NewContactModal'

const DARK_TONE: DarkTone = 'meggaAi'

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

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  const { contacts, isLoading } = useContactsSugar()
  const fresh = !isLoading && contacts.length === 0

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
      case 'reseau': navigate('/dashboard/network'); break
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
        search_criteria: criteria as Record<string, unknown> | null,
        form_data: {
          civility: data.civility,
          lang: data.lang,
          canal: data.canal,
          photo: data.photo ?? null,
          linked_bien: data.linkedBien ?? null,
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
      display: 'flex', flexDirection: 'column', fontFamily: 'Inter Tight, system-ui, sans-serif', color: sp.ink,
    }}>
      <SugarTopNav active="contacts" t={t} sp={sp} dark={dark} onNavigate={onNavigate} onCmd={onCmd} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="contacts" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
        <ContactsPager
          contacts={contacts}
          sp={sp}
          dark={dark}
          fresh={fresh}
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
