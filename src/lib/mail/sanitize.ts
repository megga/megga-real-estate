/**
 * Rendu d'un corps HTML reçu (D9) : DOMPurify + iframe `sandbox` + CSP.
 *
 * Les images distantes sont BLOQUÉES par défaut (un `<img>` distant dans un mail
 * est un traqueur d'ouverture, pas une illustration) ; l'agent les affiche d'un
 * clic. Les images en ligne (`cid:`) et `data:` passent.
 */
import DOMPurify from 'dompurify'

export interface SanitizeOptions { remoteImages: boolean }

/** Nettoie un corps HTML reçu. L'instance est locale : un hook global fuirait d'un appel à l'autre. */
export function sanitizeMailHtml(html: string, opts: SanitizeOptions): string {
  const purifier = DOMPurify()
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
    if (node.tagName === 'IMG' && !opts.remoteImages) {
      const src = node.getAttribute('src') ?? ''
      if (/^https?:/i.test(src)) {
        node.setAttribute('data-blocked-src', src)
        node.removeAttribute('src')
      }
    }
  })
  return purifier.sanitize(html, {
    USE_PROFILES: { html: true },
    // `style` (balise et attribut) est GARDÉ : un mail sans ses styles est illisible, et la
    // CSP de l'iframe interdit déjà tout `url()` distant (img-src) et toute feuille externe.
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ALLOW_DATA_ATTR: true,
  })
}

export interface SrcdocTheme { ink: string; font: string; remoteImages: boolean }

/** Document complet pour `<iframe sandbox srcdoc>` : CSP fermée, typographie de la maquette. */
export function buildBodySrcdoc(sanitizedHtml: string, theme: SrcdocTheme): string {
  const img = theme.remoteImages ? 'img-src data: cid: https:' : 'img-src data: cid:'
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${img}; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; script-src 'none'; form-action 'none'">`,
    `<style>html,body{margin:0;padding:0;background:transparent}body{font-family:${theme.font},system-ui,sans-serif;font-size:13px;line-height:1.75;color:${theme.ink};max-width:760px;word-break:break-word}p{margin:14px 0 0}p:first-child{margin-top:0}img{max-width:100%;height:auto}blockquote{margin:12px 0 0 8px;padding-left:12px;border-left:2px solid currentColor;opacity:.75}table{max-width:100%}pre{white-space:pre-wrap}</style>`,
    '</head><body>', sanitizedHtml, '</body></html>',
  ].join('')
}
