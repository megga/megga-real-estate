/**
 * Le bandeau LAB, monté pour de vrai — parce qu'aucun banc ne peut le montrer.
 *
 * ⛔ `/dev/onboarding` en est INCAPABLE, et ce n'est pas une fixture qui manque : sous
 * `VITE_DEV_BYPASS_AUTH`, `useLabGuard` n'interroge pas le réseau (`enabled: … &&
 * !DEV_BYPASS_AUTH`) et lit `DEV_BYPASS_AGENCY`, dont le statut est `validated` — donc
 * « clear », donc aucun bandeau ; sans bypass, il n'y a pas de profil, donc pas
 * d'agencyId, donc la lecture est désactivée. Semer le cache de React Query y serait du
 * code mort. D'où ce test, seul endroit où le rendu réel du bandeau s'observe.
 *
 * Idiome de montage repris de focus-trap.spec.ts (createRoot + act) : le dépôt n'a pas
 * @testing-library/react, et l'ajouter pour un bouton ne se justifie pas.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { LabGuardStatus } from '@/hooks/useLabGuard'

/** Ce que `useLabGuard()` répondra au prochain rendu. */
let statutCourant: LabGuardStatus = 'blocked_not_submitted'
/** L'agence du profil courant — sert à éprouver qu'un renvoi ne franchit pas les agences. */
let agenceCourante: string | null = 'agence-A'

// ⚠ Mock PARTIEL : `src/i18n/index.ts` est tiré par la chaîne d'imports et appelle
// `.use(initReactI18next)`. Un mock complet ne rend pas cet export, et le fichier
// entier échoue à l'import avant qu'un seul test ne tourne.
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  // La clé EST le libellé : ce test porte sur la mécanique du renvoi, pas sur la copie
  // (dont la parité FR/DE/EN/IT est déjà gardée par i18n:parity).
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { role: 'admin', agency_id: agenceCourante } }),
}))

vi.mock('@/hooks/useLabGuard', async (importOriginal) => ({
  // `canActOnLabGuard` et `LAB_GUARD_LABEL_KEY` restent les VRAIS : ce sont des règles,
  // les remplacer ferait passer le test sur une logique qui n'est pas celle du produit.
  ...(await importOriginal<typeof import('@/hooks/useLabGuard')>()),
  useLabGuard: () => statutCourant,
}))

vi.mock('@/lib/intercom', () => ({ showIntercomSpace: vi.fn() }))

vi.mock('@/components/megga-x', () => ({
  MxLink: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
}))

const { default: LabGuardBanner, labGuardDismissKey } = await import('@/components/layout/LabGuardBanner')

/**
 * ⚠ IL FAUT POSER `localStorage` SOI-MÊME, et le constat vaut d'être noté : sous cet
 * environnement, `'localStorage' in window` est VRAI mais `typeof window.localStorage`
 * vaut `undefined` (Node expose le nom sans l'implémenter, faute de
 * `--localstorage-file`). Un test qui se contenterait de `in window` se croirait donc
 * outillé et ne le serait pas.
 */
const memoire = new Map<string, string>()
function poserStockage(implementation: Storage | undefined) {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: implementation })
}
const stockageMemoire = {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => { memoire.set(k, v) },
  removeItem: (k: string) => { memoire.delete(k) },
  clear: () => memoire.clear(),
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() { return memoire.size },
} as Storage

let hote: HTMLDivElement
let racine: Root | null = null

function monter() {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => racine!.render(createElement(LabGuardBanner)))
}

function demonter() {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
}

const bandeau = () => hote.querySelector('.mx-notice')
const boutonFermer = () => hote.querySelector<HTMLButtonElement>('.mx-notice__close')

beforeEach(() => {
  memoire.clear()
  poserStockage(stockageMemoire)
  statutCourant = 'blocked_not_submitted'
  agenceCourante = 'agence-A'
})
afterEach(demonter)

describe('LabGuardBanner — le renvoi', () => {
  it('affiche le bandeau et son bouton de fermeture', () => {
    monter()
    expect(bandeau()).not.toBeNull()
    expect(boutonFermer()).not.toBeNull()
    // Un bouton sans nom accessible n'est pas un bouton pour qui n'y voit pas.
    expect(boutonFermer()!.getAttribute('aria-label')).toBe('labGuard.banner.dismiss')
  })

  it('le clic retire le bandeau', () => {
    monter()
    act(() => { boutonFermer()!.click() })
    expect(bandeau()).toBeNull()
  })

  it('le renvoi SURVIT au remontage — sinon il ne servirait à rien', () => {
    monter()
    act(() => { boutonFermer()!.click() })
    demonter()
    monter()
    expect(bandeau()).toBeNull()
  })

  it('⛔ un CHANGEMENT D\'ÉTAT ramène le bandeau', () => {
    // LE test de ce fichier. Un booléen « fermé » ferait taire « Correction demandée »,
    // qui est la seule chose expliquant pourquoi le formulaire s'est rouvert.
    monter()
    act(() => { boutonFermer()!.click() })
    demonter()

    statutCourant = 'blocked_correction_requested'
    monter()
    expect(bandeau()).not.toBeNull()
  })

  it('un refus se redit aussi, même après avoir renvoyé « non soumise »', () => {
    monter()
    act(() => { boutonFermer()!.click() })
    demonter()

    statutCourant = 'blocked_rejected'
    monter()
    expect(bandeau()).not.toBeNull()
  })

  it('le renvoi ne franchit pas les agences', () => {
    monter()
    act(() => { boutonFermer()!.click() })
    demonter()

    agenceCourante = 'agence-B'
    monter()
    expect(bandeau()).not.toBeNull()
  })

  it('écrit la clé attendue, et rien d\'autre', () => {
    monter()
    act(() => { boutonFermer()!.click() })
    expect(memoire.get('megga.labguard-dismissed'))
      .toBe(labGuardDismissKey('agence-A', 'blocked_not_submitted'))
    expect(memoire.size).toBe(1)
  })

  it('reste muet sur un dossier en règle, renvoi ou pas', () => {
    statutCourant = 'clear'
    monter()
    expect(bandeau()).toBeNull()
  })

  it('⛔ SURVIT à un stockage ABSENT — sinon tout le wizard tombe', () => {
    // Node expose `localStorage` sans l'implémenter ; un navigateur peut faire pareil.
    // `LabGuardBanner` vit dans IdentityShell : une exception ici rendrait l'onboarding
    // entier blanc, pour un simple confort d'affichage.
    poserStockage(undefined)
    expect(() => monter()).not.toThrow()
    expect(bandeau()).not.toBeNull()
    expect(() => act(() => { boutonFermer()!.click() })).not.toThrow()
    // Le renvoi tient pour la visite, faute de pouvoir être mémorisé.
    expect(bandeau()).toBeNull()
  })

  it('⛔ SURVIT à un stockage qui LÈVE (Safari privé, Firefox stockage coupé)', () => {
    // Ces navigateurs-là jettent sur la LECTURE DE LA PROPRIÉTÉ, pas sur getItem : un
    // garde `typeof window !== 'undefined'` ne protège de rien.
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('refusé', 'SecurityError') },
    })
    expect(() => monter()).not.toThrow()
    expect(bandeau()).not.toBeNull()
    expect(() => act(() => { boutonFermer()!.click() })).not.toThrow()
    expect(bandeau()).toBeNull()
  })
})
