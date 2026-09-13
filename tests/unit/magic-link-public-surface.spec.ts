/**
 * Surface PUBLIQUE des jetons magiques — ce que lit un porteur de lien (audit S10, 13.09.2026).
 *
 * POURQUOI UNE GARDE DE SOURCE. `magic-link-get` servait `ocr_fields`, le nom de famille, le
 * message et le slug de l'agence parce que ses `select` les listaient : la surface publique
 * était exactement ce que la requête nommait, et rien ne l'aurait vu grandir. La liste
 * blanche (`_shared/magic-link-public-view.ts`) a ses propres tests ; ce fichier-ci tient le
 * CÂBLAGE — que la réponse passe bien par elle, et qu'aucun autre porteur de jeton ne
 * rouvre la même porte par un `select('*')` ou un champ OCR.
 *
 * LE PÉRIMÈTRE est l'ensemble EXACT des edge functions qui appellent `verifyMagicLinkToken`
 * — le prédicat de `scripts/check-edge-auth.mjs`. Il est figé ici : une fonction porteuse
 * qui apparaît (ou disparaît) fait rougir, et oblige à la regarder.
 *
 * Chaque détecteur est d'abord éprouvé sur un extrait écrit comme le code d'AVANT le
 * correctif : un détecteur qui ne verrait rien serait vert pour de mauvaises raisons.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'

/** Blanchit commentaires de bloc et de ligne — la prose qui NOMME un champ n'est pas du code. */
const sansCommentaires = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, ' ')

const PORTEURS_ATTENDUS = [
  'appointment-book',
  'appointment-manage',
  'appointment-slots',
  'buyer-reception-get',
  'buyer-reception-react',
  'email-unsubscribe',
  'kyc-report-data',
  'magic-link-confirm',
  'magic-link-get',
  'magic-link-upload',
]

/** Les `index.ts` d'edge function qui appellent `verifyMagicLinkToken`, commentaires blanchis. */
function porteurs(): Map<string, string> {
  const racine = repoPath('supabase/functions')
  const out = new Map<string, string>()
  for (const dir of readdirSync(racine, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue
    let source: string
    try {
      source = readFileSync(repoPath('supabase/functions', dir.name, 'index.ts'), 'utf-8')
    } catch {
      continue // pas d'index.ts : pas une fonction déployable
    }
    const code = sansCommentaires(source)
    if (code.includes('verifyMagicLinkToken(')) out.set(dir.name, code)
  }
  return out
}

// ─── Détecteurs ────────────────────────────────────────────────────────────

/** Un champ OCR lu dans le code. */
const litOcr = (code: string): boolean => /\bocr_fields\b/.test(code)

/**
 * `select('*')`, `select()` ou un embarqué `(*)` sur les deux tables qui portent de
 * l'identité : le joker rendrait public tout champ ajouté demain.
 */
function selectJoker(code: string): string[] {
  const fautes: string[] = []
  const direct = /\.from\(\s*['"](contacts|kyc_magic_link_uploads)['"]\s*\)\s*\.select\(\s*(\)|['"`]\s*\*)/g
  for (const m of code.matchAll(direct)) fautes.push(m[0])
  for (const m of code.matchAll(/\b(contacts|kyc_magic_link_uploads)\s*\(\s*\*\s*\)/g)) fautes.push(m[0])
  return fautes
}

/** Les variables qui reçoivent le résultat de `verifyMagicLinkToken` (`const v = await …`). */
const variablesDeVerification = (code: string): string[] =>
  [...code.matchAll(/\b(?:const|let)\s+([A-Za-z_]\w*)\s*=\s*await\s+verifyMagicLinkToken\(/g)].map((m) => m[1])

/**
 * Le motif interne de `verifyMagicLinkToken` recopié tel quel : `reason: v.reason` (valeur
 * nue) ou `${v.reason}` dans un gabarit, où `v` a reçu le résultat de la vérification. La
 * forme réduite `reason: v.reason === 'expired' ? … : …` n'est pas une recopie, et le motif
 * d'un AUTRE contrôle (le tri du Content-Length, ensemble fermé) n'est pas concerné.
 */
function recopieMotif(code: string): string[] {
  const fautes: string[] = []
  for (const nom of variablesDeVerification(code)) {
    for (const m of code.matchAll(new RegExp(`\\breason\\s*:\\s*${nom}\\.reason\\s*(?=[,})\\n])`, 'g'))) fautes.push(m[0])
    for (const m of code.matchAll(new RegExp(`\\$\\{\\s*${nom}\\.reason\\b`, 'g'))) fautes.push(m[0])
  }
  return fautes
}

/** Arguments (parenthèses équilibrées) de chaque appel `JSON.stringify(…)`. */
function argumentsDeStringify(code: string): string[] {
  const out: string[] = []
  let i = code.indexOf('JSON.stringify(')
  while (i !== -1) {
    const debut = i + 'JSON.stringify('.length
    let profondeur = 1
    let j = debut
    for (; j < code.length && profondeur > 0; j++) {
      if (code[j] === '(') profondeur++
      else if (code[j] === ')') profondeur--
    }
    out.push(code.slice(debut, j - 1))
    i = code.indexOf('JSON.stringify(', j)
  }
  return out
}

/** Une ligne lue en base sérialisée SANS passer par la liste blanche. */
function serialiseUneLigne(code: string): string[] {
  return argumentsDeStringify(code).filter(
    (a) => /\b\w+Res\.data\b|\buploads\s*:/.test(a) && !a.trimStart().startsWith('buildMagicLinkPublicView('),
  )
}

/** La chaîne passée au premier `.select(…)` qui suit `.from('<table>')`. */
function selectDe(code: string, table: string): string | null {
  const i = code.indexOf(`.from('${table}')`)
  if (i === -1) return null
  const m = /\.select\(\s*(['"`])([^'"`]*)\1/.exec(code.slice(i))
  return m ? m[2] : null
}

/** Clés du premier littéral objet sérialisé après `marqueur`. */
function clesSerialiseesApres(code: string, marqueur: string): string[] | null {
  const i = code.indexOf(marqueur)
  if (i === -1) return null
  const [arg] = argumentsDeStringify(code.slice(i))
  if (!arg) return null
  return [...arg.matchAll(/(?:^|[{,])\s*([A-Za-z_]\w*)\s*:/g)].map((m) => m[1])
}

// ─── Extraits écrits comme le code d'AVANT le correctif (contrôles des détecteurs) ───

const AVANT_GET = `
  supabase.from('contacts').select('first_name, last_name').eq('id', link.contact_id).single(),
  supabase.from('kyc_magic_link_uploads')
    .select('id, type, filename, size_bytes, uploaded_at, confirmed_by_client, ocr_fields')
  return new Response(JSON.stringify({ magic_link_id: link.id, uploads: uploadsRes.data ?? [] }), {})
`
const AVANT_SLOTS = `
  const verified = await verifyMagicLinkToken(token)
  return json({ error: 'Invalid link', reason: verified.reason }, 401)
`
const AVANT_REPORT = `
  const v = await verifyMagicLinkToken(token)
  return json({ error: \`invalid token: \${v.reason ?? 'unknown'}\` }, 401)
`

describe('détecteurs — éprouvés sur le code d’avant le correctif', () => {
  it('litOcr voit un select OCR, et ignore la prose d’un commentaire', () => {
    expect(litOcr(AVANT_GET)).toBe(true)
    expect(litOcr(sansCommentaires("// ocr_fields ne sort jamais\nconst x = 1\n"))).toBe(false)
    expect(litOcr(sansCommentaires("/* ocr_fields */ const y = 2"))).toBe(false)
  })

  it('selectJoker voit `*`, `select()` et l’embarqué `(*)`, pas une liste nommée', () => {
    expect(selectJoker(".from('contacts').select('*')")).toHaveLength(1)
    expect(selectJoker(".from('kyc_magic_link_uploads')\n  .select()")).toHaveLength(1)
    expect(selectJoker(".from('kyc_cases').select('*, contact:contacts(*)')")).toHaveLength(1)
    expect(selectJoker(".from('contacts').select('first_name')")).toEqual([])
    expect(selectJoker(".from('kyc_cases').select('*, contact:contacts(first_name, last_name)')")).toEqual([])
  })

  it('recopieMotif voit la recopie nue et le gabarit, pas la forme réduite ni un autre motif', () => {
    expect(recopieMotif(AVANT_SLOTS)).toHaveLength(1)
    expect(recopieMotif(AVANT_REPORT)).toHaveLength(1)
    const lie = 'const verified = await verifyMagicLinkToken(token)\n'
    expect(recopieMotif(`${lie}{ reason: verified.reason === 'expired' ? 'expired' : 'invalid' }`)).toEqual([])
    expect(recopieMotif(`${lie}{ reason: expire ? 'expired' : 'invalid' }`)).toEqual([])
    // Le motif du tri de requête est un ensemble fermé : il n'est pas celui de la vérification.
    expect(recopieMotif(`${lie}{ reason: tri.reason }`)).toEqual([])
  })

  it('serialiseUneLigne voit une ligne sérialisée brute, pas la liste blanche', () => {
    expect(serialiseUneLigne(AVANT_GET)).toHaveLength(1)
    expect(serialiseUneLigne('JSON.stringify(buildMagicLinkPublicView({ uploads: uploadsRes.data }))')).toEqual([])
  })

  it('selectDe lit la chaîne du select qui suit la table', () => {
    expect(selectDe(AVANT_GET, 'contacts')).toBe('first_name, last_name')
    expect(selectDe(AVANT_GET, 'agencies')).toBeNull()
  })
})

describe('porteurs de jeton magique — surface publique', () => {
  const PORTEURS = porteurs()

  it('le périmètre est EXACTEMENT les dix edge functions qui vérifient un jeton magique', () => {
    // Contrôle positif ET garde de dérive : un prédicat qui ne matcherait rien rendrait
    // toutes les assertions suivantes vertes sur zéro fichier.
    expect([...PORTEURS.keys()].sort()).toEqual(PORTEURS_ATTENDUS)
  })

  it('aucun porteur ne lit un champ OCR', () => {
    const fautifs = [...PORTEURS].filter(([, code]) => litOcr(code)).map(([nom]) => nom)
    expect(fautifs).toEqual([])
  })

  it('aucun porteur ne sélectionne `*` (ou rien) sur contacts ni sur les pièces KYC', () => {
    const fautes = [...PORTEURS].flatMap(([nom, code]) => selectJoker(code).map((f) => `${nom}: ${f}`))
    expect(fautes).toEqual([])
  })

  it('aucun porteur ne recopie le motif interne de la vérification (no_secret, malformed…)', () => {
    // Témoin du détecteur : il trouve la variable de vérification de CHAQUE porteur — sans
    // elle, il ne regarderait rien et serait vert sur tout.
    const aveugles = [...PORTEURS].filter(([, code]) => variablesDeVerification(code).length === 0).map(([nom]) => nom)
    expect(aveugles).toEqual([])
    const fautes = [...PORTEURS].flatMap(([nom, code]) => recopieMotif(code).map((f) => `${nom}: ${f}`))
    expect(fautes).toEqual([])
    // Témoin : la forme RÉDUITE est bien présente là où la vérification échoue en public.
    for (const nom of ['magic-link-get', 'magic-link-upload', 'appointment-slots', 'appointment-book', 'appointment-manage']) {
      expect(PORTEURS.get(nom), nom).toMatch(/'expired'\s*:\s*'invalid'/)
    }
  })

  it('kyc-report-data n’accepte qu’un jeton de rendu (isReportTokenPayload) après la signature', () => {
    const code = PORTEURS.get('kyc-report-data') ?? ''
    const verif = code.indexOf('verifyMagicLinkToken(')
    const garde = code.indexOf('isReportTokenPayload(')
    expect(verif).toBeGreaterThan(-1)
    expect(garde, 'la garde de famille doit suivre la vérification').toBeGreaterThan(verif)
    // Et elle précède la première lecture du dossier.
    expect(garde).toBeLessThan(code.indexOf(".from('kyc_cases')"))
  })
})

describe('magic-link-get — la réponse passe par la liste blanche', () => {
  const code = sansCommentaires(readFileSync(repoPath('supabase/functions/magic-link-get/index.ts'), 'utf-8'))

  it('la vue d’un lien ouvert est `JSON.stringify(buildMagicLinkPublicView(…))`', () => {
    expect(code).toContain('JSON.stringify(buildMagicLinkPublicView(')
    // Témoin du détecteur sur le fichier réel : il lit bien plusieurs sérialisations.
    expect(argumentsDeStringify(code).length).toBeGreaterThanOrEqual(4)
    expect(serialiseUneLigne(code)).toEqual([])
  })

  it('les select sont réduits : ni nom de famille, ni slug, ni champ OCR', () => {
    expect(selectDe(code, 'contacts')).toBe('first_name')
    expect(selectDe(code, 'agencies')).toBe('name')
    expect(selectDe(code, 'kyc_magic_link_uploads')).toBe('id, type, filename, size_bytes, uploaded_at')
    expect(selectDe(code, 'kyc_magic_links')).not.toMatch(/custom_message|kyc_case_id|channels/)
  })

  it('un lien soumis ne rend que {status, confirmed_at, message}', () => {
    expect(clesSerialiseesApres(code, "if (link.status === 'submitted')")).toEqual(['status', 'confirmed_at', 'message'])
  })
})
