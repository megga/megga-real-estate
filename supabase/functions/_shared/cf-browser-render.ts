// Construction PURE du corps de requête Cloudflare Browser Rendering /pdf.
// (l'I/O — fetch CF — vit dans l'edge kyc-report-pdf). Testable Vitest.
//
// Réf. doc : gotoOptions.waitUntil=networkidle0 (SPA) + waitForSelector sur la
// sentinelle #pdf-ready (posée par la route une fois données+fontes prêtes) +
// pdfOptions A4/printBackground/preferCSSPageSize (le template a déjà @page A4).
// authenticate = HTTP Basic (l'app megga.ch est derrière ai/ai).

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

/** Découpe "user:pass" en { user, pass } ; tolère un pass contenant des ':'. */
export function parseBasicAuthPair(raw: string | undefined): { user?: string; pass?: string } {
  if (!raw) return {}
  const i = raw.indexOf(':')
  if (i < 0) return {}
  return { user: raw.slice(0, i), pass: raw.slice(i + 1) }
}
