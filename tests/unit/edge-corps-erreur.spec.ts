/**
 * Aucune réponse d'edge function ne recopie le texte d'une erreur (audit du 13.09.2026, S14).
 *
 * LE DÉFAUT. Douze fonctions renvoyaient à leur appelant `String(err)`, `error.message`, un
 * `details: insertErr.message` ou le corps d'un fournisseur (`details: resData`, le texte de
 * Deepgram) : noms de colonnes et de contraintes Postgres, diagnostic de Resend, description
 * libre d'un refus OAuth. Cinq d'entre elles étaient atteignables SANS compte — rapport KYC par
 * jeton, vérification C2PA, journal d'authentification, signature Stripe, invitation d'équipe.
 * Le correctif : un code stable pour l'appelant, le détail caviardé dans `console.error`
 * (`redactedErrorMessage`, _shared/audit-edge-error.ts).
 *
 * CE QUE LA GARDE LIT. Le code, commentaires ôtés et contenu des chaînes blanchi (les
 * expressions `${…}` des gabarits restent lues) ; puis, dans les arguments de chaque appel qui
 * fabrique une réponse (`new Response(…)` et les assistants locaux `json`, `jsonResponse`,
 * `reponse`, `txt`), elle refuse :
 *   · `.message`, `.detail(s)`, `.hint`, `.stack`, `.error_description` — le texte d'une erreur ;
 *   · `String(e)` sur une erreur attrapée, ou l'erreur elle-même (`{ error }`) ;
 *   · une variable DÉCLARÉE depuis l'un de ces textes (`const message = err.message`) ;
 *   · un corps de fournisseur passé ENTIER (`details: resData`) — `resData.id` reste permis.
 *
 * CE QU'ELLE NE VOIT PAS, et qui est assumé : la teinte ne se propage que d'UN pas (une variable
 * tirée d'une variable teintée passe — c'est ce qui laisse `appointment-book` traduire le message
 * d'une RPC en code par une liste fermée) ; une erreur relayée par une fonction intermédiaire ;
 * un assistant de réponse au nom inédit. Le contrôle positif « au moins un appel lu par
 * fichier » attrape le dernier cas à moitié : un fichier dont TOUTES les réponses passeraient
 * par un nom inconnu rougit.
 *
 * ⚠ POURQUOI UNE LISTE, ET PAS LES 88 FONCTIONS. Passé sur tout `supabase/functions/` le
 * 13.09.2026, le détecteur signale 45 fonctions : 41 recopient réellement une erreur (agent
 * authentifié, super-admin ou secret de service — hors du périmètre de ce correctif), et une
 * douzaine de constats sont des FAUX POSITIFS — un booléen tiré d'un message
 * (`taken = err.message.includes(…)`), le `message.content` d'une réponse de LLM, un
 * assistant `unauthorized(message)` appelé avec des littéraux. Ajouter une fonction à une
 * liste demande donc de lire ses constats un par un, pas de relâcher le détecteur.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'
import { sansCommentaires } from '../../scripts/_shared/wa-outbound-purpose.mjs'

/**
 * Les sept sites que nomme le rapport, `detect-new-device` (son IP d'en-tête est gardée plus
 * bas), et les cinq surfaces publiques que l'inventaire a trouvées en plus.
 */
const SITES_S14 = [
  'send-email', 'speech-to-text', 'magic-link-create', 'mail-oauth', 'translate-on-demand',
  'matching-engine', 'kyc-report-import', 'detect-new-device',
  'kyc-report-data', 'c2pa-verify', 'log-auth-event', 'stripe-webhook', 'accept-team-invite',
  // La revue du 15.09.2026 (U9) : les trois autres edges de la Messagerie rendaient le texte
  // d'une erreur Postgres ou le corps d'un refus du fournisseur (`error_description` compris).
  'mail-actions', 'mail-send', 'mail-attachment',
] as const

/**
 * Tout ce qu'un appelant SANS compte — ou muni du seul jeton d'un lien public — peut atteindre.
 * Ceux-là étaient déjà propres ou le sont devenus ; la garde les tient tous, pour que la
 * prochaine régression ne commence pas par eux.
 */
const SURFACES_PUBLIQUES = [
  'appointment-book', 'appointment-manage', 'appointment-slots',
  'magic-link-get', 'magic-link-upload', 'magic-link-confirm', 'kyc-report-data',
  'email-unsubscribe', 'onboarding-call-manage', 'onboarding-slots', 'accept-team-invite',
  'c2pa-verify', 'log-auth-event', 'idx-feed',
  'stripe-webhook', 'resend-webhook', 'esign-webhook', 'whatsapp-webhook',
] as const

// ─── Lecture du code ────────────────────────────────────────────────────────

/** Index du caractère qui ferme le littéral ouvert en `i` (`'`, `"` ou gabarit), ou -1. */
function finLitteral(src: string, i: number): number {
  const q = src[i]
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue }
    if (q === '`' && src[j] === '$' && src[j + 1] === '{') { j = finExpression(src, j + 1); if (j < 0) return -1; continue }
    if (src[j] === q) return j
  }
  return -1
}

/** Index de l'accolade qui ferme l'expression `${` ouverte en `i` (sur son `{`), ou -1. */
function finExpression(src: string, i: number): number {
  let prof = 0
  for (let j = i; j < src.length; j++) {
    const c = src[j]
    if (c === "'" || c === '"' || c === '`') { j = finLitteral(src, j); if (j < 0) return -1; continue }
    if (c === '{') prof++
    else if (c === '}' && --prof === 0) return j
  }
  return -1
}

/**
 * Même longueur, mêmes retours à la ligne, mais le CONTENU des chaînes en blanc : un texte
 * n'est jamais l'erreur, et une parenthèse dans une chaîne ne doit pas fermer un appel.
 * Les expressions `${…}` d'un gabarit sont gardées — c'est du code.
 */
function blanchirChaines(src: string): string {
  const blanc = (s: string) => s.replace(/[^\n]/g, ' ')
  let out = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c !== "'" && c !== '"' && c !== '`') { out += c; continue }
    const fin = finLitteral(src, i)
    if (fin < 0) { out += src.slice(i); break }
    if (c !== '`') { out += c + blanc(src.slice(i + 1, fin)) + c; i = fin; continue }
    out += '`'
    for (let j = i + 1; j < fin; j++) {
      if (src[j] === '\\') { out += blanc(src.slice(j, j + 2)); j++; continue }
      if (src[j] === '$' && src[j + 1] === '{') {
        const ferme = finExpression(src, j + 1)
        out += '${' + blanchirChaines(src.slice(j + 2, ferme)) + '}'
        j = ferme
        continue
      }
      out += blanc(src[j])
    }
    out += '`'
    i = fin
  }
  return out
}

/** Index de la parenthèse qui ferme l'appel ouvert en `i` (sur son `(`), chaînes déjà blanchies. */
function finAppel(code: string, i: number): number {
  let prof = 0
  for (let j = i; j < code.length; j++) {
    if (code[j] === '(') prof++
    else if (code[j] === ')' && --prof === 0) return j
  }
  return -1
}

/** Fin d'une instruction commencée en `i` : fin de ligne hors parenthèses, sauf ligne de continuation. */
function finInstruction(code: string, i: number): number {
  let prof = 0
  for (let j = i; j < code.length; j++) {
    const c = code[j]
    if ('([{'.includes(c)) prof++
    else if (')]}'.includes(c)) { if (--prof < 0) return j }
    else if (c === ';' && prof === 0) return j
    else if (c === '\n' && prof === 0) {
      const suite = /^\s*(\S)/.exec(code.slice(j + 1))?.[1] ?? ''
      if (!'.?:|&+'.includes(suite) || suite === '') return j
    }
  }
  return code.length
}

const echapper = (s: string) => s.replace(/[$]/g, '\\$')
const IDENT = '[A-Za-z_$][\\w$]*'
/** Le texte d'une erreur, lu sur un objet quel qu'il soit. */
const TEXTE_ERREUR = /\.(?:message|details?|hint|stack|error_description)\b/

/**
 * Fonctions qui tirent d'une erreur un code pris dans une LISTE FERMÉE — leur résultat peut
 * sortir, et c'est tout leur objet. Chacune a ses tests : _shared/mail/oauth.test.ts et
 * _shared/safe-fetch.test.ts. `redactedErrorMessage` n'y est PAS : caviardé ou non, c'est un
 * texte de journal.
 */
const ASSAINISSEURS = ['oauthFailureCode', 'safeFetchErrorCode']

/** Remplace chaque appel d'assainisseur par un blanc : ce qu'il rend est un code. */
function neutraliser(txt: string): string {
  let out = txt
  for (const nom of ASSAINISSEURS) {
    for (let i = out.search(new RegExp(`(?<![\\w$.])${nom}\\s*\\(`)); i >= 0; i = out.search(new RegExp(`(?<![\\w$.])${nom}\\s*\\(`))) {
      const fin = finAppel(out, out.indexOf('(', i))
      if (fin < 0) break
      out = out.slice(0, i) + ' '.repeat(fin + 1 - i) + out.slice(fin + 1)
    }
  }
  return out
}

/** Occurrences de `nom` comme VALEUR (ni propriété `x.nom`, ni clé `{ nom: … }`). */
function valeurs(code: string, nom: string): boolean {
  const re = new RegExp(`(?<![\\w$.])${echapper(nom)}(?![\\w$])`, 'g')
  for (const m of code.matchAll(re)) {
    const avant = code.slice(0, m.index).trimEnd().slice(-1)
    const apres = code.slice((m.index ?? 0) + nom.length).trimStart()
    const estCle = (avant === '{' || avant === ',') && apres.startsWith(':') && !apres.startsWith('::')
    if (!estCle) return true
  }
  return false
}

/** Occurrences de `nom` passé ENTIER — ni `nom.x`, ni `nom?.x`, ni `nom[…]`, ni clé. */
function passeEntier(code: string, nom: string): boolean {
  const re = new RegExp(`(?<![\\w$.])${echapper(nom)}(?![\\w$])(?!\\s*(?:\\?\\.|\\.|\\[))`, 'g')
  for (const m of code.matchAll(re)) {
    const avant = code.slice(0, m.index).trimEnd().slice(-1)
    const apres = code.slice((m.index ?? 0) + nom.length).trimStart()
    if ((avant === '{' || avant === ',') && apres.startsWith(':') && !apres.startsWith('::')) continue
    return true
  }
  return false
}

export interface Constat { ligne: number; motif: string; extrait: string }

/** Les appels de réponse d'une source, et ce que leurs arguments recopient d'une erreur. */
function analyser(src: string): { appels: number; attrapes: string[]; fautes: Constat[] } {
  const code = blanchirChaines(sansCommentaires(src))
  const ligneDe = (index: number) => code.slice(0, index).split('\n').length

  // Les erreurs elles-mêmes : paramètres de `catch (x)` / `.catch((x) => …)`, et les `error`
  // déstructurés d'un appel Supabase (`const { error: insertErr } = await …`).
  const erreurs = new Set<string>()
  for (const m of code.matchAll(new RegExp(`\\bcatch\\s*\\(\\s*\\(?\\s*(${IDENT})`, 'g'))) erreurs.add(m[1])
  for (const m of code.matchAll(new RegExp(`\\{[^{}]*\\berror\\b\\s*(?::\\s*(${IDENT}))?[^{}]*\\}\\s*=`, 'g'))) {
    erreurs.add(m[1] ?? 'error')
  }
  const refErreur = (txt: string) =>
    [...erreurs].some((e) => valeurs(txt.replace(new RegExp(`(?<![\\w$.])${echapper(e)}\\s*(?:\\?\\.|\\.)\\s*${IDENT}`, 'g'), ' '), e))
  const stringDErreur = (txt: string) =>
    [...erreurs].some((e) => new RegExp(`\\bString\\s*\\(\\s*\\(?\\s*${echapper(e)}\\b`).test(txt))

  // Variables DÉCLARÉES ou ASSIGNÉES depuis un texte d'erreur (un seul pas), et corps de
  // fournisseur (`= await res.json()` / `.text()`, jamais `req`).
  const teintees = new Set<string>()
  const corps = new Set<string>()
  const affectation = new RegExp(`(?<![\\w$.])(${IDENT})\\s*(?::[^=\\n;]+)?(?<![!<>=])=(?![=>])`, 'g')
  for (const m of code.matchAll(affectation)) {
    const debut = (m.index ?? 0) + m[0].length
    const rhs = neutraliser(code.slice(debut, finInstruction(code, debut)))
    if (TEXTE_ERREUR.test(rhs) || stringDErreur(rhs) || refErreur(rhs)) teintees.add(m[1])
    if (/^\s*await\s+(?!req\b)[\w$.]+\.(?:json|text)\s*\(/.test(rhs)) corps.add(m[1])
  }

  const fautes: Constat[] = []
  let appels = 0
  for (const m of code.matchAll(/(?<![\w$.])(?:new\s+Response|json|jsonResponse|reponse|txt)\s*\(/g)) {
    const avant = code.slice(Math.max(0, (m.index ?? 0) - 12), m.index)
    if (/\bfunction\s+$/.test(avant)) continue // la définition de l'assistant, pas un appel
    const ouvrante = (m.index ?? 0) + m[0].length - 1
    const fermante = finAppel(code, ouvrante)
    if (fermante < 0) continue
    appels++
    const args = neutraliser(code.slice(ouvrante + 1, fermante))
    const signaler = (motif: string) =>
      fautes.push({ ligne: ligneDe(m.index ?? 0), motif, extrait: src.slice(m.index, fermante + 1).replace(/\s+/g, ' ').slice(0, 160) })
    if (TEXTE_ERREUR.test(args)) signaler('texte d’erreur (.message/.detail/…)')
    if (stringDErreur(args)) signaler('String(<erreur>)')
    if (refErreur(args)) signaler('erreur passée telle quelle')
    for (const t of teintees) if (valeurs(args, t)) signaler(`variable tirée d’un texte d’erreur : ${t}`)
    for (const c of corps) if (passeEntier(args, c)) signaler(`corps de fournisseur passé entier : ${c}`)
  }
  return { appels, attrapes: [...erreurs], fautes }
}

function source(fn: string): string {
  const lu = readFileSafely(repoPath(`supabase/functions/${fn}/index.ts`))
  return lu.status === 'ok' ? lu.value : ''
}

// ─── Le détecteur lui-même ──────────────────────────────────────────────────

describe('détecteur — il reconnaît les formes fautives d’avant le 13.09.2026', () => {
  // Chaque extrait est recopié du code corrigé (en abrégeant les en-têtes HTTP). Si l'un
  // d'eux passe au vert, la garde ne mesure plus ce qu'elle prétend.
  const AVANT: Record<string, string> = {
    'kyc-report-import — String(err) dans `message`': `
      } catch (err) {
        console.error('kyc-report-import error:', err)
        return new Response(JSON.stringify({ error: 'Internal error', message: String(err) }), { status: 500 })
      }`,
    'matching-engine — message tiré de l’erreur puis rendu': `
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return new Response(JSON.stringify({ error: message }), { status: 500 })
      }`,
    'mail-oauth — message Postgres en `detail`': `
      const { data: consumed, error: eState } = await admin.from('mail_oauth_states').update({}).select('*')
      if (eState) return json({ error: 'state_consume_failed', detail: eState.message }, 500)`,
    'mail-oauth — description du fournisseur en `detail`': `
      } catch (e) {
        return json({ error: 'exchange_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
      }`,
    'mail-oauth — `r.detail` d’un échec de déconnexion': `
      const r = await disconnectMailAccount(admin, account)
      return json({ error: 'delete_failed', detail: r.detail }, 500)`,
    'send-email — corps Resend entier': `
      const resData = await res.json()
      if (!res.ok) {
        return jsonResponse(res.status, { error: 'Failed to send email', details: resData })
      }`,
    'stripe-webhook — message du SDK dans un gabarit': `
      } catch (err) {
        return new Response(\`Webhook Error: \${(err as Error).message}\`, { status: 400 })
      }`,
    'magic-link-create — raison tirée de l’erreur réseau, sur plusieurs lignes': `
      } catch (sendErr) {
        emailSent = {
          sent: false,
          reason: sendErr instanceof Error ? sendErr.message : 'unknown send error',
        }
      }
      return new Response(JSON.stringify({ email_reason: emailSent.sent ? null : emailSent.reason ?? null }), { status: 200 })`,
    'l’erreur elle-même, en raccourci': `
      } catch (error) {
        return json({ error }, 500)
      }`,
    'une erreur PostgREST déstructurée, rendue entière': `
      const { error } = await supabase.rpc('log_auth_event_limited', {})
      if (error) return new Response(JSON.stringify({ ok: false, error }), { status: 500 })`,
    'message Postgres dans un gabarit': `
      if (profileError) return json({ error: \`Profile lookup failed: \${profileError.message}\` }, 500)`,
  }

  for (const [nom, extrait] of Object.entries(AVANT)) {
    it(`⛔ ${nom}`, () => {
      expect(analyser(extrait).fautes.length, extrait).toBeGreaterThan(0)
    })
  }
})

describe('détecteur — il laisse passer ce qui ne recopie rien', () => {
  const PROPRES: Record<string, string> = {
    'message traduit en code par une liste fermée (appointment-book)': `
      const raw = String(rpcError.message ?? '')
      const code = Object.keys(STATUS_BY_CODE).find(c => raw.includes(c))
      if (code) return json({ error: code, reason: code }, STATUS_BY_CODE[code])
      console.error('appointment-book: échec RPC inattendu', raw)
      return json({ error: 'Could not book appointment' }, 500)`,
    'clé `message` portant une phrase fixe': `
      return json({ error: 'expired', message: 'Ce lien a expiré (voir err.message).' }, 410)`,
    'membre d’un corps de fournisseur': `
      const resData = await res.json()
      return jsonResponse(200, { success: true, id: resData.id })`,
    'le code Postgres, que l’audit propose lui-même de rendre': `
      const { error } = await admin.from('x').insert({})
      if (error) return json({ error: 'insert_failed', code: error.code }, 500)`,
    'le texte au journal, un code dans la réponse': `
      } catch (err) {
        console.error('[x] échec :', redactedErrorMessage(err))
        return json({ error: 'internal_error' }, 500)
      }`,
    'une réponse citée en commentaire': `
      // return json({ error: err.message }, 500)
      return json({ ok: true })`,
  }

  for (const [nom, extrait] of Object.entries(PROPRES)) {
    it(nom, () => {
      expect(analyser(extrait).fautes, extrait).toEqual([])
    })
  }
})

// ─── Les fonctions ──────────────────────────────────────────────────────────

describe('edge functions — aucune réponse ne recopie le texte d’une erreur', () => {
  for (const fn of [...new Set([...SITES_S14, ...SURFACES_PUBLIQUES])]) {
    describe(fn, () => {
      const src = source(fn)
      const { appels, attrapes, fautes } = analyser(src)

      // Contrôles positifs : un fichier illisible, dont aucune réponse n'est reconnue, ou dont
      // les erreurs attrapées ne sont plus repérées, rendrait la clause suivante verte pour la
      // pire des raisons. Les sites de S14 ont tous au moins un `catch`.
      it('a une source lisible, au moins une réponse reconnue, et ses erreurs repérées', () => {
        expect(src.length, `${fn}/index.ts illisible`).toBeGreaterThan(500)
        expect(appels, `${fn} : aucun appel de réponse reconnu`).toBeGreaterThan(0)
        if ((SITES_S14 as readonly string[]).includes(fn)) {
          expect(attrapes.length, `${fn} : aucune erreur attrapée repérée`).toBeGreaterThan(0)
        }
      })

      it('ne renvoie ni message, ni corps de fournisseur, ni erreur brute', () => {
        expect(fautes.map((f) => `L${f.ligne} ${f.motif} — ${f.extrait}`)).toEqual([])
      })
    })
  }
})

describe('detect-new-device — l’IP de l’alerte ne vient plus de l’appelant', () => {
  const code = sansCommentaires(source('detect-new-device'))

  it('a une source lisible', () => {
    expect(code.length).toBeGreaterThan(2000)
  })

  it('lit trustedClientIp, jamais la tête de x-forwarded-for ni x-real-ip', () => {
    // Avant : `x-forwarded-for.split(',')[0] || x-real-ip` — deux en-têtes que l'appelant écrit.
    expect(code).toMatch(/\btrustedClientIp\(req\)/)
    expect(code).not.toMatch(/x-forwarded-for/i)
    expect(code).not.toMatch(/x-real-ip/i)
  })

  it('n’interpole dans l’URL d’ipapi.co qu’une IP littérale, encodée', () => {
    expect(code).toMatch(/\bisIpAddress\(/)
    expect(code).toMatch(/ipapi\.co\/\$\{encodeURIComponent\(ip\)\}/)
    expect(code).not.toMatch(/ipapi\.co\/\$\{ip\}/)
  })
})
