/**
 * « Qui pour ce bien ? » et « À conclure » ALLÉGÉS (`FilQuiPourCeBien`, `FilConclure` ; conception du fil épuré §8),
 * montés pour de vrai — la liste partagée des acquéreurs (`QuiPourCeBien`) est remplacée par un témoin qui note ce
 * qu'on lui passe : elle ne change pas, et lit ses anciens prospects par une requête.
 *
 * Ce que cette spec refuse :
 *   · la pastille « Qui pour ce bien ? », « Voir le bien » écrit (le titre est le lien), l'adresse ou la ville dans
 *     l'en-tête du bien ;
 *   · un bien neuf écrit en toutes lettres au lieu de sa pastille « Nouveau », ou à côté d'elle ; la pastille sur un
 *     bien qui n'est pas neuf, ou sur une baisse ;
 *   · la liste des acquéreurs montée autrement (conception §9) : le mandat, ses compatibles, ses anciens prospects
 *     après un délai, « Ouvrir » sur une ligne du fil seulement, le lien vers le contact ;
 *   · « Voir l'annonce d'origine » écrit : une icône de lien externe, nommée ET en infobulle (§2), à côté du titre,
 *     qui ouvre un nouvel onglet sans rien transmettre au portail ; une adresse qui n'est pas http(s) rendue
 *     cliquable ; le titre d'une annonce qui mènerait à la fiche d'un mandat ; un mandat hors vente qui tairait son
 *     état (lot E1) ;
 *   · ce qui reste, perdu : la pastille « Votre bien » / « Marché » et l'adresse sous le titre (où la visite
 *     s'écrira, et le lieu qu'elle écrira), « Intéressé·e le … », les libellés du formulaire, « Rien n'est envoyé
 *     à … » ; et ce qui ne change pas (§9), cassé : la visite planifiée (début, durée, lieu), « Pas intéressé » et
 *     ses motifs, la date qui prend le focus et porte la cible de V, le lien vers le contact ;
 *   · `fil.voirBien` resté dans l'une des quatre langues : aucune porte ne garde le RETRAIT d'une clé — la parité
 *     n'en voit qu'une restée seule, `lint:i18n-keys` que les clés appelées.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON. Pour planifier, l'horloge est figée (`Date` seul) : le formulaire propose la visite dans deux jours.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))
const listes = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock('@/components/matching-fil/QuiPourCeBien', () => ({
  default: (p: Record<string, unknown>) => { listes.push(p); return null },
}))

import FilQuiPourCeBien from '@/components/matching-fil/FilQuiPourCeBien'
import FilConclure from '@/components/matching-fil/FilConclure'
import type { FilBien, FilMatch } from '@/components/matching-fil/filModele'
import { MOTIFS_REFUS } from '@/components/matching-fil/filBoucle'
import { signalBien } from '@/components/matching-fil/filSignaux'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { crmPalette } from '@/components/crm/tokens'
import fr from '@/i18n/locales/fr/matching.json'
import en from '@/i18n/locales/en/matching.json'
import de from '@/i18n/locales/de/matching.json'
import italien from '@/i18n/locales/it/matching.json'

const sp = crmPalette(false)
const MAINTENANT = Date.parse('2020-01-15T12:00:00Z')
const TITRE = 'Attique 5,5 pièces · Florissant'
const EMMA: FilMatch['acheteur'] = { id: 'c7', prenom: 'Emma', nom: 'Schneider', telephone: null, email: null, kyc: 'none' }
const bien = (champs: Partial<FilBien> = {}): FilBien => ({
  id: 'p3', titre: TITRE, prix: 2_350_000, location: false, type: 'apartment', pieces: 5.5,
  surface: 168, ville: 'Genève', canton: 'GE', adresse: 'Route de Florissant 58', equipements: [], photo: null, ...champs,
})
const interesse = (b: FilBien): FilMatch => ({
  id: 'm70', score: 100, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: b, acheteur: EMMA,
  suivi: { statut: 'interested', proposeLe: '2020-01-05T10:00:00Z', reponduLe: '2020-01-10T10:00:00Z', motif: null, note: null, prixPropose: null, apprisLe: null },
})

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(element: ReactNode): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => { racine!.render(element) })
}
const texte = (): string => hote!.textContent ?? ''
/** Ce que l'écran ÉCRIT : son texte, moins ce qui n'est dit qu'à un lecteur d'écran (`.sr-only`). */
const visible = (el: Element = hote!): string => {
  const copie = el.cloneNode(true) as HTMLElement
  copie.querySelectorAll('.sr-only').forEach((e) => e.remove())
  return copie.textContent ?? ''
}
/** Le tracé d'une icône tel que MEIcon le dessine (idiome de `fil-correction`, `fil-panneau` et `fil-liste`). */
function trace(nom: MEIconName): string {
  const boite = document.createElement('div')
  boite.innerHTML = renderToStaticMarkup(<MEIcon name={nom} />)
  return boite.querySelector('svg')!.innerHTML
}
const bouton = (libelle: string): HTMLButtonElement => [...hote!.querySelectorAll('button')].find((b) => b.textContent === libelle)!

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  listes.length = 0
  vi.useRealTimers()
})

describe('FilQuiPourCeBien — l’en-tête du bien allégé', () => {
  const monter = (b: FilBien, onVoirBien = vi.fn()) => rendre(
    <FilQuiPourCeBien sp={sp} bien={b} compatibles={[]} maintenant={MAINTENANT} peutOuvrir={() => false} onChoisir={() => {}}
      onVoirBien={onVoirBien} onVoirContact={() => {}} />,
  )

  it('le titre est le lien vers le bien ; ni pastille « Qui pour ce bien ? », ni « Voir le bien », ni l’adresse, ni la ville', async () => {
    const voir = vi.fn()
    await monter(bien(), voir)
    const titre = hote!.querySelector('h2 button') as HTMLButtonElement
    expect(titre.textContent).toBe(TITRE)
    await act(async () => { titre.click() })
    expect(voir).toHaveBeenCalledTimes(1)
    // Sous le titre, le prix SEUL — et pas de pastille : ce mandat n'est pas neuf.
    expect(visible(hote!.querySelector('h2 + p')!)).toBe("CHF 2'350'000")
    for (const retire of ['fil.quiPour.titre', 'fil.voirBien', 'fil.signal.', 'Route de Florissant 58', 'Genève']) {
      expect(texte()).not.toContain(retire)
    }
  })

  it('un mandat neuf : la pastille « Nouveau », son libellé au survol et pour un lecteur d’écran, jamais écrit', async () => {
    await monter(bien({ mandatLe: '2020-01-14T09:00:00Z' }))
    const pastille = hote!.querySelector('[title="fil.signal.mandatCourt"]')
    expect(pastille?.querySelector('[aria-hidden]')?.textContent).toBe('fil.signal.pastille')
    expect(pastille?.querySelector('.sr-only')?.textContent).toBe('fil.signal.mandatCourt')
    expect(visible(hote!.querySelector('h2 + p')!)).toBe("CHF 2'350'000fil.signal.pastille")
    // Le signal en toutes lettres — court ou daté —, ni à la place de la pastille ni à côté d'elle.
    expect(visible()).not.toContain('fil.signal.mandat')
  })

  it('une baisse ne s’écrit jamais « Nouveau » — même sur une annonce, où le fil n’ouvre pas ce panneau', async () => {
    const enBaisse = bien({ marche: { ref: 'MG-MK-1', sourceUrl: null }, prixInitial: 2_600_000, baisseLe: '2020-01-10T09:00:00Z' })
    expect(signalBien(enBaisse, MAINTENANT)?.genre, 'la clause ne mesure rien').toBe('baisse')
    await monter(enBaisse)
    expect(visible(hote!.querySelector('h2 + p')!)).toBe("CHF 2'350'000")
    expect(texte()).not.toContain('fil.signal.')
  })

  it('la liste des acquéreurs ne change pas : le mandat, ses compatibles, ses anciens prospects après un délai, « Ouvrir » sur une ligne du fil seulement, le contact', async () => {
    const compatibles = [interesse(bien())]
    const choisir = vi.fn()
    const contact = vi.fn()
    await rendre(
      <FilQuiPourCeBien sp={sp} bien={bien()} compatibles={compatibles} maintenant={MAINTENANT} peutOuvrir={(id) => id === 'm70'}
        onChoisir={choisir} onVoirBien={() => {}} onVoirContact={contact} />,
    )
    const liste = listes[listes.length - 1]!
    expect(liste.bien).toEqual({ genre: 'mandat', id: 'p3', location: false })
    expect(liste.compatibles).toBe(compatibles)
    expect(liste.maintenant).toBe(MAINTENANT)
    expect(liste.avecAnciens).toBe(true)
    expect(liste.delaiProspects).toBeGreaterThan(0)
    expect(liste.onVoirContact).toBe(contact)
    const ouvrir = liste.ouvrir as (m: FilMatch) => (() => void) | null
    expect(ouvrir({ ...compatibles[0]!, id: 'hors-du-fil' })).toBeNull()
    ouvrir(compatibles[0]!)!()
    expect(choisir).toHaveBeenCalledWith('m70')
  })
})

describe('FilConclure — l’annonce d’origine en icône, le titre d’un mandat en lien', () => {
  const monter = (m: FilMatch, props: Partial<ComponentProps<typeof FilConclure>> = {}) => rendre(
    <FilConclure sp={sp} m={m} motifsOuverts={false} occupe={false} focusDate={false} onPlanifier={() => {}}
      onPasInteresse={() => {}} onMotif={() => {}} onFermerMotifs={() => {}} onVoirBien={() => {}} onVoirContact={() => {}}
      {...props} />,
  )

  it('une annonce du marché : son lien d’origine en icône de lien externe, nommée et en infobulle, à côté du titre', async () => {
    await monter(interesse(bien({ marche: { ref: 'MG-MK-1', sourceUrl: 'https://flatfox.ch/fr/annonce/1/' } })))
    const lien = hote!.querySelector('h2 a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe('https://flatfox.ch/fr/annonce/1/')
    expect(lien.getAttribute('aria-label')).toBe('fil.conclure.voirAnnonce')
    expect(lien.getAttribute('title')).toBe('fil.conclure.voirAnnonce')
    // Un nouvel onglet, et rien de l'écran du CRM transmis au portail.
    expect(lien.getAttribute('target')).toBe('_blank')
    expect(lien.getAttribute('rel')?.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer'])
    expect([...lien.querySelectorAll('svg')].map((s) => s.innerHTML)).toEqual([trace('external')])
    expect(lien.textContent).toBe('')
    expect(texte()).not.toContain('fil.conclure.voirAnnonce')
    // Le titre d'une annonce n'est pas un lien : `onVoirBien` ouvre la fiche d'un MANDAT (`/dashboard/listings/:id`).
    expect(hote!.querySelector('h2 button')).toBeNull()
    expect(hote!.querySelector('h2')!.textContent).toBe(TITRE)
    // La pastille dit où la visite s'écrira : l'agenda, pour une annonce.
    expect(hote!.querySelector('h2')!.previousElementSibling?.textContent).toBe('fil.selection.marche')
  })

  it('une adresse d’annonce qui n’est pas http(s) : rien de cliquable', async () => {
    await monter(interesse(bien({ marche: { ref: 'MG-MK-1', sourceUrl: 'javascript:alert(1)' } })))
    expect(hote!.querySelector('a')).toBeNull()
    expect(hote!.querySelector('h2 button')).toBeNull()
  })

  it('un mandat : le titre est le lien vers sa fiche, « Voir le bien » n’est plus écrit', async () => {
    const voir = vi.fn()
    await monter(interesse(bien()), { onVoirBien: voir })
    const titre = hote!.querySelector('h2 button') as HTMLButtonElement
    expect(titre.textContent).toBe(TITRE)
    await act(async () => { titre.click() })
    expect(voir).toHaveBeenCalledTimes(1)
    expect(texte()).not.toContain('fil.voirBien')
  })

  it('un mandat qui n’est plus en vente garde sa place : son état avant son prix (lot E1)', async () => {
    await monter(interesse(bien({ enVente: false, statut: 'sold' })))
    expect(hote!.querySelector('h2 + p')?.textContent?.startsWith("listings:status.sold · CHF 2'350'000")).toBe(true)
  })

  it('restent la pastille, le lieu, « Intéressé·e le … », les libellés du formulaire et la promesse : rien n’est envoyé à l’acheteur', async () => {
    await monter(interesse(bien()))
    // Gardés ici, retirés des autres panneaux : où la visite s'écrira, et le lieu qu'elle écrira, relu avant de confirmer.
    expect(hote!.querySelector('h2')!.previousElementSibling?.textContent).toBe('fil.votreBien')
    expect(hote!.querySelector('h2 + p')?.textContent).toBe("CHF 2'350'000 · Route de Florissant 58 · Genève")
    expect(texte()).toContain('fil.conclure.interesseLe {"date":"10.01"}')
    expect(hote!.querySelector('form h3')?.textContent).toBe('fil.conclure.planifier')
    expect([...hote!.querySelectorAll('form label')].map((l) => l.firstChild?.textContent))
      .toEqual(['fil.conclure.date', 'fil.conclure.heure', 'fil.conclure.duree'])
    expect(hote!.querySelector('button[type="submit"]')?.textContent).toBe('fil.conclure.confirmer')
    expect(texte()).toContain('fil.conclure.aucuneInvitation {"prenom":"Emma"}')
  })

  it('la visite se planifie comme avant : le jour et l’heure proposés, la durée choisie, le lieu du bien', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2020, 0, 15, 12))
    const planifier = vi.fn()
    await monter(interesse(bien()), { onPlanifier: planifier })
    const duree = hote!.querySelector('form select') as HTMLSelectElement
    await act(async () => {
      duree.value = '60'
      duree.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => { (hote!.querySelector('button[type="submit"]') as HTMLButtonElement).click() })
    expect(planifier).toHaveBeenCalledTimes(1)
    expect(planifier).toHaveBeenCalledWith({
      debut: new Date(2020, 0, 17, 14).toISOString(), dureeMinutes: 60, lieu: 'Route de Florissant 58, Genève',
    })
  })

  it('« Pas intéressé » demande ses motifs', async () => {
    const pasInteresse = vi.fn()
    await monter(interesse(bien()), { onPasInteresse: pasInteresse })
    expect(hote!.querySelector('[role="group"]')).toBeNull()
    await act(async () => { bouton('fil.retours.pasInteresse').click() })
    expect(pasInteresse).toHaveBeenCalledTimes(1)
  })

  it('ouverts, les motifs se montrent, et une puce consigne le refus', async () => {
    const motif = vi.fn()
    await monter(interesse(bien()), { motifsOuverts: true, onMotif: motif })
    await act(async () => { (hote!.querySelector('[role="group"] button[aria-keyshortcuts="1"]') as HTMLButtonElement).click() })
    expect(motif).toHaveBeenCalledWith(MOTIFS_REFUS[0], null)
  })

  it('la visite demandée (`focusDate`) : la date prend le focus, et c’est elle que V vise', async () => {
    await monter(interesse(bien()), { focusDate: true })
    const date = hote!.querySelector('input[type="date"]') as HTMLInputElement
    expect(document.activeElement).toBe(date)
    expect(date.hasAttribute('data-visite-date')).toBe(true)
    expect(date.getAttribute('aria-keyshortcuts')).toBe('V')
  })

  it('le nom de l’acheteur mène à sa fiche', async () => {
    const contact = vi.fn()
    await monter(interesse(bien()), { onVoirContact: contact })
    await act(async () => { bouton('Emma Schneider').click() })
    expect(contact).toHaveBeenCalledTimes(1)
  })
})

describe('« Voir le bien » a quitté les quatre langues', () => {
  it.each([['fr', fr], ['en', en], ['de', de], ['it', italien]] as const)('%s : plus de `fil.voirBien`', (langue, l) => {
    const cles = Object.keys(l.fil)
    expect(cles, `${langue} : la clause ne mesure rien`).toContain('votreBien')
    expect(cles, langue).not.toContain('voirBien')
  })
})
