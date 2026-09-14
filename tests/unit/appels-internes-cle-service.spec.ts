/**
 * Un appel de fonction à fonction sous la clé de SERVICE vise une fonction qui ACCEPTE la clé
 * de service.
 *
 * ⛔ LE DÉFAUT QUI L'A FAIT NAÎTRE (audit du 13.09.2026, corrigé le 14.09.2026). L'exécuteur
 * WhatsApp `executeSendClientEmail` appelait l'edge `send-relance-email` sous
 * `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`. Cette fonction exige le JWT d'un
 * AGENT : `requireAgentAuth` refuse toute clé d'API (`isNonUserToken`), donc 401 à chaque
 * « oui », rattrapé en « l'email n'est pas parti ». Aucune porte ne le voyait :
 * `lint:edge-auth` vérifie que chaque fonction se garde, pas que ses appelants internes
 * passent sa garde. Le correctif n'a pas ouvert la fonction : l'exécuteur appelle désormais
 * `_shared/relance-email-send.ts` en direct.
 *
 * CE QUE LA GARDE LIT. Chaque source edge (`index.ts` et `_shared/**`, tests exclus), dans la
 * vue « code » du lexique de `scripts/_shared/edge-guard-order.mjs` (commentaires blanchis) :
 *   · chaque `fetch(` dont l'URL est bâtie par `urlFonction(base, 'nom')` — le seul
 *     constructeur permis (tests/unit/region-fonctions.spec.ts) —, sur place ou par une
 *     variable du même fichier ;
 *   · ses arguments portent-ils la clé de service : le nom de la variable d'environnement, ou
 *     un identifiant du fichier qui en dérive (`const serviceKey = Deno.env.get(…)`, puis
 *     `cfg || serviceKey`…, propagé jusqu'au point fixe) ?
 * Si oui, la fonction visée doit APPELER `isServiceSecret(` — la garde partagée qui accepte un
 * appelant de service (clé de l'env ou d'app_config, _shared/require-service-secret.ts).
 *
 * ⚠ CE QU'ELLE NE VOIT PAS : une URL ou un en-tête reçus en paramètre ; la portée d'une
 * variable (un nom réutilisé dans un fichier compte pour toutes ses cibles — l'erreur va vers
 * plus de contrôles, jamais moins) ; les appels de la BASE (pg_net), qui ont leurs bancs. Un
 * `functions.invoke(` dans le code edge ne se lit pas ici : la garde le REFUSE plutôt que de
 * conclure sur ce qu'elle n'a pas lu.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'
// @ts-expect-error — helper Node de `scripts/` : pas de types, et c'est voulu (CLAUDE.md §4).
import { lexer } from '../../scripts/_shared/edge-guard-order.mjs'

const lex = lexer as (source: string) => { code: string; masque: string }

interface Appel {
  /** Fichier de l'appelant, repo-relatif. */
  fichier: string
  ligne: number
  /** La fonction edge visée. */
  cible: string
  /** Les arguments du `fetch(` portent-ils la clé de service ? */
  cleService: boolean
}

const PAIRES: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Index du fermant qui équilibre l'ouvrant en `i`, sur le masque (chaînes blanchies) ; -1 sinon. */
function fermant(masque: string, i: number): number {
  const pile: string[] = []
  for (let j = i; j < masque.length; j++) {
    const c = masque[j]
    if (PAIRES[c]) pile.push(PAIRES[c])
    else if (c === ')' || c === ']' || c === '}') {
      if (pile.pop() !== c) return -1
      if (pile.length === 0) return j
    }
  }
  return -1
}

/** Arguments de premier niveau de l'appel dont la parenthèse ouvrante est en `p`. */
function argumentsAppel(code: string, masque: string, p: number): string[] {
  const f = fermant(masque, p)
  if (f < 0) return []
  const out: string[] = []
  let prof = 0
  let debut = p + 1
  for (let j = p + 1; j < f; j++) {
    const c = masque[j]
    if (c === '(' || c === '[' || c === '{') prof++
    else if (c === ')' || c === ']' || c === '}') prof--
    else if (c === ',' && prof === 0) { out.push(code.slice(debut, j).trim()); debut = j + 1 }
  }
  const dernier = code.slice(debut, f).trim()
  if (dernier) out.push(dernier)
  return out
}

/** Fin de l'instruction commencée en `i` : `;` ou fin de ligne hors groupe, sauf continuation. */
function finInstruction(masque: string, i: number): number {
  let prof = 0
  for (let j = i; j < masque.length; j++) {
    const c = masque[j]
    if (c === '(' || c === '[' || c === '{') prof++
    else if (c === ')' || c === ']' || c === '}') { if (--prof < 0) return j }
    else if (c === ';' && prof === 0) return j
    else if (c === '\n' && prof === 0) {
      const suite = /^\s*(\S)/.exec(masque.slice(j + 1))?.[1] ?? ''
      if (suite === '' || !'.?:|&+'.includes(suite)) return j
    }
  }
  return masque.length
}

/** `urlFonction(base, 'nom'…)` dans un texte : le nom visé, sinon null. */
function cibleUrl(texte: string): string | null {
  const { code, masque } = lex(texte)
  const m = /(?<![\w$.])urlFonction\s*\(/.exec(masque)
  if (!m) return null
  const args = argumentsAppel(code, masque, m.index + m[0].length - 1)
  return /^(['"`])([\w-]+)\1$/.exec(args[1] ?? '')?.[2] ?? null
}

/** Déclarations `const|let|var nom = <expression>` du fichier : [nom, texte de l'expression]. */
function declarations(code: string, masque: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const m of masque.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=(?![=>])/g)) {
    const debut = m.index + m[0].length
    out.push([m[1], code.slice(debut, finInstruction(masque, debut))])
  }
  return out
}

/**
 * Les appels internes d'une source, et ses `functions.invoke(` (illisibles ici). Pure : la
 * source est passée, pas lue — c'est ce qui permet d'éprouver la lecture sur une fixture.
 */
function appelsInternes(fichier: string, source: string): { appels: Appel[]; invocations: number[] } {
  const { code, masque } = lex(source)
  const decl = declarations(code, masque)

  // Identifiant → fonctions qu'il désigne (`const url = urlFonction(…, 'x')`).
  const urls = new Map<string, Set<string>>()
  for (const [nom, expr] of decl) {
    const cible = cibleUrl(expr)
    if (cible) urls.set(nom, new Set([...(urls.get(nom) ?? []), cible]))
  }

  // Identifiants qui portent la clé de service, propagés jusqu'au point fixe.
  const porteurs = new Set<string>()
  const porteCle = (texte: string): boolean => texte.includes('SUPABASE_SERVICE_ROLE_KEY')
    || [...porteurs].some((p) => new RegExp(String.raw`(?<![\w$.])${echapper(p)}(?![\w$])`).test(texte))
  for (let change = true; change;) {
    change = false
    for (const [nom, expr] of decl) {
      if (!porteurs.has(nom) && porteCle(expr)) { porteurs.add(nom); change = true }
    }
  }

  const ligne = (i: number): number => source.slice(0, i).split('\n').length
  const appels: Appel[] = []
  for (const m of masque.matchAll(/(?<![\w$.])fetch\s*\(/g)) {
    const args = argumentsAppel(code, masque, m.index + m[0].length - 1)
    const premier = args[0] ?? ''
    const directe = cibleUrl(premier)
    const cibles = directe ? [directe] : [...(urls.get(/^[A-Za-z_$][\w$]*$/.test(premier) ? premier : '') ?? [])]
    const cleService = args.some(porteCle)
    for (const cible of cibles) appels.push({ fichier, ligne: ligne(m.index), cible, cleService })
  }
  const invocations = [...masque.matchAll(/\bfunctions\s*\.\s*invoke\s*\(/g)].map((m) => ligne(m.index))
  return { appels, invocations }
}

/** La fonction visée accepte-t-elle un appelant de service ? Son code doit APPELER la garde. */
function accepteLaCleDeService(cible: string): boolean | null {
  const lu = readFileSafely(repoPath('supabase', 'functions', cible, 'index.ts'))
  if (lu.status !== 'ok') return null
  return /(?<![\w$.])isServiceSecret\s*\(/.test(lex(lu.value).masque)
}

/** Les appels sous la clé de service dont la cible la refuse — ou n'existe pas. */
function violations(appels: Appel[]): string[] {
  return appels
    .filter((a) => a.cleService && accepteLaCleDeService(a.cible) !== true)
    .map((a) => `${a.fichier}:${a.ligne} → ${a.cible}`)
}

// ─── Le dépôt réel ──────────────────────────────────────────────────────────

const scan = scanRoots([{ root: 'supabase/functions', keep: (n) => n.endsWith('.ts') && !n.endsWith('.test.ts') }])
const lus = scan.files.map((abs) => {
  const lu = readFileSafely(abs)
  return { fichier: rel(abs), source: lu.status === 'ok' ? lu.value : null }
})
const reel = lus.flatMap(({ fichier, source }) => (source === null ? [] : [{ fichier, ...appelsInternes(fichier, source) }]))
const appels = reel.flatMap((r) => r.appels)
const paire = (a: Appel): string => `${a.fichier} → ${a.cible}`

describe('appels de fonction à fonction sous la clé de service', () => {
  it('lit TOUTES les sources edge — un balayage vide ne prouverait rien', () => {
    expect(scan.unreadable).toEqual([])
    expect(lus.filter((l) => l.source === null).map((l) => l.fichier)).toEqual([])
    expect(lus.length, 'balayage suspect : trop peu de sources edge').toBeGreaterThanOrEqual(150)
  })

  it('CONTRÔLE POSITIF — voit les appels internes réels, sous chacune de leurs formes', () => {
    const vus = new Set(appels.filter((a) => a.cleService).map(paire))
    for (const attendu of [
      // URL et clé écrites sur place.
      'supabase/functions/whatsapp-webhook/index.ts → whatsapp-agent',
      // URL rangée dans une variable, clé dans une autre.
      'supabase/functions/flatfox-sync/index.ts → flatfox-sync',
      'supabase/functions/magic-link-create/index.ts → magic-link-send-email',
      // Clé qui passe par deux variables (`SERVICE_ROLE_KEY`, puis `serviceCredential`).
      'supabase/functions/backfill-cf-images/index.ts → photo-processor',
      // Depuis un module partagé.
      'supabase/functions/_shared/whatsapp-actions.ts → kyc-report-pdf',
      'supabase/functions/_shared/whatsapp-actions.ts → magic-link-send-email',
      'supabase/functions/automation-engine/index.ts → send-reminder-email',
    ]) expect(vus, `appel interne attendu, non vu : ${attendu}`).toContain(attendu)
  })

  it('une URL REMISE à un tiers n’est pas un appel — lien de désinscription, rappel de signature', () => {
    const cibles = new Set(appels.map((a) => a.cible))
    expect(cibles).not.toContain('email-unsubscribe')
    expect(cibles).not.toContain('esign-webhook')
  })

  it('chaque appel sous la clé de service vise une fonction qui l’accepte (isServiceSecret)', () => {
    expect(violations(appels), [
      'Ces fonctions refusent la clé de service : l’appel répond 401 à chaque fois, et l’appelant',
      'le rattrape comme un échec ordinaire. Ne pas ouvrir la fonction à la clé de service si elle juge une',
      'agence ou un destinataire lus dans le corps : appeler sa logique en direct, par un module',
      '_shared/, sous le contexte vérifié de l’appelant (cf. _shared/relance-email-send.ts).',
    ].join('\n')).toEqual([])
  })

  it('aucun functions.invoke( dans le code edge — cette garde ne saurait pas le lire', () => {
    expect(reel.flatMap((r) => r.invocations.map((l) => `${r.fichier}:${l}`))).toEqual([])
  })

  it('⛔ le cas du 13.09 : plus aucun appel vers send-relance-email — et elle refuse toujours la clé de service', () => {
    expect(appels.filter((a) => a.cible === 'send-relance-email').map(paire)).toEqual([])
    // Le correctif n'est PAS d'avoir ouvert la fonction : elle croirait alors l'agence du corps.
    expect(accepteLaCleDeService('send-relance-email')).toBe(false)
  })
})

describe('la lecture, éprouvée sur des fixtures', () => {
  const F = 'supabase/functions/_shared/fixture.ts'

  it('RÉGRESSION — le défaut du 13.09, réécrit tel quel, rougit contre la vraie send-relance-email', () => {
    const { appels: vus } = appelsInternes(F, [
      'export async function envoyer(to: string) {',
      "  const res = await fetch(urlFonction(Deno.env.get('SUPABASE_URL') ?? '', 'send-relance-email'), {",
      "    method: 'POST',",
      '    headers: {',
      "      'Content-Type': 'application/json',",
      "      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,",
      '    },',
      '    body: JSON.stringify({ to }),',
      '  })',
      '  return res.ok',
      '}',
    ].join('\n'))
    expect(vus).toEqual([{ fichier: F, ligne: 2, cible: 'send-relance-email', cleService: true }])
    expect(violations(vus)).toEqual([`${F}:2 → send-relance-email`])
  })

  it('suit une clé propagée par variables, et une URL rangée dans une variable', () => {
    const { appels: vus } = appelsInternes(F, [
      "const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''",
      'export async function relancer(base: string, cfg: string | null) {',
      '  const cle = (cfg ?? SERVICE).trim()',
      '  const entetes = { Authorization: `Bearer ${cle}` }',
      "  const url = urlFonction(base, 'send-relance-email')",
      '  return fetch(url, { method: \'POST\', headers: entetes })',
      '}',
    ].join('\n'))
    expect(vus).toEqual([{ fichier: F, ligne: 6, cible: 'send-relance-email', cleService: true }])
  })

  it('un JWT d’utilisateur relayé n’est pas la clé de service — et n’est pas jugé', () => {
    const { appels: vus } = appelsInternes(F, [
      'export async function relayer(req: Request, base: string) {',
      "  const jeton = req.headers.get('Authorization') ?? ''",
      "  return fetch(urlFonction(base, 'send-relance-email'), { headers: { Authorization: jeton } })",
      '}',
    ].join('\n'))
    expect(vus).toEqual([{ fichier: F, ligne: 3, cible: 'send-relance-email', cleService: false }])
    expect(violations(vus)).toEqual([])
  })

  it('une cible qui accepte la clé de service passe, une cible inconnue rougit', () => {
    const vers = (cible: string): Appel[] => [{ fichier: F, ligne: 1, cible, cleService: true }]
    expect(violations(vers('send-reminder-email'))).toEqual([])
    expect(violations(vers('fonction-qui-n-existe-pas'))).toEqual([`${F}:1 → fonction-qui-n-existe-pas`])
  })

  it('une URL construite mais jamais passée à fetch n’est pas un appel', () => {
    const { appels: vus } = appelsInternes(F, [
      "const lien = urlFonction(base, 'email-unsubscribe', { t: jeton })",
      "const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
      'return { lien, secret }',
    ].join('\n'))
    expect(vus).toEqual([])
  })
})
