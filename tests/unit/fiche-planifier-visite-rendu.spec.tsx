/**
 * « Planifier une visite » sur la fiche d'un mandat (`PlanifierVisite`), monté pour de vrai et piloté par ses propres
 * contrôles : ce que le formulaire ÉCRIT, et ce qu'il MONTRE une fois la visite posée. Les règles pures (`visiteurs.ts`)
 * ont leur spec, `fiche-planifier-visite.spec.ts`, qui ne voit pas si le composant les applique : un message composé
 * pour tout visiteur, un `reminderSent` inversé ou un bloc de liens sans condition la laissent verte.
 *
 * Ce que cette spec refuse, parce que rien du matching ne part vers l'acheteur :
 *   · pour un acquéreur compatible du mandat, un lien WhatsApp (`wa.me`) ou e-mail (`mailto:`), le bloc « Confirmer au
 *     visiteur », ou même un message COMPOSÉ que rien n'affiche ;
 *   · une visite d'acquéreur écrite sans `reminderSent` : `visit-reminders-j1` lui écrirait la veille ;
 *   · un acquéreur intéressé dont la visite contournerait l'écrivain du fil — son match ne passerait pas « visite
 *     planifiée » —, ou serait écrite deux fois ;
 *   · une visite perdue quand l'écrivain du fil répond `deja` : le match n'est plus « intéressé », la visite reste due ;
 *   · un message qui paraîtrait après coup, quand le deal que le fil vient d'ouvrir revient dans le contexte ;
 *   · un acheteur en deal ouvert privé de son message, de ses deux liens ou de son rappel la veille.
 *
 * Les hooks de données sont doublés (aucun réseau) ; `visiteurs.ts`, `detailsVisite` et `refBienInterne` tournent pour
 * de vrai. Idiome createRoot + act (le dépôt n'a pas @testing-library/react). Mock PARTIEL de react-i18next : la clé
 * EST le libellé, ses valeurs s'y accolent en JSON, et chaque clé demandée est notée — seule trace d'un message composé
 * que le formulaire n'affiche pas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import type { ContexteVisite, DealDuBien } from '@/components/crm/biens/fiche/visiteurs'
import type { CreateVisitInput } from '@/hooks/useVisitDetail'
import type { execPlanifierVisite } from '@/lib/matchingGestes'
import type { Contact } from '@/types/contact'
import type { Property } from '@/types/listing'

/** Ce que le formulaire lit d'un contact du carnet. */
type ContactCarnet = Pick<Contact, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'type'>

const h = vi.hoisted(() => ({
  /** Chaque clé demandée à la traduction, dans l'ordre des rendus. */
  cles: [] as string[],
  contacts: [] as ContactCarnet[],
  creerVisite: vi.fn<(input: CreateVisitInput) => Promise<{ id: string }>>(),
  execPlanifierVisite: vi.fn<typeof execPlanifierVisite>(),
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => { h.cles.push(k); return o ? `${k} ${JSON.stringify(o)}` : k },
    i18n: { language: 'fr' },
  }),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/intercom-milestones', () => ({ markIntercomMilestone: () => undefined }))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: { id: 'u-1', agency_id: 'ag-1', full_name: 'Léa Favre' } }) }))
vi.mock('@/hooks/useContacts', () => ({
  useContacts: () => ({ contacts: h.contacts, isLoading: false }),
  // Aucun visiteur n'est créé sur place dans ces cas : une création y serait un chemin inattendu, et doit échouer.
  useCreateContact: () => ({ mutateAsync: () => Promise.reject(new Error('création de contact inattendue')) }),
}))
vi.mock('@/hooks/useVisits', () => ({ useVisits: () => ({ visits: [] }) }))
// `detailsVisite` reste le vrai : c'est lui qui porte les détails du formulaire jusqu'à l'écrivain du fil.
vi.mock('@/hooks/useVisitDetail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useVisitDetail')>()),
  useCreateAgentVisit: () => ({ mutateAsync: h.creerVisite }),
}))
vi.mock('@/lib/matchingGestes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/matchingGestes')>()),
  execPlanifierVisite: h.execPlanifierVisite,
}))

import PlanifierVisite from '@/components/crm/biens/fiche/PlanifierVisite'
import { crmPalette } from '@/components/crm/tokens'
import { vxPalette } from '@/components/crm-dossiers/vitrine/vitrineTokens'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const champsDuBien: Partial<Property> = {
  id: 'b7c41e20-5d2a-4f8e-9a61-3f0c2d7e8b19', agency_id: 'ag-1', title: 'Attique 5.5 pièces', status: 'active',
  transaction_type: 'buy', address: 'Chemin des Crêts 14', postal_code: '1218', city: 'Le Grand-Saconnex', photos: [],
}
const BIEN = champsDuBien as Property

// Les deux ont téléphone ET e-mail : l'absence d'un lien ne peut venir que de la règle, jamais d'un canal manquant.
const JULIE: ContactCarnet = { id: 'c-julie', first_name: 'Julie', last_name: 'Morand', phone: '+41 79 111 22 33', email: 'julie.morand@example.ch', type: 'buyer' }
const MARC: ContactCarnet = { id: 'c-marc', first_name: 'Marc', last_name: 'Rochat', phone: '+41 79 444 55 66', email: 'marc.rochat@example.ch', type: 'buyer' }

type Statut = NonNullable<Compatible['suivi']>['statut']
const deal = (id: string, contactId: string, stage: DealDuBien['stage']): DealDuBien => ({ id, contact_buyer_id: contactId, status: 'active', stage })

/**
 * Marc : acheteur en deal ouvert sur le bien, absent des compatibles. Julie : acquéreuse compatible (score 92), sans
 * deal ; `statut` dit où en est son match.
 */
const contexte = (statut: Statut): ContexteVisite => ({
  deals: [deal('d-marc', MARC.id, 'offer')],
  compatibles: [{
    id: 'm-julie', score: 92, reporteJusquau: null, acheteur: { id: JULIE.id, prenom: 'Julie', nom: 'Morand' },
    suivi: { statut, proposeLe: '2026-09-20T09:00:00Z', reponduLe: null, motif: null, note: null, prixPropose: null, apprisLe: null },
  }],
  enVente: true,
})

let racine: Root | null = null
let hote: HTMLDivElement | null = null
const onPlanned = vi.fn()
const onOpenVisit = vi.fn<(visitId: string) => void>()

const rendre = (ctx: ContexteVisite) => (
  <PlanifierVisite bien={BIEN} dark={false} sp={crmPalette(false)} vx={vxPalette(false)} contexte={ctx}
    onClose={() => {}} onPlanned={onPlanned} onOpenVisit={onOpenVisit} />
)

function monter(ctx: ContexteVisite): HTMLElement {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => { racine!.render(rendre(ctx)) })
  return hote
}

const bouton = (el: HTMLElement, libelle: string): HTMLButtonElement | null =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === libelle) ?? null

/** Choisit la personne dans « Sur ce bien », puis 10 h le jour proposé (le lendemain). */
function choisir(el: HTMLElement, nom: string) {
  const ligne = [...el.querySelectorAll<HTMLButtonElement>('button.pv-ligne')].find((b) => b.textContent?.includes(nom))
  if (!ligne) throw new Error(`« ${nom} » absent de « Sur ce bien »`)
  act(() => { ligne.click() })
  const dix = el.querySelector<HTMLButtonElement>('button[data-heure="10:00"]')
  if (!dix || dix.disabled) throw new Error('10:00 absente ou éteinte')
  act(() => { dix.click() })
}

async function planifier(el: HTMLElement) {
  const b = bouton(el, 'fiche.visite.planifier')
  if (!b || b.disabled) throw new Error('« Planifier » absent ou éteint : visiteur ou heure non retenus')
  await act(async () => { b.click() })
  // Les écritures doublées se résolvent en quelques microtâches : la main est rendue jusqu'à l'écran « planifiée ».
  for (let i = 0; i < 20 && !el.textContent?.includes('fiche.visite.planifiee'); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  }
  const pied = el.querySelector('footer')?.textContent ?? ''
  expect(el.textContent, `visite non posée — ${pied}`).toContain('fiche.visite.planifiee')
}

/** Le début que le formulaire écrit : le lendemain, 10 h, heure locale. */
const demainA10h = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString() }

const lienWhatsApp = (el: HTMLElement) => el.querySelector<HTMLAnchorElement>('a[href^="https://wa.me/"]')
const lienEmail = (el: HTMLElement) => el.querySelector<HTMLAnchorElement>('a[href^="mailto:"]')
/** Les clés du message de confirmation demandées à la traduction : les demander, c'est le composer. */
const clesDuMessage = () => h.cles.filter((k) => k.startsWith('fiche.visite.message.'))

/** Rien ne part vers l'acquéreur : ni lien, ni bloc de confirmation, ni message, et l'écran le dit en le nommant. */
function rienNePart(el: HTMLElement, prenom: string) {
  expect(lienWhatsApp(el), 'lien WhatsApp').toBeNull()
  expect(lienEmail(el), 'lien e-mail').toBeNull()
  expect(el.textContent).not.toContain('fiche.visite.confirmer.titre')
  expect(clesDuMessage(), 'message composé').toEqual([])
  expect(el.textContent).toContain(`fiche.visite.rienEnvoye ${JSON.stringify({ prenom })}`)
}

beforeEach(() => {
  h.cles.length = 0
  h.contacts = [JULIE, MARC]
  h.creerVisite.mockReset()
  h.creerVisite.mockResolvedValue({ id: 'v-seule' })
  h.execPlanifierVisite.mockReset()
  h.execPlanifierVisite.mockResolvedValue({ deja: false, visiteId: 'v-fil' })
  onPlanned.mockClear()
  onOpenVisit.mockClear()
})
afterEach(() => {
  act(() => racine?.unmount())
  hote?.remove()
  racine = null
  hote = null
})

describe('PlanifierVisite — un acquéreur compatible du mandat', () => {
  it('⛔ proposé, pas intéressé : la visite seule, avec `reminderSent` ; ni lien, ni message', async () => {
    const el = monter(contexte('sent'))
    choisir(el, 'Julie Morand')
    await planifier(el)
    expect(h.execPlanifierVisite).not.toHaveBeenCalled()
    expect(h.creerVisite).toHaveBeenCalledTimes(1)
    expect(h.creerVisite.mock.calls[0]![0]).toMatchObject({
      bienId: BIEN.id, contactId: JULIE.id, dealId: null, scheduledAt: demainA10h(), reminderSent: true,
    })
    rienNePart(el, 'Julie')
  })

  it('⛔ intéressé : sa visite passe par l’écrivain du fil, avec son match, et n’est pas écrite une seconde fois', async () => {
    const el = monter(contexte('interested'))
    choisir(el, 'Julie Morand')
    await planifier(el)
    expect(h.execPlanifierVisite).toHaveBeenCalledTimes(1)
    const [ctx, acheteur, bien, visite] = h.execPlanifierVisite.mock.calls[0]!
    expect(ctx).toEqual({ agencyId: 'ag-1', userId: 'u-1' })
    expect(acheteur).toEqual({ id: JULIE.id, matchId: 'm-julie', first: 'Julie', last: 'Morand', score: 92 })
    expect(bien).toMatchObject({ kind: 'property', id: BIEN.id, title: BIEN.title })
    expect(visite).toMatchObject({ debut: demainA10h(), dureeMinutes: 45, lieu: 'Chemin des Crêts 14, 1218 Le Grand-Saconnex' })
    expect(h.creerVisite).not.toHaveBeenCalled()
    expect(onPlanned).toHaveBeenCalledTimes(1)
    rienNePart(el, 'Julie')
    // « Ouvrir la visite » mène à celle que le fil a écrite.
    act(() => { bouton(el, 'fiche.visite.ouvrir')!.click() })
    expect(onOpenVisit).toHaveBeenCalledWith('v-fil')
  })

  it('⛔ le deal que le fil vient d’ouvrir, relu par la fiche, ne fait pas paraître le message : il est décidé à l’écriture', async () => {
    const el = monter(contexte('interested'))
    choisir(el, 'Julie Morand')
    await planifier(el)
    // `onPlanned` revalide les deals de la fiche : Julie en a un, ouvert, dès le rendu suivant.
    act(() => {
      racine!.render(rendre({ ...contexte('visit_planned'), deals: [deal('d-marc', MARC.id, 'offer'), deal('d-julie', JULIE.id, 'visit_planned')] }))
    })
    rienNePart(el, 'Julie')
  })

  it('⛔ l’écrivain du fil répond `deja` (le match n’est plus « intéressé ») : la visite s’écrit quand même, avec `reminderSent`', async () => {
    h.execPlanifierVisite.mockResolvedValue({ deja: true, visiteId: null })
    const el = monter(contexte('interested'))
    choisir(el, 'Julie Morand')
    await planifier(el)
    expect(h.execPlanifierVisite).toHaveBeenCalledTimes(1)
    expect(h.creerVisite).toHaveBeenCalledTimes(1)
    expect(h.creerVisite.mock.calls[0]![0]).toMatchObject({ bienId: BIEN.id, contactId: JULIE.id, dealId: null, reminderSent: true })
    rienNePart(el, 'Julie')
    act(() => { bouton(el, 'fiche.visite.ouvrir')!.click() })
    expect(onOpenVisit).toHaveBeenCalledWith('v-seule')
  })
})

describe('PlanifierVisite — un acheteur en deal ouvert sur le bien', () => {
  it('hors des compatibles : la visite rejoint son deal avec son rappel, et le message part par ses deux liens', async () => {
    const el = monter(contexte('interested'))
    choisir(el, 'Marc Rochat')
    await planifier(el)
    expect(h.execPlanifierVisite).not.toHaveBeenCalled()
    expect(h.creerVisite).toHaveBeenCalledTimes(1)
    expect(h.creerVisite.mock.calls[0]![0]).toMatchObject({ bienId: BIEN.id, contactId: MARC.id, dealId: 'd-marc', reminderSent: false })
    expect(el.textContent).not.toContain('fiche.visite.rienEnvoye')
    expect(el.textContent).toContain('fiche.visite.confirmer.titre')
    expect(clesDuMessage()).toContain('fiche.visite.message.surPlace')

    const wa = lienWhatsApp(el)
    expect(wa, 'lien WhatsApp').not.toBeNull()
    const urlWa = new URL(wa!.getAttribute('href')!)
    expect(urlWa.pathname).toBe('/41794445566')
    const texte = urlWa.searchParams.get('text') ?? ''
    expect(texte.startsWith('fiche.visite.message.surPlace ')).toBe(true)
    expect(texte).toContain('"prenom":"Marc"')

    const mail = lienEmail(el)
    expect(mail, 'lien e-mail').not.toBeNull()
    const urlMail = new URL(mail!.getAttribute('href')!)
    expect(decodeURIComponent(urlMail.pathname)).toBe(MARC.email)
    expect(urlMail.searchParams.get('subject')).toContain('fiche.visite.message.sujet')
    // Le même message par les deux canaux.
    expect(urlMail.searchParams.get('body')).toBe(texte)
  })
})
