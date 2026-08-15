// supabase/functions/_shared/email-shell.ts
//
// LA coquille des e-mails MEGGA, et les atomes qui vont avec. Direction MEGGA X.
//
// POURQUOI CE MODULE EXISTE. Mesuré le 15.08.2026 : `supabase/functions/` comptait
// TREIZE fichiers fabriquant chacun son propre `<!DOCTYPE html>`, onze en police système,
// avec huit fonds de page différents (#f9fafb, #f8f9fa, #f5f5f5, #f3f4f6, #EDEFF3…).
// Il n'y avait pas un design d'e-mail, il y en avait treize.
//
// ⚠ UN MODULE PARTAGÉ NE SUFFIT PAS, ON L'A DÉJÀ VÉRIFIÉ ICI. `_shared/resend.ts` a été
// écrit exactement pour être le point d'ENVOI unique ; son propre en-tête constate que
// les quatorze appels existants n'ont jamais été convertis, et deux sites sur seize
// l'utilisent. Ce qui rend la règle tenable n'est donc pas ce fichier, c'est la porte
// `npm run lint:email-shell` (scripts/check-email-shell.mjs), qui refuse tout nouveau
// `<!DOCTYPE>` d'e-mail écrit ailleurs qu'ici.
//
// ⚠ TOUT EST INLINÉ, ET EN TABLEAUX. Un client de messagerie ne lit ni variable CSS, ni
// flexbox, ni grille : les jetons ci-dessous sont donc des littéraux, seule entorse
// assumée à la règle du dépôt qui les interdit dans les composants. Le `<style>` de
// l'en-tête ne porte que ce qui ne peut PAS être inliné (media queries), et rien
// d'essentiel n'en dépend — un client qui le jette rend quand même la carte.

// ── Jetons ──────────────────────────────────────────────────────────────────
export const BRAND = '#424bfb'
export const CARD = '#090909'
export const CARD_BORDER = '#181818'
export const INK = '#ffffff'
export const BODY_INK = '#cccccc'
export const MUTED = '#8a8a8f'

/**
 * ⚠ `app.megga.ch`, JAMAIS `megga.ch`. La vitrine est derrière un mot de passe :
 * mesuré le 15.08.2026, `megga.ch/email/megga-logo-white.png` rend **401** en
 * `text/plain` (23 octets), ce que tout client de messagerie affiche en image cassée.
 * C'était l'adresse de l'ancienne coquille, donc le logo était mort dans chaque e-mail
 * déjà parti. Les fichiers sont versionnés dans `public/email/` et servis en `image/png`
 * par l'app. Un test interdit le retour en arrière.
 */
export const ASSETS = 'https://app.megga.ch/email'

export const FONT = "'Inter Tight','Helvetica Neue',Helvetica,Arial,sans-serif"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface ShellOptions {
  /** Sert le `<title>` ET le `<h1>` : les deux disent la même chose, par construction. */
  title: string
  /**
   * Texte d'aperçu de la liste des messages, masqué à l'ouverture. Il ne RÉPÈTE jamais
   * l'objet : c'est la seule ligne qui peut dire pourquoi garder le message (le lien y
   * est), là où l'objet dit de quoi il s'agit.
   */
  preheader: string
  bodyHtml: string
  /**
   * Mention de pied. `null` pour un avis INTERNE : promettre à un collègue qu'« il ne
   * s'agit pas d'une communication marketing » n'a pas de destinataire.
   *
   * ⚠ Elle doit être VRAIE pour CE message. La plupart des e-mails du produit sont
   * transactionnels et n'ont pas de désinscription ; l'alerte de sécurité a la sienne,
   * qui dit qu'elle arrive même désabonné ; les envois commerciaux, eux, PORTENT un lien
   * de désinscription (cf. `unsubscribeHtml`) et ne peuvent donc pas affirmer l'inverse.
   */
  legalNote: string | null
  /**
   * Bloc de désinscription, fourni par l'appelant (il porte un jeton par destinataire).
   * Rendu sous la mention de pied.
   *
   * ⚠ Sa présence CONTREDIT la mention transactionnelle : un e-mail qui offre de se
   * désabonner ne peut pas écrire qu'il ne contient pas de lien de désinscription. Les
   * deux se choisissent ensemble.
   */
  unsubscribeHtml?: string
  /** Pilule d'en-tête. `null` sur les avis internes, où elle n'ouvre rien d'utile. */
  headerCta: { href: string; label: string } | null
  /**
   * Langue du document. Par défaut `fr`, la langue de la plupart des e-mails du produit.
   *
   * ⚠ À passer sur tout gabarit multilingue : un e-mail allemand annoncé `lang="fr"` fait
   * lire l'allemand avec une prononciation française à un lecteur d'écran, et trompe les
   * outils de traduction automatique du client de messagerie.
   */
  lang?: string
}

/** Coquille MEGGA X sombre, commune à tous les e-mails du produit. */
export function shell(o: ShellOptions): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeHtml(o.lang ?? 'fr')}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(o.title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;700;800&amp;display=swap" rel="stylesheet" />
  <style>
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    :root { color-scheme: dark; supported-color-schemes: dark; }
    @media (prefers-color-scheme: light) {
      body { background: #ffffff !important; }
      .mg-card { background: ${CARD} !important; }
      .mg-title, .mg-h2 { color: ${INK} !important; }
    }
    @media screen and (max-width: 600px) {
      .mg-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .mg-title { font-size: 26px !important; }
      .mg-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; padding-left: 16px !important; padding-right: 16px !important; }
      .mg-login { display: none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#ffffff;-webkit-font-smoothing:antialiased;">

  <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
    ${escapeHtml(o.preheader)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="mg-card" style="max-width:600px;width:100%;background:${CARD};border:1px solid ${CARD_BORDER};border-radius:24px;">

          <tr>
            <td class="mg-pad" style="padding:36px 36px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <img src="${ASSETS}/megga-logo-white.png" width="140" height="31" alt="MEGGA"
                      style="display:block;width:140px;height:31px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;font-family:${FONT};font-size:21px;font-weight:800;letter-spacing:-1.1px;color:${INK};" />
                  </td>
                  ${o.headerCta ? `<td align="right" valign="middle" class="mg-login">
                    <a href="${escapeHtml(o.headerCta.href)}"
                      style="display:inline-block;border:1px solid ${INK};color:${INK};text-decoration:none;padding:11px 22px;border-radius:999px;font-family:${FONT};font-size:13px;font-weight:600;line-height:1;letter-spacing:0.4px;">
                      ${escapeHtml(o.headerCta.label)}
                    </a>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mg-pad" style="padding:52px 36px 0;">
              <h1 class="mg-title" style="margin:0 0 20px;font-family:${FONT};font-size:30px;font-weight:700;line-height:1.2;letter-spacing:-0.8px;color:${INK};">
                ${escapeHtml(o.title)}
              </h1>
              ${o.bodyHtml}
            </td>
          </tr>

          <tr>
            <td align="center" class="mg-pad" style="padding:44px 36px 8px;">
              <img src="${ASSETS}/megga-gg-indigo.png" width="36" height="22" alt=""
                style="display:block;width:36px;height:22px;border:0;outline:none;-ms-interpolation-mode:bicubic;font-family:${FONT};font-size:14px;font-weight:800;letter-spacing:-0.6px;color:${BRAND};" />
            </td>
          </tr>
          <tr>
            <td align="center" class="mg-pad" style="padding:14px 36px 0;">
              <p style="margin:0 0 4px;font-family:${FONT};font-size:12.5px;font-weight:400;line-height:1.6;color:${MUTED};">
                MEGGA, Rue du Rhône 14, 1204 Genève, Suisse
              </p>
              <p style="margin:0;font-family:${FONT};font-size:12.5px;font-weight:400;line-height:1.6;color:${MUTED};">
                © 2026 MEGGA Inc. Tous droits réservés
              </p>
            </td>
          </tr>
          ${o.legalNote ? `<tr>
            <td align="center" class="mg-pad" style="padding:26px 48px 20px;">
              <p style="margin:0;font-family:${FONT};font-size:11.5px;font-weight:400;line-height:1.75;color:${MUTED};">
                ${escapeHtml(o.legalNote)}
              </p>
            </td>
          </tr>` : ''}
          ${o.unsubscribeHtml ? `<tr>
            <td align="center" class="mg-pad" style="padding:0 48px 20px;">
              ${o.unsubscribeHtml}
            </td>
          </tr>` : ''}

          <tr>
            <td height="112" style="height:112px;font-size:0;line-height:0;">
              <div style="height:112px;font-size:0;line-height:0;border-radius:0 0 24px 24px;background-image:linear-gradient(to bottom, ${CARD} 0%, rgba(9,9,9,0.93) 32%, rgba(9,9,9,0.5) 66%, rgba(9,9,9,0) 100%),linear-gradient(to right, #030303 0%, #12036e 9%, #2409c4 25%, #a02afb 50%, #7a0a76 76%, #2b0430 92%, #030303 100%);">&nbsp;</div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body></html>`
}

// ── Atomes de corps ─────────────────────────────────────────────────────────

/** Paragraphe de corps, à l'encre douce de la direction. */
export function p(html: string, marginBottom = 16): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-family:${FONT};font-size:16px;font-weight:400;line-height:1.6;color:${BODY_INK};">${html}</p>`
}

/** Sous-titre du bloc secondaire (« Un empêchement ? »). */
export function h2(text: string): string {
  return `<h2 class="mg-h2" style="margin:0 0 8px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.4;color:${INK};">${escapeHtml(text)}</h2>`
}

/** Ligne d'un bloc de faits : libellé atténué à gauche, valeur en encre à droite. */
export function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;font-family:${FONT};color:${MUTED};font-size:13px;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;font-family:${FONT};color:${INK};font-size:15px;font-weight:500;">${value}</td>
  </tr>`
}

/**
 * Bloc encadré, CREUSÉ dans la carte : un motif de décision, une consigne à ne pas rater.
 *
 * ⚠ `#050505` sur une carte `#090909` : dans l'échelle sombre MEGGA X une sous-surface se
 * CREUSE, elle ne monte pas. C'est l'inverse de l'ancienne échelle Graphite, et le piège
 * exact dans lequel sa migration était tombée (cf. CLAUDE.md §3).
 *
 * `label` à `null` quand le bloc se suffit à lui-même : un intitulé qui répète la phrase
 * qu'il coiffe ajoute du bruit là où l'on voulait de l'attention.
 */
export function note(label: string | null, html: string): string {
  return `<div style="margin:0 0 28px;padding:16px 18px;background:#050505;border:1px solid ${CARD_BORDER};border-radius:14px;">
      ${label ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:${MUTED};">${escapeHtml(label)}</p>` : ''}
      <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY_INK};">${html}</p>
    </div>`
}

/**
 * Bouton d'action, en pilule.
 *
 * ⚠ La branche VML n'est pas décorative : Outlook (moteur Word) ignore `border-radius`
 * et le remplissage d'un `<a>`, et rendrait un lien bleu souligné au milieu d'une carte
 * noire. `v:roundrect` EXIGE une largeur en pixels, sans équivalent automatique : on
 * l'estime sur la longueur du libellé, une pilule un peu large étant sans conséquence là
 * où une pilule trop étroite couperait le mot.
 */
export function button(href: string, label: string): string {
  const largeurVml = Math.round(64 + label.length * 8.8)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="left">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
      href="${escapeHtml(href)}" arcsize="50%" stroke="f" fillcolor="${BRAND}"
      style="height:56px;v-text-anchor:middle;width:${largeurVml}px;">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;">${escapeHtml(label)}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <a class="mg-cta" href="${escapeHtml(href)}"
      style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:18px 32px;border-radius:999px;text-align:center;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;letter-spacing:-0.2px;">
      ${escapeHtml(label)}
    </a>
    <!--<![endif]-->
  </td></tr></table>`
}
