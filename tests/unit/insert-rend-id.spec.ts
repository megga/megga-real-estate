/**
 * Garde-fou : un insert cache-helpers dont on LIT le résultat déclare sa requête `select`.
 *
 * ── CE QUI A MOTIVÉ CE FICHIER ───────────────────────────────────────────────
 * `useInsertMutation(qb, clés, requête?)` ne rend à l'appelant QUE les colonnes de sa
 * requête : sans troisième argument, un tableau VIDE, quelle que soit la réponse de
 * PostgREST (`getUserResponse` filtre des `userQueryData` qui ne sont jamais construits).
 * Relevé le 27.09.2026 en jouant « Nouveau deal » sur le banc `/dev/crm` :
 *
 *  · `useCreateTransaction` rendait `undefined`. Les trois créations de deal lisaient
 *    l'id rendu : le « Premier suivi » à J+2 n'était jamais posé, et l'ajout en ligne du
 *    Pipeline restait ouvert après avoir créé — un second clic, un doublon ;
 *  · `useCreateContact` aussi : « Nouveau deal » avec un client neuf créait le contact,
 *    puis échouait sur `undefined.id` sans créer le deal.
 *
 * Aucun test ne pouvait le voir : un mock de Supabase rend la ligne, la librairie non.
 *
 * La dette relevée ce jour-là est soldée le 28.09.2026 : `useVisits` rendait `undefined`
 * aussi, et le Calendrier ne poussait JAMAIS une visite créée vers Google ou Outlook
 * (`propagateVisit` attend son id) ; `useReminders` de même, sans lecteur encore.
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────
 * Dans `src/`, un `useInsertMutation` sans requête dont le résultat est AFFECTÉ
 * (`const x = await insert.mutateAsync(…)`) est un défaut — sans exception.
 *
 * ⚠ Ce que la garde NE prouve PAS : qu'un appelant lit bien le champ que la requête
 * demande. Elle empêche le cas où il n'y a RIEN à lire.
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

/** Nombre d'arguments d'un appel, à partir de sa parenthèse ouvrante (chaînes et imbrications comprises). */
function nombreArguments(texte: string, ouverture: number): number {
  let profondeur = 0
  let virgules = 0
  let contenu = false
  let chaine: string | null = null
  for (let i = ouverture; i < texte.length; i++) {
    const c = texte[i]
    if (chaine) {
      if (c === chaine && texte[i - 1] !== '\\') chaine = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { chaine = c; contenu = true; continue }
    if (c === '(' || c === '[' || c === '{') { profondeur++; if (profondeur > 1) contenu = true; continue }
    if (c === ')' || c === ']' || c === '}') {
      profondeur--
      if (profondeur === 0) return virgules + (contenu ? 1 : 0)
      continue
    }
    if (c === ',' && profondeur === 1) { virgules++; contenu = false; continue }
    if (!/\s/.test(c)) contenu = true
  }
  return -1
}

function inventaire() {
  const scan = scanRoots([{ root: 'src', keep: (n) => /\.(ts|tsx)$/.test(n) }])
  const appels: { cle: string; args: number; lu: boolean }[] = []
  for (const abs of scan.files) {
    const chemin = rel(abs)
    if (chemin.startsWith('src/pages/dev/')) continue
    const lu = readFileSafely(abs)
    if (lu.status !== 'ok') continue
    const texte = lu.value
    for (const m of texte.matchAll(/const\s+(\w+)\s*=\s*useInsertMutation\(/g)) {
      const nom = m[1]
      const args = nombreArguments(texte, (m.index ?? 0) + m[0].length - 1)
      const resultatLu = new RegExp(`=\\s*await\\s+${nom}\\.mutateAsync\\(`).test(texte)
      appels.push({ cle: `${chemin}:${nom}`, args, lu: resultatLu })
    }
  }
  return { scan, appels }
}

describe('insert cache-helpers — un résultat lu est un résultat demandé', () => {
  it('aucun insert sans requête dont le résultat est affecté', () => {
    const { scan, appels } = inventaire()
    expect(emptyRoots(scan), 'racine vide : chemin cassé').toEqual([])
    // Contrôle positif : six inserts au 27.09.2026 — un motif cassé rendrait la garde verte à vide.
    expect(appels.length).toBeGreaterThanOrEqual(5)
    expect(appels.every((a) => a.args > 0), 'arguments illisibles : l’analyseur a décroché').toBe(true)

    const fautifs = appels
      .filter((a) => a.args < 3 && a.lu)
      .map((a) => a.cle)
    expect(fautifs, 'insert lu sans requête `select` : il rend un tableau vide').toEqual([])
  })

  it('les créations de deal, de contact, de visite et de rappel demandent leur id', () => {
    const { appels } = inventaire()
    for (const cle of [
      'src/hooks/useTransactions.ts:insert', 'src/hooks/useContacts.ts:insert',
      'src/hooks/useVisits.ts:insertVisit', 'src/hooks/useReminders.ts:insertReminder',
    ]) {
      const appel = appels.find((a) => a.cle === cle)
      expect(appel, `${cle} introuvable`).toBeDefined()
      expect(appel?.args, `${cle} : sa requête a disparu`).toBe(3)
    }
  })
})
