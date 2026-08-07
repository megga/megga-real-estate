// Garde-fou du garde-fou : la classification des aléas FS de `helpers/fs-scan.ts`.
//
// POURQUOI CE TEST EXISTE. Ce helper porte désormais la correction de trois garde-fous
// statiques (activity_events, cibles de nav admin, export CSV). Toute sa valeur tient à UNE
// distinction : « le chemin a disparu » (on ignore — personne ne dissimule du code dans un
// fichier inexistant) vs « le chemin existe mais refuse de s'ouvrir » (on signale, sans
// jamais le confondre avec un coupable). Se tromper de côté ramène exactement l'un des deux
// défauts qu'on vient de corriger : ignorer un verrou rend le vert FAUX, signaler une
// disparition rend le rouge FAUX.
//
// Or cette logique n'est autrement observable qu'en COURANT contre le système de fichiers —
// ce qui ne se scripte pas de façon déterministe. On injecte donc les erreurs errno
// directement : le comportement est prouvé sans course, et sans test intermittent (il serait
// piquant d'en introduire un ici).

import { describe, it, expect } from 'vitest'
import {
  REPO, emptyRoots, readFileSafely, readSafely, rel, repoPath, scanRoots,
} from './helpers/fs-scan'

/** Erreur errno synthétique, à l'image de celles que lève `node:fs`. */
const errno = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`${code}: opération refusée, open 'fictif'`), { code })

describe('fs-scan — classification des aléas FS', () => {
  it('ENOENT et ENOTDIR = « disparu » : ignoré en silence, sans retry', () => {
    for (const code of ['ENOENT', 'ENOTDIR']) {
      let appels = 0
      const r = readSafely(() => { appels++; throw errno(code) })
      expect(r.status, `${code} doit être classé « gone »`).toBe('gone')
      // Retenter n'a aucun sens : un fichier supprimé ne réapparaît pas, et l'attente
      // se paierait sur chaque fichier qu'un écrivain concurrent fait disparaître.
      expect(appels, `${code} ne doit pas être retenté`).toBe(1)
    }
  })

  it('un verrou (EBUSY, EPERM…) est retenté, puis signalé comme illisible', () => {
    for (const code of ['EBUSY', 'EPERM', 'EACCES', 'EMFILE', 'ENFILE', 'EAGAIN']) {
      let appels = 0
      const r = readSafely(() => { appels++; throw errno(code) })
      expect(r.status, `${code} doit être classé « unreadable »`).toBe('unreadable')
      expect(appels, `${code} doit être retenté (3 tentatives)`).toBe(3)
      // Le message doit rester exploitable : c'est tout ce qu'un humain aura pour
      // comprendre que sa CI a croisé un antivirus, et non une infraction.
      if (r.status === 'unreadable') expect(r.error).toContain(code)
    }
  })

  it('un verrou qui se relâche rend la valeur — pas une fausse alerte', () => {
    let appels = 0
    const r = readSafely(() => {
      appels++
      if (appels === 1) throw errno('EBUSY')
      return 'contenu'
    })
    expect(r.status).toBe('ok')
    expect(r.status === 'ok' && r.value).toBe('contenu')
    expect(appels, 'la 2ᵉ tentative doit suffire').toBe(2)
  })

  it('une erreur qui n\'est pas un aléa FS remonte telle quelle, sans retry', () => {
    // Sans ce cas, un vrai bug du helper (TypeError…) serait patiemment retenté trois
    // fois puis maquillé en « aléa d'environnement ».
    let appels = 0
    const r = readSafely(() => { appels++; throw new Error('bug de programmation') })
    expect(r.status).toBe('unreadable')
    expect(appels, 'une erreur sans code errno ne doit pas être retentée').toBe(1)
    if (r.status === 'unreadable') expect(r.error).toContain('bug de programmation')
  })

  it('un fichier réellement absent est « disparu », pas « illisible »', () => {
    // Le cas exact de la course readdir → open : le chemin s'évapore entre les deux.
    expect(readFileSafely(repoPath('ce/chemin/n/existe/pas.ts')).status).toBe('gone')
  })
})

describe('fs-scan — ancrage et sortie stable', () => {
  it('les racines sont ancrées sur le dépôt, pas sur le cwd', () => {
    // La preuve par un fichier que le dépôt porte forcément.
    expect(rel(repoPath('package.json'))).toBe('package.json')
    expect(REPO.length).toBeGreaterThan(0)
  })

  it('les chemins sortent en repo-relatif à séparateurs `/`', () => {
    // Sous Windows, `join` rend des `\` : sans normalisation, les messages d'infraction
    // et les comparaisons de chemins divergent entre local et CI.
    const p = rel(repoPath('src', 'components', 'admin', 'AdminShell.tsx'))
    expect(p).toBe('src/components/admin/AdminShell.tsx')
    expect(p).not.toContain('\\')
  })

  it('une racine absente ne jette pas et ne pollue pas les illisibles', () => {
    // Elle doit rester DÉTECTABLE (racine vide) plutôt que se déguiser en erreur de
    // lecture : c'est le contrôle positif de chaque garde-fou qui doit la nommer.
    const scan = scanRoots([{ root: 'racine/absente', keep: () => true }])
    expect(scan.files).toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(emptyRoots(scan)).toEqual(['racine/absente'])
  })

  it('le balayage est ordonné, donc reproductible d\'une exécution à l\'autre', () => {
    // `src/hooks` est PLAT par convention projet (CLAUDE.md) : l'ordre des chemins s'y
    // réduit à l'ordre des noms, exactement ce que le scanner trie.
    const spec = [{ root: 'src/hooks', keep: (n: string) => n.startsWith('useAdmin') }]
    const a = scanRoots(spec).files.map(rel)
    const b = scanRoots(spec).files.map(rel)

    expect(a.length, 'périmètre témoin vide : src/hooks a bougé ?').toBeGreaterThan(10)

    // LA garantie : sans tri explicite, `readdir` peut rendre deux ordres différents et
    // la liste de coupables d'un garde-fou devient illisible d'une exécution à l'autre.
    // Même comparateur que le scanner — `sort()` par défaut ordonne par unité UTF-16 et
    // diverge de `localeCompare` dès qu'une casse mixte apparaît.
    expect(a).toEqual([...a].sort((x, y) => x.localeCompare(y)))

    // ⚠ On ne suppose PAS un arbre gelé, et c'est délibéré : ce test a d'abord comparé
    // `a` et `b` à l'identique, et il rougissait 7 fois sur 10 sous churn concurrent —
    // un fichier créé ou supprimé entre les deux scans suffisait. C'était le test qui
    // avait tort, pas le scanner : introduire un test intermittent dans le lot qui en
    // corrige trois aurait été savoureux. Seul l'ordre RELATIF des fichiers vus des DEUX
    // côtés est une propriété du scanner.
    expect(a.filter((f) => b.includes(f))).toEqual(b.filter((f) => a.includes(f)))
  })

  it('le filtre porte sur le NOM du fichier, jamais sur son chemin', () => {
    // `keep(chemin)` au lieu de `keep(nom)` ferait matcher n'importe quel filtre sur un
    // segment de répertoire — une classe de faux positifs discrète.
    const scan = scanRoots([{ root: 'src/hooks', keep: (n) => n.startsWith('useAdmin') }])
    expect(scan.files.length).toBeGreaterThan(10)
    for (const f of scan.files.map(rel)) {
      expect(f.slice(f.lastIndexOf('/') + 1).startsWith('useAdmin'), `${f} ne devrait pas passer le filtre`).toBe(true)
    }
  })
})
