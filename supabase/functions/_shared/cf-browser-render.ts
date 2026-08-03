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
 * Rend journalisable le corps d'erreur renvoyé par Cloudflare : l'URL rendue disparaît,
 * le motif de l'échec reste.
 *
 * Pourquoi : une erreur de navigation recopie l'URL visée (« net::ERR_… at https://… »), et
 * cette URL PORTE le jeton de lecture du rapport. Sans cette passe le jeton partait en clair
 * dans les journaux ET dans la réponse d'erreur rendue à l'appelant. Deux filets qui ne se
 * recouvrent pas : le retrait littéral de l'URL qu'on vient de construire, puis le catalogue
 * partagé (motif TOKEN), qui rattrape le jeton sous les formes qu'on ne fabrique pas nous-mêmes
 * — URL échappée dans du JSON, réécrite par une redirection, ou jeton cité seul.
 */
export function redactCfRenderError(errTxt: string, renderUrl: string): string {
  return redactPII(errTxt.replaceAll(renderUrl, '<render-url>')).redactedText
}

/** Découpe "user:pass" en { user, pass } ; tolère un pass contenant des ':'. */
export function parseBasicAuthPair(raw: string | undefined): { user?: string; pass?: string } {
  if (!raw) return {}
  const i = raw.indexOf(':')
  if (i < 0) return {}
  return { user: raw.slice(0, i), pass: raw.slice(i + 1) }
}
