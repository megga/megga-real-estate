# Gabarits d'e-mail Supabase Auth

Ces fichiers ne sont **pas déployés** par la CI. Supabase stocke les gabarits d'auth
côté dashboard, pas dans le dépôt : `deploy.yml` applique les migrations et les edge
functions, jamais la configuration auth. Ils vivent ici pour être versionnés, relus
en PR et recollés à l'identique en cas de perte.

| Fichier | Gabarit dashboard | État |
|---|---|---|
| `recovery.html` | **Reset Password** | à coller |

## Poser un gabarit

1. Dashboard → **Authentication** → **Email Templates** → onglet du gabarit.
2. Coller le contenu **entier** du fichier, sans rien retirer.
3. Enregistrer, puis déclencher un envoi réel pour contrôler le rendu.

⚠ Ne pas ajouter de commentaire HTML de documentation dans ces fichiers : Supabase
envoie le gabarit verbatim, et le moteur de template substitue les variables **même
à l'intérieur des commentaires** — un `{{ .ConfirmationURL }}` en commentaire fait
donc voyager l'URL de réinitialisation en clair dans la source de chaque e-mail.
C'est la raison d'être de ce README.

## Le logo

Seule image du gabarit, chargée depuis **`https://app.megga.ch/email/megga-logo.png`**,
servie par `public/email/`. Ce domaine plutôt que `megga.ch` parce que la vitrine est
encore derrière Basic Auth avant lancement : une image servie de là reviendrait en
`401` dans les boîtes mail, tandis que `app.megga.ch` répond publiquement (vérifié).

Elle est **générée**, ne pas la retoucher à la main :

```bash
node scripts/build-email-assets.mjs
```

300×66 pour un affichage en 150×33 — du 2x, les clients mail étant lus sur des écrans
denses. Le script passe par Playwright, déjà présent pour les tests e2e : le logo
contient des courbes de Bézier, et les rastériseurs de fortune s'y cassent les dents —
`qlmanage` rend une vignette Quick Look, page blanche et bordure comprises, pas
l'image.

Le fond est opaque et non transparent, parce que le PNG se pose sur le fond de page de
l'e-mail, lui aussi `#030303` : le raccord est invisible et on évite les clients qui
composent mal l'alpha. L'`alt` porte les styles typographiques du mot-symbole, si bien
que « MEGGA » reste lisible en blanc et gras quand le destinataire bloque les images —
cas fréquent, c'est le réglage par défaut de plusieurs clients.

## Le dégradé de bas de page

En **CSS, pas en image**. Deux nappes superposées sur le dernier `<td>` : l'extinction
verticale par-dessus la teinte horizontale (bleu → violet → magenta). Les couleurs sont
relevées sur le dégradé de la vitrine, et les extrémités reviennent à `#030303` pour que
la bande n'ait pas d'arête dans la colonne de 560 px — pleine largeur sur le site, il
n'en a aucune.

Une version image existait, à 13 Ko. Elle a été retirée pour deux raisons : rien à
héberger ni à charger, et surtout elle ne s'affichait pas tant que `public/email/`
n'était pas déployé, ce qui rendait l'aperçu du dashboard trompeur.

Fidélité mesurée contre la source composée sur le fond : **écart médian 14/255**. Une
première tentative en `radial-gradient` plafonnait à 31 — la forme de l'extinction
comptait davantage que l'intensité.

`background-color: #030303` sert de repli. Outlook ignore les dégradés CSS et affichera
le fond seul : la bande disparaît sans laisser de couture, puisqu'elle a la couleur de
la page.

## Variables

La seule indispensable dans `recovery.html` est `{{ .ConfirmationURL }}` : c'est le
lien qui passe par `/auth/v1/verify` puis renvoie vers `redirect_to`. Supabase expose
aussi `{{ .Token }}` (code à 6 chiffres), `{{ .TokenHash }}`, `{{ .SiteURL }}` et
`{{ .Email }}`.

Le `redirect_to` ne se règle pas ici mais à l'appel — `RESET_REDIRECT` dans
[`sites/megga-vitrine/js/megga-auth.js`](../../sites/megga-vitrine/js/megga-auth.js) —
et l'URL visée doit figurer dans **Authentication → URL Configuration → Redirect URLs**.

## Pourquoi ce code ne ressemble pas à celui de la vitrine

L'habillage suit la vitrine (fond `#030303`, carte `#090909` bordée `#181818`, Inter
Tight, accent `#424bfb` — les valeurs viennent de `:root` dans
`sites/megga-vitrine/css/styles.css`). La technique, elle, obéit aux clients mail :

- **Tableaux et styles en ligne.** Gmail supprime les blocs `<style>` et les classes.
  Le `<style>` présent ne sert qu'aux quelques clients qui l'honorent (media queries,
  Apple Mail) ; tout le rendu tient sans lui.
- **Pas de `backdrop-filter`.** La carte translucide de la vitrine devient opaque :
  aucun client ne sait flouter.
- **Marque en texte.** Le dépôt n'a que des SVG et Gmail les refuse. C'est déjà la
  solution des e-mails transactionnels existants (`magic-link-send-email` et consorts).
- **Bouton en VML sous Outlook.** Son moteur Word ignore `border-radius` ; sans le
  `v:roundrect`, la pilule deviendrait un rectangle.
- **Inter Tight n'est chargée que par Apple Mail.** Repli Helvetica puis Arial, proches
  de dessin, partout ailleurs.
- **Lien de repli en clair.** Certains clients neutralisent les boutons.

À surveiller : Outlook.com force l'inversion des e-mails sombres. `color-scheme: dark`
limite la casse mais ne la garantit pas — d'où le contrôle sur envoi réel.

## Divergence assumée

Les e-mails transactionnels du CRM (`send-email`, `magic-link-send-email`…) suivent une
autre charte : fond clair `#EDEFF3`, Manrope, CTA noir. Deux familles cohabitent donc,
et c'est voulu : ce gabarit-ci accompagne un parcours qui se déroule entièrement sur la
vitrine, jusqu'à `megga.ch/reset-password`. Uniformiser les deux est un chantier séparé.
