/**
 * Une ligne d'audit écrite par l'IA ou par le système ne porte PAS d'`actor_id`.
 *
 * Le CHECK `activity_events_actor_kind_coherence` (`actor_id IS NULL OR actor_kind = 'user'`)
 * refuse le couple `actor_kind: 'ai'` + `actor_id`. Deux fonctions l'écrivaient quand même —
 * `kyc-report-import` et `extract-property-pdf` — sans lire l'erreur : aucune ligne n'a jamais
 * été écrite (0 en production sur 60 jours, mesuré le 13.09.2026), donc ni trace d'import pour
 * la LBA, ni compte pour leur quota mensuel, qui lit ces lignes. Panne muette, aucun rouge.
 *
 * Cette garde lit TOUTES les edge functions : chaque objet qui pose `actor_kind: 'ai'` ou
 * `'system'` doit poser `actor_id: null` ou ne pas le poser. L'agent qui a demandé l'action
 * se nomme dans `metadata.profile_id` (convention de `_shared/copilot-actions.ts`).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = 'supabase/functions'

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom)
    if (statSync(chemin).isDirectory()) return fichiers(chemin)
    return nom.endsWith('.ts') && !nom.endsWith('.test.ts') ? [chemin] : []
  })
}

/** Bornes de l'objet littéral qui contient la position `i` (accolades équilibrées). */
function objetEnglobant(src: string, i: number): string | null {
  let prof = 0
  let debut = -1
  for (let k = i; k >= 0; k--) {
    if (src[k] === '}') prof++
    else if (src[k] === '{') {
      if (prof === 0) { debut = k; break }
      prof--
    }
  }
  if (debut < 0) return null
  prof = 0
  for (let k = debut; k < src.length; k++) {
    if (src[k] === '{') prof++
    else if (src[k] === '}') {
      prof--
      if (prof === 0) return src.slice(debut, k + 1)
    }
  }
  return null
}

/** Le premier niveau d'un objet littéral : les sous-objets (metadata…) sont vidés. */
function premierNiveau(objet: string): string {
  let interieur = objet.slice(1, -1)
  // Vide les accolades imbriquées de l'intérieur vers l'extérieur.
  for (let avant = ''; avant !== interieur; ) {
    avant = interieur
    interieur = interieur.replace(/\{[^{}]*\}/g, '{}')
  }
  return interieur
}

/** Les objets fautifs d'une source : acteur IA/système qui nomme pourtant un `actor_id`. */
function acteursIncoherents(src: string): string[] {
  const fautes: string[] = []
  for (const m of src.matchAll(/actor_kind\s*:\s*'(ai|system)'/g)) {
    const objet = objetEnglobant(src, m.index)
    if (!objet) continue
    const haut = premierNiveau(objet)
    // `actor_kind` doit être au premier niveau de CET objet (pas dans un metadata imbriqué).
    if (!/actor_kind\s*:\s*'(ai|system)'/.test(haut)) continue
    const valeur = haut.match(/(?:^|[,{\s])actor_id\s*:\s*([^,\n}]+)/)?.[1]?.trim()
    const raccourci = /(?:^|[,{\s])actor_id\s*(?:,|$)/m.test(haut)
    if (raccourci || (valeur !== undefined && valeur !== 'null')) {
      fautes.push(objet.replace(/\s+/g, ' ').slice(0, 120))
    }
  }
  return fautes
}

describe('audit — un acteur IA ou système ne porte pas d’actor_id', () => {
  it('CONTRÔLES — la lecture reconnaît la faute, et seulement elle', () => {
    expect(acteursIncoherents("x.insert({ agency_id: a, actor_id: profile.id, actor_kind: 'ai', metadata: { q: 1 } })")).toHaveLength(1)
    expect(acteursIncoherents("x.insert({ actor_kind: 'system', actor_id })")).toHaveLength(1)
    expect(acteursIncoherents("x.insert({ actor_id: null, actor_kind: 'ai', metadata: { profile_id: p } })")).toEqual([])
    expect(acteursIncoherents("x.insert({ actor_kind: 'ai', metadata: { actor_id: 'imbrique' } })")).toEqual([])
    expect(acteursIncoherents("x.insert({ actor_kind: 'user', actor_id: profile.id })")).toEqual([])
  })

  it('aucune edge function n’écrit le couple interdit', () => {
    const tous = fichiers(RACINE)
    expect(tous.length).toBeGreaterThan(80)
    const fautes = tous.flatMap((f) => acteursIncoherents(readFileSync(f, 'utf8')).map((o) => `${f} : ${o}`))
    expect(fautes).toEqual([])
    // Témoin : la lecture trouve bien des objets IA dans le dépôt (sinon ce test serait vacant).
    const ia = tous.filter((f) => /actor_kind\s*:\s*'ai'/.test(readFileSync(f, 'utf8')))
    expect(ia.length).toBeGreaterThan(3)
  })

  // Les quatre fonctions dont le quota lit ces lignes : l'erreur d'écriture est LUE, et l'agent
  // qui a demandé l'action est nommé. L'import KYC, trace LBA, ne livre rien sans elle ; les
  // trois assistants livrent le résultat déjà payé mais DISENT l'échec.
  it.each(['kyc-report-import', 'extract-property-pdf', 'extract-property-url', 'virtual-staging'])(
    '%s lit l’erreur de son écriture d’audit et nomme l’agent', (fn) => {
      const src = readFileSync(`${RACINE}/${fn}/index.ts`, 'utf8')
      expect(src).toMatch(/const \{ error: auditErr \} = await supabase\.from\('activity_events'\)\.insert\(/)
      expect(src).toMatch(/if \(auditErr\)/)
      expect(src).toMatch(/profile_id: (profile|user)\.id/)
    })

  it('kyc-report-import ne livre pas un import que le journal n’a pas retenu', () => {
    const src = readFileSync(`${RACINE}/kyc-report-import/index.ts`, 'utf8')
    expect(src).toMatch(/if \(auditErr\) \{[\s\S]{0,400}status: 500/)
  })
})
