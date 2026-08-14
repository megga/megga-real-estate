/**
 * Garde-fou : l'interception PostgREST des bancs `/dev/*` rend la BONNE FORME.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * `bancSupabase` décide entre « rendre la ligne » et « rendre le tableau » sur un
 * seul signal : l'en-tête `Accept: application/vnd.pgrst.object+json`, que
 * `postgrest-js` pose quand le hook appelle `.single()` / `.maybeSingle()`.
 *
 * ⛔ IL NE CONNAISSAIT QU'UNE NOTATION D'EN-TÊTE. Le code lisait
 * `init.headers.Accept ?? init.headers.accept` — ce qui ne fonctionne que si
 * `headers` est un OBJET NU. Or `supabase-js` passe une instance de `Headers`,
 * sur laquelle ces deux propriétés valent `undefined` : la valeur n'est
 * atteignable que par `.get('accept')`. Mesuré dans le navigateur, sur
 * `/dev/crm` : `typeDeHeaders: "Headers"`, `litParPointAccept: "(undefined)"`,
 * `litParGet: "application/vnd.pgrst.object+json"`.
 *
 * Conséquence : `objetSeul` était TOUJOURS faux, donc **tout** `.single()` de
 * **tous** les bancs recevait un TABLEAU là où le hook attend un objet — 35
 * appels dans 24 fichiers de hooks. Et l'échec est SILENCIEUX : aucune exception,
 * aucun type faux, la page se dessine avec ses champs à `undefined`. Sur la fiche
 * stricte du KYC, les cinq contrôles s'affichaient « Automatique — en attente »
 * sur un dossier dont le screening était fait — un écran cohérent en apparence et
 * faux en substance. C'est la forme n°14 de `megga/gardes-vacuites` (« ne connaît
 * qu'une notation ») appliquée non plus à une garde mais à un BANC : le mode
 * d'échec est le même — silencieux, et du bon côté du seuil.
 *
 * La garde exige donc les DEUX notations. Une seule aurait laissé passer celle
 * que le dépôt emploie réellement.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase'
import { installerBanc, desinstallerBanc, reglerBanc } from '@/pages/dev/bancSupabase'

const BASE = SUPABASE_FUNCTIONS_URL.replace(/\/functions\/v1$/, '')
const REST = `${BASE}/rest/v1/`

/** L'en-tête que `postgrest-js` pose sur `.single()`. */
const OBJET_SEUL = 'application/vnd.pgrst.object+json'

const LIGNES = [
  { id: 'a', nom: 'Alpha', statut: 'match' },
  { id: 'b', nom: 'Bravo', statut: 'clear' },
]

/**
 * Les deux façons dont un appelant peut porter ses en-têtes.
 *
 * ⚠ `Headers` d'abord : c'est celle que `supabase-js` emploie, donc la seule qui
 * décrive le dépôt. L'objet nu reste éprouvé parce qu'il est la notation que le
 * code connaissait — une garde qui l'abandonnerait rouvrirait l'autre moitié.
 */
const NOTATIONS: { nom: string; porter: (v: string) => HeadersInit }[] = [
  { nom: 'Headers (ce que supabase-js passe)', porter: (v) => new Headers({ Accept: v }) },
  { nom: 'objet nu', porter: (v) => ({ Accept: v }) },
  { nom: 'objet nu, clé minuscule', porter: (v) => ({ accept: v }) },
]

beforeAll(() => {
  installerBanc()
  reglerBanc({ etat: 'nominal', tables: { essais: LIGNES }, rpc: { une_rpc: LIGNES }, rpcVide: {}, session: null })
})
afterAll(() => { desinstallerBanc() })

async function lire(chemin: string, headers?: HeadersInit): Promise<unknown> {
  const r = await window.fetch(`${REST}${chemin}`, headers ? { headers } : undefined)
  return r.json()
}

describe('bancSupabase — la forme rendue suit l’en-tête Accept', () => {
  /**
   * ⛔ CONTRÔLE POSITIF, et il n'est pas décoratif : sans lui, une interception
   * qui ne répondrait RIEN (URL mal reconstruite, module non installé) laisserait
   * les assertions ci-dessous tomber sur `undefined` — et `undefined` n'est pas un
   * tableau, donc la clause « rend un objet » passerait au VERT sur un banc mort.
   */
  it('l’interception répond, et sur les bonnes lignes', async () => {
    const tout = await lire('essais?select=*')
    expect(Array.isArray(tout), 'le banc ne répond pas : URL REST ou installation cassée').toBe(true)
    expect(tout).toHaveLength(2)
    const filtre = await lire('essais?select=*&id=eq.a')
    expect(filtre, 'le prédicat n’est pas appliqué').toEqual([LIGNES[0]])
  })

  for (const { nom, porter } of NOTATIONS) {
    it(`.single() rend un OBJET — notation « ${nom} »`, async () => {
      const rendu = await lire('essais?select=*&id=eq.a', porter(OBJET_SEUL))
      expect(
        Array.isArray(rendu),
        `un TABLEAU est rendu là où .single() attend un objet — l'en-tête n'a pas été lu (${nom})`,
      ).toBe(false)
      expect(rendu).toEqual(LIGNES[0])
    })

    it(`une RPC .single() rend un OBJET — notation « ${nom} »`, async () => {
      const r = await window.fetch(`${REST}rpc/une_rpc`, { method: 'POST', body: '{}', headers: porter(OBJET_SEUL) })
      const rendu: unknown = await r.json()
      expect(Array.isArray(rendu), `RPC : tableau rendu au lieu d'un objet (${nom})`).toBe(false)
      expect(rendu).toEqual(LIGNES[0])
    })
  }

  /**
   * Le pendant : SANS l'en-tête, la forme doit rester un tableau. Sans cette
   * clause, « rendre toujours un objet » passerait les précédentes tout en
   * cassant les 100+ appels de liste.
   */
  it('sans l’en-tête, la forme reste un TABLEAU', async () => {
    expect(Array.isArray(await lire('essais?select=*&id=eq.a'))).toBe(true)
    expect(Array.isArray(await lire('essais?select=*', new Headers({ Accept: 'application/json' })))).toBe(true)
  })

  /**
   * Une table sans fixture rend `[]`, et `.single()` dessus rend `null` — jamais
   * `undefined`, que `JSON.stringify` transforme en corps illisible.
   */
  it('une table sans fixture rend une forme lisible dans les deux cas', async () => {
    expect(await lire('inconnue?select=*')).toEqual([])
    expect(await lire('inconnue?select=*', new Headers({ Accept: OBJET_SEUL }))).toBeNull()
  })
})
