/**
 * Aucune valeur i18n n'est un TABLEAU écrit en chaîne JSON.
 *
 * ⛔ Le 13.09.2026, cinq listes des Réglages (`integrations.details.permissions.*`,
 * `integrations.whatsapp.examples`) valaient `"[\"Calendar : …\"]"` dans les quatre
 * langues — un aplatissement de la vague i18n de juin 2026. Leurs lecteurs appelaient
 * `t(clé, { returnObjects: true }) as string[]` puis `.map` : ouvrir le détail d'une
 * intégration, ou afficher la carte WhatsApp liée, levait « permissions.map is not a
 * function » et faisait tomber tout le CRM sur « Une erreur est survenue ». Aucune porte
 * ne le voyait : `i18n:parity` compare des clés, pas la FORME des valeurs.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'
import { listeTraduite } from '@/lib/listeTraduite'

const RACINE = repoPath('src/i18n/locales')

function chainesTableaux(): string[] {
  const fautifs: string[] = []
  for (const langue of readdirSync(RACINE)) {
    for (const fichier of readdirSync(`${RACINE}/${langue}`).filter((f) => f.endsWith('.json'))) {
      const walk = (o: unknown, chemin: string) => {
        if (typeof o === 'string') {
          const s = o.trim()
          if (s.startsWith('[') && s.endsWith(']')) {
            try {
              if (Array.isArray(JSON.parse(s))) fautifs.push(`${langue}/${fichier} : ${chemin}`)
            } catch { /* une chaîne entre crochets qui n'est pas du JSON : du texte */ }
          }
        } else if (o && typeof o === 'object' && !Array.isArray(o)) {
          for (const [k, v] of Object.entries(o)) walk(v, chemin ? `${chemin}.${k}` : k)
        }
      }
      walk(JSON.parse(readFileSync(`${RACINE}/${langue}/${fichier}`, 'utf8')), '')
    }
  }
  return fautifs
}

describe('i18n — les listes sont de vrais tableaux', () => {
  it('aucune valeur n’est un tableau JSON écrit en chaîne', () => {
    expect(chainesTableaux()).toEqual([])
  })

  it('le garde rend un tableau quelle que soit la forme reçue', () => {
    expect(listeTraduite(['a', 'b'])).toEqual(['a', 'b'])
    expect(listeTraduite('["a","b"]')).toEqual(['a', 'b'])
    expect(listeTraduite('clé.absente')).toEqual([])
    expect(listeTraduite(undefined)).toEqual([])
  })
})
