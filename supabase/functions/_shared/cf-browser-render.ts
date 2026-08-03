// Les deux bords PURS de l'appel Cloudflare Browser Rendering /pdf : le corps de requête à
// l'aller, l'expurgation du corps d'erreur au retour (l'I/O — fetch CF — vit dans l'edge
// kyc-report-pdf). Testable Vitest.
//
// Réf. doc : gotoOptions.waitUntil=networkidle0 (SPA) + waitForSelector sur la
// sentinelle #pdf-ready (posée par la route une fois données+fontes prêtes) +
// pdfOptions A4/printBackground/preferCSSPageSize (le template a déjà @page A4).
// authenticate = HTTP Basic, passé par l'appelant depuis MEGGA_PREVIEW_BASIC_AUTH
// et omis si le secret est absent. Le gate Basic Auth vit sur la VITRINE
// (megga.ch, sites/megga-vitrine/_worker.js), pas sur le CRM app.megga.ch que
// cette fonction rend : les pages visées ne sont plus gatées.

import { redactPII } from './pii-redaction.ts'

export interface CfPdfRequestInput {
  url: string
  basicUser?: string
  basicPass?: string
}

export function buildCfPdfRequestBody(input: CfPdfRequestInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    url: input.url,
    gotoOptions: { waitUntil: 'networkidle0', timeout: 45000 },
    waitForSelector: { selector: '#pdf-ready', timeout: 20000 },
    pdfOptions: {
      format: 'a4',
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 30000,
    },
  }
  if (input.basicUser && input.basicPass) {
    body.authenticate = { username: input.basicUser, password: input.basicPass }
  }
  return body
}

/**
 * Rend journalisable le corps d'erreur renvoyé par Cloudflare : le jeton de lecture disparaît,
 * l'URL qui a échoué reste lisible.
 *
 * POURQUOI PAS `<render-url>`. Une erreur de navigation recopie l'URL visée
 * (« net::ERR_… at https://… »), qui PORTE le jeton. La première version effaçait l'URL
 * ENTIÈRE — et avec elle l'hôte et le chemin, c'est-à-dire exactement ce qui désigne le
 * coupable quand le rendu est mal configuré. Le dépôt a vécu cette panne : un lien pointant
 * un hôte sans DNS, invisible longtemps. `at <render-url>` ne dit rien ;
 * `at https://kyc.megga.ch/kyc-report/[REDACTED:TOKEN]` nomme le fautif.
 *
 * POURQUOI UNE SUBSTITUTION LITTÉRALE, et pas un motif qui rattraperait le jeton tronqué ou
 * percent-encodé. Un FRAGMENT de jeton n'est pas une capacité : `verifyMagicLinkToken` exige
 * exactement deux tranches jointes par un point ET une signature HMAC valide sur la première
 * — une moitié, ou un jeton coupé, ne peut donc jamais authentifier. Une version ancrée sur
 * un préfixe a été écrite puis retirée : elle promettait de rattraper ces formes, mais
 * apportait quatre modes de panne pour protéger ce qui n'ouvre aucun droit — un seuil de
 * longueur en deçà duquel elle mangeait le chemin qu'elle prétend garder, pas de frontière
 * droite (un suffixe de diagnostic partait avec le jeton), et un désarmement SILENCIEUX le
 * jour où l'URL porterait son jeton en query.
 *
 * Ce qui reste couvre le cas réel — l'URL recopiée telle qu'on l'a construite — et le
 * catalogue partagé (motif TOKEN) prend la suite pour les secrets qu'on n'a PAS fabriqués
 * ici : URL réécrite par une redirection, jeton cité seul, JWT d'un intermédiaire.
 */
export function redactCfRenderError(errTxt: string, renderUrl: string): string {
  const coupe = renderUrl.lastIndexOf('/')
  const segment = coupe < 0 ? '' : renderUrl.slice(coupe + 1)
  // Segment vide = l'URL ne porte pas de jeton (elle finit par « / »). Substituer quand même
  // collerait un « [REDACTED:TOKEN] » qui désigne un secret inexistant : un journal qui invente
  // une rédaction est aussi trompeur qu'un journal qui en oublie une.
  if (!segment) return redactPII(errTxt).redactedText
  return redactPII(
    errTxt.replaceAll(renderUrl, `${renderUrl.slice(0, coupe + 1)}[REDACTED:TOKEN]`),
  ).redactedText
}

/** Découpe "user:pass" en { user, pass } ; tolère un pass contenant des ':'. */
export function parseBasicAuthPair(raw: string | undefined): { user?: string; pass?: string } {
  if (!raw) return {}
  const i = raw.indexOf(':')
  if (i < 0) return {}
  return { user: raw.slice(0, i), pass: raw.slice(i + 1) }
}
