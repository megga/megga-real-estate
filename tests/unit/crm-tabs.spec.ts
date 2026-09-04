/**
 * Le MODÈLE des onglets du CRM — les invariants que la référence de design pose
 * en capitales, éprouvés un par un.
 *
 * ⚠ Ce fichier ne teste QUE `src/lib/crmTabs.ts` : des fonctions pures, sans
 * React ni réseau. Les mécanismes qui vivent dans le composant (le seuil de 4 px
 * du glisser, le portage des menus, la fenêtre de silence après un glisser) ne
 * s'éprouvent qu'à l'écran et ne sont pas ici — dire le contraire ferait une
 * suite verte qui ne mesure pas ce qu'elle prétend.
 */

import { describe, it, expect } from 'vitest'
import {
  CRM_TABS_CAP, crmApplyCap, crmApplyLabels, crmChipMaxWidth, crmCloseOthers,
  crmCloseTab, crmDragBounds, crmDuplicateTab, crmMakeTab, crmMoveTab, crmPinnedCount,
  crmResolveActive, crmTabFallbackPath, crmTabRecordRef, crmTabRefs,
  crmTogglePin, crmVisibleWindow, type CrmTab,
} from '@/lib/crmTabs'

/** Fabrique lisible — l'id est explicite, c'est lui qu'on suit dans les tests. */
function tab(id: string, path = '/dashboard', extra: Partial<CrmTab> = {}): CrmTab {
  return { id, path, search: '', section: null, ...extra }
}

describe('crmTabs — identité et repères', () => {
  it('deux onglets créés dans la même milliseconde ont des id DIFFÉRENTS', () => {
    // ⛔ La maquette identifie par `Date.now()` seul. Deux créations dans le même
    // tick (une duplication au clavier, un rétablissement de pile) porteraient
    // alors le même id, et l'actif se retrouverait sur le premier des deux.
    const a = crmMakeTab('/dashboard', '', 1_700_000_000_000)
    const b = crmMakeTab('/dashboard', '', 1_700_000_000_000)
    expect(a.id).not.toBe(b.id)
  })

  it("retrouve l'actif par son id, jamais par son rang", () => {
    const tabs = [tab('a'), tab('b'), tab('c')]
    expect(crmResolveActive(tabs, 'c')).toBe(2)
    // Le même id après un déplacement : le rang change, l'onglet non.
    const bouge = crmMoveTab(tabs, 2, 0)
    expect(crmResolveActive(bouge, 'c')).toBe(0)
  })

  it("retombe sur l'onglet VISÉ quand l'actif a disparu, puis sur 0", () => {
    const tabs = [tab('a'), tab('b')]
    expect(crmResolveActive(tabs, 'disparu', 'b')).toBe(1)
    expect(crmResolveActive(tabs, 'disparu', 'aussi-disparu')).toBe(0)
  })
})

describe('crmTabs — épinglage', () => {
  it('épingler REPOSITIONNE en fin de bloc épinglé', () => {
    const tabs = [tab('a', '/x', { pinned: true }), tab('b'), tab('c')]
    const apres = crmTogglePin(tabs, 2)
    expect(apres.map((t) => t.id)).toEqual(['a', 'c', 'b'])
    expect(apres[1].pinned).toBe(true)
    expect(crmPinnedCount(apres)).toBe(2)
  })

  it('détacher renvoie en FIN de barre', () => {
    const tabs = [tab('a', '/x', { pinned: true }), tab('b', '/y', { pinned: true }), tab('c')]
    const apres = crmTogglePin(tabs, 0)
    expect(apres.map((t) => t.id)).toEqual(['b', 'c', 'a'])
    expect(apres[2].pinned).toBe(false)
  })

  it('⛔ une puce épinglée ne se déplace PAS parmi les détachées', () => {
    // Les épinglés sont le PRÉFIXE de la pile : un glisser qui traverse la
    // frontière ferait de l'épinglage un attribut sans position, donc un bloc
    // épinglé qui n'est plus un bloc.
    const tabs = [tab('a', '/x', { pinned: true }), tab('b'), tab('c')]
    expect(crmMoveTab(tabs, 0, 2)).toBe(tabs) // refusé, même référence
    expect(crmMoveTab(tabs, 1, 0)).toBe(tabs) // refusé dans l'autre sens
  })
})

describe('crmTabs — duplication', () => {
  it("copie la tranche, prend une identité neuve, n'est jamais épinglée", () => {
    const tabs = [tab('a', '/dashboard/contacts/42', { pinned: true, ui: { pager: 1 } })]
    const apres = crmDuplicateTab(tabs, 0, 1_700_000_000_000)
    expect(apres).toHaveLength(2)
    expect(apres[1].id).not.toBe('a')
    expect(apres[1].pinned).toBe(false)
    expect(apres[1].path).toBe('/dashboard/contacts/42')
    expect(apres[1].ui).toEqual({ pager: 1 })
  })

  it('⚠ la tranche est COPIÉE, pas partagée — les deux onglets divergent', () => {
    const tabs = [tab('a', '/x', { ui: { filtre: 'tous' } })]
    const apres = crmDuplicateTab(tabs, 0, 1)
    expect(apres[1].ui).not.toBe(apres[0].ui)
  })

  it('la copie ne se glisse jamais AVANT la fin du bloc épinglé', () => {
    const tabs = [tab('a', '/x', { pinned: true }), tab('b', '/y', { pinned: true }), tab('c')]
    // On duplique le PREMIER épinglé : la copie est détachée, elle doit sortir du bloc.
    const apres = crmDuplicateTab(tabs, 0, 1)
    expect(apres.findIndex((t) => !t.pinned && t.id !== 'c')).toBeGreaterThanOrEqual(2)
  })
})

describe('crmTabs — fermeture', () => {
  it('⛔ le DERNIER onglet ne se ferme jamais', () => {
    expect(crmCloseTab([tab('a')], 0)).toBeNull()
  })

  it('« fermer les autres » garde la puce visée ET les épinglées', () => {
    const tabs = [tab('a', '/x', { pinned: true }), tab('b'), tab('c'), tab('d')]
    expect(crmCloseOthers(tabs, 2).map((t) => t.id)).toEqual(['a', 'c'])
  })
})

describe('crmTabs — débordement', () => {
  it("l'onglet actif est TOUJOURS visible, même hors fenêtre", () => {
    // 9 onglets, 6 visibles, l'actif est le 8e : il prend le dernier créneau.
    const { visibles, caches } = crmVisibleWindow(9, 7, 6)
    expect(visibles).toHaveLength(6)
    expect(visibles).toContain(7)
    expect(caches).not.toContain(7)
    expect(visibles.length + caches.length).toBe(9)
  })

  it('sans débordement, tout est visible et rien n’est caché', () => {
    const { visibles, caches } = crmVisibleWindow(4, 2, 6)
    expect(visibles).toEqual([0, 1, 2, 3])
    expect(caches).toEqual([])
  })

  it('la puce se resserre avec le nombre d’onglets, et cède 30 px au dock', () => {
    expect(crmChipMaxWidth(3, false)).toBe(240)
    expect(crmChipMaxWidth(5, false)).toBe(170)
    expect(crmChipMaxWidth(9, false)).toBe(128)
    expect(crmChipMaxWidth(3, true)).toBe(210)
  })
})

describe('crmTabs — routes d’enregistrement', () => {
  it('reconnaît les cinq genres résolus par le serveur', () => {
    expect(crmTabRecordRef('/dashboard/contacts/abc')).toEqual({ kind: 'contact', id: 'abc' })
    expect(crmTabRecordRef('/dashboard/listings/xyz')).toEqual({ kind: 'property', id: 'xyz' })
    expect(crmTabRecordRef('/dashboard/transactions/d1')).toEqual({ kind: 'deal', id: 'd1' })
    expect(crmTabRecordRef('/dashboard/kyc/k1')).toEqual({ kind: 'kyc', id: 'k1' })
    expect(crmTabRecordRef('/dashboard/visits/v1')).toEqual({ kind: 'visit', id: 'v1' })
  })

  it('⚠ `listings/:id/edit` est lu comme un BIEN, pas comme un id « edit »', () => {
    // L'ordre des motifs porte cette garantie : le plus spécifique d'abord.
    expect(crmTabRecordRef('/dashboard/listings/xyz/edit')).toEqual({ kind: 'property', id: 'xyz' })
  })

  it('⛔ « new » n’est pas un identifiant', () => {
    // Sinon l'onglet « Nouveau contact » ressortirait en `missing` au premier
    // chargement et retomberait sur la liste, en pleine saisie.
    expect(crmTabRecordRef('/dashboard/contacts/new')).toBeNull()
    expect(crmTabRecordRef('/dashboard/listings/new')).toBeNull()
  })

  it('une liste n’est pas une fiche', () => {
    expect(crmTabRecordRef('/dashboard/contacts')).toBeNull()
    expect(crmTabRecordRef('/dashboard')).toBeNull()
  })

  it('chaque fiche connaît la liste sur laquelle elle retombe', () => {
    expect(crmTabFallbackPath('/dashboard/contacts/abc')).toBe('/dashboard/contacts')
    expect(crmTabFallbackPath('/dashboard/transactions/d1')).toBe('/dashboard/pipeline')
    expect(crmTabFallbackPath('/dashboard/visits/v1')).toBe('/dashboard/calendar')
  })

  it('dédoublonne les références envoyées au serveur', () => {
    // La résolution serveur est bornée à 24 entrées : douze duplications d'une
    // même fiche satureraient la borne et affameraient les autres onglets.
    const tabs = [
      tab('a', '/dashboard/contacts/42'),
      tab('b', '/dashboard/contacts/42'),
      tab('c', '/dashboard/listings/7'),
      tab('d', '/dashboard'),
    ]
    expect(crmTabRefs(tabs)).toEqual([
      { kind: 'contact', id: '42' },
      { kind: 'property', id: '7' },
    ])
  })
})

describe('crmTabs — verdict du serveur sur les libellés', () => {
  it('pose le libellé résolu', () => {
    const tabs = [tab('a', '/dashboard/contacts/42')]
    expect(crmApplyLabels(tabs, { 42: 'Marie Dupont' }, [])[0].label).toBe('Marie Dupont')
  })

  it('⛔ un enregistrement DISPARU retombe sur sa liste — il ne ferme pas l’onglet', () => {
    // Fermer effacerait un onglet que l'agent avait gardé ouvert, sans qu'il
    // sache pourquoi. Le handoff tranche : la vue liste, jamais un écran d'erreur.
    const tabs = [tab('a', '/dashboard/contacts/42', { label: 'Marie Dupont' })]
    const apres = crmApplyLabels(tabs, {}, ['42'])
    expect(apres).toHaveLength(1)
    expect(apres[0].path).toBe('/dashboard/contacts')
    expect(apres[0].label).toBeUndefined()
  })

  it('ne touche pas aux onglets qui ne visent aucun enregistrement', () => {
    const tabs = [tab('a', '/dashboard/pipeline')]
    expect(crmApplyLabels(tabs, { 42: 'X' }, ['99'])[0]).toBe(tabs[0])
  })
})

describe('crmTabs — plafond', () => {
  it('ferme les plus anciens NON épinglés au-delà du plafond', () => {
    const tabs = Array.from({ length: CRM_TABS_CAP + 3 }, (_, i) => tab(`t${i}`))
    const apres = crmApplyCap(tabs, `t${CRM_TABS_CAP + 2}`)
    expect(apres).toHaveLength(CRM_TABS_CAP)
    // Les trois plus anciens sont partis, l'actif est resté.
    expect(apres.find((t) => t.id === 't0')).toBeUndefined()
    expect(apres.find((t) => t.id === `t${CRM_TABS_CAP + 2}`)).toBeDefined()
  })

  it('⚠ ne trahit JAMAIS une épingle, quitte à dépasser le plafond', () => {
    // Le CHECK serveur est à 24 aussi : ce cas ne peut donc pas casser l'écriture.
    const tabs = Array.from({ length: CRM_TABS_CAP + 2 }, (_, i) => tab(`t${i}`, '/x', { pinned: true }))
    expect(crmApplyCap(tabs, 't0')).toHaveLength(CRM_TABS_CAP + 2)
  })

  it('sous le plafond, rend la MÊME référence (aucun rendu inutile)', () => {
    const tabs = [tab('a'), tab('b')]
    expect(crmApplyCap(tabs, 'a')).toBe(tabs)
  })
})

describe('crmTabs — bornes du glisser à grand nombre', () => {
  const jamaisEpingle = () => false

  it('⛔ NE LAISSE PAS DÉPOSER sur le créneau EMPRUNTÉ par l’actif', () => {
    // 15 onglets, actif au rang 12 : la barre montre [0,1,2,3,4,12]. Le dernier
    // créneau n'est pas « la position 6 », c'est un siège emprunté. Sans cette borne,
    // tirer d'UN cran (créneau 4 → 5) déplaçait la puce de HUIT rangs (4 → 12) et la
    // faisait sortir du champ visible — mesuré le 4 septembre 2026.
    const rangs = [0, 1, 2, 3, 4, 12]
    expect(crmDragBounds(rangs, 4, jamaisEpingle)).toEqual({ lo: 0, hi: 4 })
    // Et depuis le siège emprunté lui-même, il n'y a nulle part où aller.
    expect(crmDragBounds(rangs, 5, jamaisEpingle)).toEqual({ lo: 5, hi: 5 })
  })

  it('laisse tout le champ quand la fenêtre est contiguë', () => {
    expect(crmDragBounds([0, 1, 2, 3, 4, 5], 2, jamaisEpingle)).toEqual({ lo: 0, hi: 5 })
  })

  it('⚠ s’arrête à la frontière du bloc épinglé', () => {
    // Rangs 0-1 épinglés, 2-5 non : une puce détachée ne remonte pas dans le bloc.
    const epingle = (rang: number) => rang < 2
    expect(crmDragBounds([0, 1, 2, 3, 4, 5], 3, epingle)).toEqual({ lo: 2, hi: 5 })
    expect(crmDragBounds([0, 1, 2, 3, 4, 5], 0, epingle)).toEqual({ lo: 0, hi: 1 })
  })
})

describe('crmTabs — le régime à GRAND NOMBRE', () => {
  it('mémorise la pile ENTIÈRE, pas la fenêtre visible', () => {
    // La question posée par Julien : « si on ouvre une quinzaine d'onglets, il faut
    // que tout ça soit mémorisé aussi ». `crmVisibleWindow` ne sert QU'À l'affichage :
    // elle rend des INDEX, jamais une pile tronquée.
    const { visibles, caches } = crmVisibleWindow(15, 14, 6)
    expect(visibles).toHaveLength(6)
    expect(caches).toHaveLength(9)
    // Aucun index n'est perdu entre les deux : la pile reste entière.
    expect([...visibles, ...caches].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 15 }, (_, i) => i),
    )
  })

  it('⚠ au-delà de six ÉPINGLÉS, certains passent au menu — limite assumée', () => {
    // Avec 8 épinglés et 6 créneaux, les épinglés 5-7 tombent dans le « +N ». Ce n'est
    // pas un défaut réparable : le handoff impose que l'ACTIF soit toujours visible, et
    // 8 épingles + 1 actif ne tiennent pas dans 6 créneaux. Les épinglés gardent la
    // priorité (ils sont le préfixe) ; au-delà de la capacité, quelque chose doit céder.
    const { visibles, caches } = crmVisibleWindow(15, 12, 6)
    expect(visibles).toEqual([0, 1, 2, 3, 4, 12])
    expect(caches.filter((i) => i < 8)).toEqual([5, 6, 7])
  })
})
