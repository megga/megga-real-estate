// MEGGA — générateur du blog statique (storefront Property X / Webflow).
// Lit les 6 articles (articles.mjs) et émet les pages HTML statiques :
//   - sites/property-preview/blog/<slug>.html          (6 articles)
//   - sites/property-preview/blog-pages/blog-v2.html   (page liste recâblée)
// Les gabarits pristine sont figés dans ./templates/. Idempotent : relançable.
//
// Principe carte : on CLONE la carte d'origine du gabarit (tous les attributs
// Webflow conservés : id="w-node-…" porteurs du placement CSS Grid, data-w-id,
// styles de reveal) puis on remplace uniquement le texte dynamique. Fidélité 1:1.
//
//   node scripts/storefront-blog/generate.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { ARTICLES } from './articles.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const SITE = resolve(ROOT, 'sites/property-preview')
const TPL_POST = resolve(HERE, 'templates/post.html')
const TPL_LIST = resolve(HERE, 'templates/list.html')
const LOGO = '/images/megga-logo.svg'

// Couverture par article (assets Webflow existants dans /images).
const COVER = {
  'acheter-ou-louer-geneve-2026': '/images/65e8cf5936c3dea9ba5159a7_home-in-downtown-los-angeles-thumbnail-v1-property-x-webflow-template.jpg',
  'suppression-valeur-locative-proprietaires-romands': '/images/65e8d1f90ea79cfa60517243_luxury-loft-in-san-francisco-featured-image-property-x-webflow-template.jpg',
  'frais-de-notaire-geneve-guide-2026': '/images/65e8d2be768b0f5e8eff5eae_apartment-in-downtown-san-diego-thumbnail-v1-property-x-webflow-template.jpg',
  'fonds-propres-acheter-suisse': '/images/65e8d3f3b45cd453a4108d5d_home-in-los-angeles-heart-thumbnail-v1-property-x-webflow-template.jpg',
  'taux-hypothecaires-2026-saron-ou-fixe': '/images/65e8d44f3f96ad1bfc9fd6ef_luxury-loft-in-san-francisco-thumbnail-v1-property-x-webflow-template.jpg',
  'lba-2026-conformite-transaction-immobiliere': '/images/65e8d3279075f728c66b117c_executive-office-san-diego-thumbnail-v1-property-x-webflow-template.jpg',
}

// 2e image, insérée au milieu de l'article pour aérer la lecture (≠ couverture).
const BODY_IMG = {
  'acheter-ou-louer-geneve-2026': '/images/65e8d398ae1187973d39ee73_modern-loft-in-san-francisco-thumbnail-v2-property-x-webflow-template.jpg',
  'suppression-valeur-locative-proprietaires-romands': '/images/65e89d505017a8de2be772fa_the-best-way-to-find-your-perfect-home-image-property-x-webflow-template.jpg',
  'frais-de-notaire-geneve-guide-2026': '/images/65e8d3f44d8d885cc352d293_home-in-los-angeles-heart-thumbnail-v2-property-x-webflow-template.jpg',
  'fonds-propres-acheter-suisse': '/images/65e8d39a9714a8810623ae95_modern-loft-in-san-francisco-thumbnail-v3-property-x-webflow-template.jpg',
  'taux-hypothecaires-2026-saron-ou-fixe': '/images/65f0b99267afa179f68aeebc_properties-in-los-angeles-image-property-x-webflow-template.jpg',
  'lba-2026-conformite-transaction-immobiliere': '/images/65ea224d375495fd696c8139_welcome-to-your-dream-home-hub-image-property-x-webflow-template.jpg',
}

const FEATURED_SLUGS = [
  'suppression-valeur-locative-proprietaires-romands',
  'acheter-ou-louer-geneve-2026',
]

// Glyphes de la « Blog Icon Font » (caractères PUA placés DANS .blog-icon-text),
// un par catégorie. Relevés sur le gabarit d'origine.
const GLYPH = { news: '', resources: '', articles: '' }
// Force le texte des pilules post-badge en medium (500), comme les property-badge.
const BADGE_CSS = '<style>.post-badge div{font-weight:500}</style>'

// Filtre catégories côté client : montre/masque les cartes de la grille selon
// data-cat, et bascule l'état actif (.w--current) sur le badge cliqué.
const FILTER_JS = '<script>(function(){var g=document.querySelector(".grid-1-column.gap-row-medium");if(!g)return;var cards=g.querySelectorAll(".w-dyn-item");var btns=document.querySelectorAll(".category-badge[data-filter]");function apply(cat){cards.forEach(function(c){c.style.display=(cat==="all"||c.getAttribute("data-cat")===cat)?"":"none";});btns.forEach(function(b){b.classList.toggle("w--current",b.getAttribute("data-filter")===cat);});}btns.forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();apply(b.getAttribute("data-filter"));});});})();</script>'

// Lisibilité de l'article : corps plus grand (18px/1.75, lectorat large), plus
// d'air entre les sections, images arrondies. Appliqué aux pages article.
const READ_CSS = '<style>.rich-text-v1{font-size:18px;line-height:1.75}.rich-text-v1 p,.rich-text-v1 li{font-size:18px}.rich-text-v1 p{text-align:justify;-webkit-hyphens:auto;hyphens:auto;hyphenate-limit-chars:6 3 2}.rich-text-v1 h2{margin-top:2.6rem;margin-bottom:.4rem}.rich-text-v1 h3{margin-top:1.9rem}.rich-text-v1 h4,.rich-text-v1 h5{margin-top:1.5rem}.rich-text-v1 img{border-radius:16px}.rich-text-v1 figure{margin-top:40px;margin-bottom:40px}</style>'

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
function formatDateFR(iso) {
  const [y, m, d] = String(iso).split('-').map((p) => parseInt(p, 10))
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]} ${y}`
}

// ─── inline markdown : **gras**, [libellé](url), \n → <br> ──────────────────
// Typographie française : espace insécable avant : ; ? ! % et autour des
// guillemets, pour qu'aucune ponctuation ne se retrouve orpheline en début de
// ligne (  = insécable,   = fine insécable).
function fr(t) {
  return t
    .replace(/ :/g, ' :')
    .replace(/ ([;!?%»])/g, ' $1')
    .replace(/« /g, '« ')
}
function esc(s) {
  return fr(String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
}
function inline(text) {
  let t = esc(text)
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1') // plus de gras inline (lecture plus confortable)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const ext = /^https?:/.test(url)
    return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`
  })
  return t.replace(/\n/g, '<br>')
}

// ─── blocs → HTML rich-text ─────────────────────────────────────────────────
function calloutHTML(b) {
  const title = b.title ? `<p style="margin:0 0 10px;font-weight:500;color:#14161C">${inline(b.title)}</p>` : ''
  let body
  if (b.text.includes('\n')) {
    // encadré multi-points → liste à puces scannable
    const items = b.text.split('\n').map((s) => s.replace(/^[•\-–]\s*/, '').trim()).filter(Boolean)
    body = `<ul role="list" style="margin:0;padding-left:20px;color:#464851">${items.map((i) => `<li style="margin:6px 0">${inline(i)}</li>`).join('')}</ul>`
  } else {
    body = `<p style="margin:0;color:#464851">${inline(b.text)}</p>`
  }
  // Boîte sobre, sans barre d'accent à gauche (évite le cliché « callout IA »).
  return `<div style="background:#FAFAFB;border:1px solid #EEEFF1;border-radius:14px;padding:24px;margin:28px 0">${title}${body}</div>`
}
function tableHTML(b) {
  const head = b.columns.map((c) => `<th style="text-align:left;padding:12px 14px;border-bottom:1px solid #EEEFF1;background:#FAFAFB;font-weight:600;font-size:15px;color:#14161C">${inline(c)}</th>`).join('')
  const body = b.rows.map((r) => `<tr>${r.map((c, i) => `<td style="padding:12px 14px;border-bottom:1px solid #EEEFF1;font-size:15px;vertical-align:top;color:${i === 0 ? '#14161C' : '#464851'};${i === 0 ? 'font-weight:500;' : ''}">${inline(c)}</td>`).join('')}</tr>`).join('')
  const cap = b.caption ? `<figcaption style="font-size:13px;color:#A4A6B0;margin-top:8px">${inline(b.caption)}</figcaption>` : ''
  return `<figure style="margin:24px 0;overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${cap}</figure>`
}
function blockHTML(b) {
  switch (b.type) {
    case 'paragraph':
      return b.size === 14 ? `<p style="font-size:16px;color:#464851">${inline(b.text)}</p>` : `<p>${inline(b.text)}</p>`
    case 'heading':
      return `<h${b.level}>${inline(b.text)}</h${b.level}>`
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul'
      return `<${tag} role="list">${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`
    }
    case 'quote':
      return `<blockquote>${inline(b.text)}${b.attribution ? `<br><span style="font-size:15px;color:#A4A6B0;font-style:normal">— ${esc(b.attribution)}</span>` : ''}</blockquote>`
    case 'callout':
      return calloutHTML(b)
    case 'table':
      return tableHTML(b)
    default:
      return ''
  }
}
function imageFigure(src, alt) {
  return `<figure class="w-richtext-align-fullwidth w-richtext-figure-type-image"><div><img alt="${esc(alt)}" loading="lazy" src="${src}"/></div></figure>`
}
function bodyHTML(a) {
  const blocks = a.body
  // Insère l'image avant le titre H2 le plus proche du milieu (entre deux sections).
  const mid = Math.floor(blocks.length / 2)
  let insertAt = -1
  for (let d = 0; d < blocks.length && insertAt < 0; d++) {
    for (const i of [mid + d, mid - d]) {
      if (i > 1 && i < blocks.length && blocks[i] && blocks[i].type === 'heading') { insertAt = i; break }
    }
  }
  let html = ''
  blocks.forEach((b, i) => {
    if (i === insertAt && BODY_IMG[a.slug]) html += imageFigure(BODY_IMG[a.slug], a.title)
    html += blockHTML(b)
  })
  if (a.faq && a.faq.length) {
    html += '<h2>Questions fréquentes</h2>' + a.faq.map((f) => `<h3>${inline(f.q)}</h3><p>${inline(f.a)}</p>`).join('')
  }
  if (a.sources && a.sources.length) {
    html += '<h2>Sources</h2><ul role="list">' + a.sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('') + '</ul>'
  }
  return html
}

// ─── tri / sélection ────────────────────────────────────────────────────────
const SORTED = [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
function getFeatured() {
  const f = FEATURED_SLUGS.map((s) => ARTICLES.find((a) => a.slug === s)).filter(Boolean)
  for (const a of SORTED) { if (f.length >= 2) break; if (!f.includes(a)) f.push(a) }
  return f.slice(0, 2)
}
function getRelated(a) {
  const others = SORTED.filter((x) => x.slug !== a.slug)
  const same = others.filter((x) => x.category === a.category)
  const rest = others.filter((x) => x.category !== a.category)
  return [...same, ...rest].slice(0, 3)
}

// ─── cartes : clone du gabarit + remplacement du texte ──────────────────────
const LIST_HTML = readFileSync(TPL_LIST, 'utf8')
const POST_HTML = readFileSync(TPL_POST, 'utf8')
function firstCard(html, gridClass) {
  const m = html.match(new RegExp(`<div class="${gridClass}" role="list">`))
  const start = html.indexOf('<div class="w-dyn-item', m.index)
  const end = html.indexOf('</a></div>', start) + '</a></div>'.length
  return html.slice(start, end)
}
const FEATURED_TPL = firstCard(LIST_HTML, 'grid-2-columns featured-blog-grid-v2 w-dyn-items')
const GRID_TPL = firstCard(LIST_HTML, 'grid-1-column gap-row-medium w-dyn-items')
const RELATED_TPL = firstCard(POST_HTML, 'grid-3-columns blog-grid---v1---3-posts w-dyn-items')

// Remplace le texte de placeholder (« here's decorate », lorem, Resources, date,
// Read more, href, image de couverture). Valeurs uniques dans une carte donnée.
function fillCard(tpl, a) {
  return tpl
    .replace('role="listitem"', () => `role="listitem" data-cat="${a.category}"`)
    .replace(/Here.s how decorate your new home from scratch/g, () => esc(a.title))
    .replace('Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis.', () => esc(a.excerpt))
    .replace('>Resources<', () => `>${esc(a.categoryLabel)}<`)
    .replace(/(<div class="blog-icon-text">)[^<]*(<\/div>)/, (_m, p, s) => p + GLYPH[a.category] + s)
    .replace('Mar 7, 2024', () => formatDateFR(a.date))
    .replace('Read more', 'Lire l’article')
    .replace(/href="\/blog\/[^"]*"/, () => `href="/blog/${a.slug}.html"`)
    .replace(/src="\/images\/[^"]*heres-how-decorate[^"]*"/, () => `src="${COVER[a.slug]}"`)
}
const featuredCard = (a) => fillCard(FEATURED_TPL, a)
const gridCard = (a) => fillCard(GRID_TPL, a)
const relatedCard = (a) => fillCard(RELATED_TPL, a)
function badgePost(a) {
  return `<a class="badge post-badge post-badge-link w-inline-block" href="/blog-pages/blog-v2.html"><div class="item-icon-left"><div class="blog-icon-text">${GLYPH[a.category]}</div></div><div><div>${esc(a.categoryLabel)}</div></div></a>`
}

// ─── remplacement d'une grille (garde l'enveloppe fermante exacte) ───────────
function replaceGrid(html, gridClass, cardsHtml) {
  const re = new RegExp(`(<div class="${gridClass}" role="list">)[\\s\\S]*?((?:</div>)+</section><(?:section|footer))`)
  if (!re.test(html)) throw new Error(`grid not found: ${gridClass}`)
  return html.replace(re, (_m, open, close) => open + cardsHtml + close)
}
function must(html, re, replacement, label) {
  if (!re.test(html)) throw new Error(`anchor not found: ${label}`)
  return html.replace(re, replacement)
}

// ─── Données structurées (JSON-LD) : compréhension Google + moteurs IA ──────
const SITE_URL = 'https://megga.ch'
const ORG = { '@type': 'Organization', name: 'MEGGA', url: SITE_URL, logo: { '@type': 'ImageObject', url: SITE_URL + '/images/megga-logo.svg' } }
function plain(s) {
  return String(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}
function ldScript(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>'
}
function jsonLd(a) {
  const url = `${SITE_URL}/blog/${a.slug}.html`
  const posting = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: plain(a.title), description: plain(a.excerpt),
    image: SITE_URL + COVER[a.slug], inLanguage: 'fr-CH',
    datePublished: a.date, dateModified: a.updatedDate || a.date,
    author: { '@type': 'Organization', name: a.author.name },
    publisher: ORG,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE_URL + '/blog-pages/blog-v2.html' },
      { '@type': 'ListItem', position: 3, name: plain(a.title), item: url },
    ],
  }
  let out = ldScript(posting) + ldScript(breadcrumb)
  if (a.faq && a.faq.length) {
    out += ldScript({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: plain(f.q), acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })),
    })
  }
  return out
}
function jsonLdList() {
  const url = `${SITE_URL}/blog-pages/blog-v2.html`
  const blog = {
    '@context': 'https://schema.org', '@type': 'Blog',
    name: 'Conseils & actualités — MEGGA', inLanguage: 'fr-CH', url, publisher: ORG,
    blogPost: SORTED.map((a) => ({ '@type': 'BlogPosting', headline: plain(a.title), url: `${SITE_URL}/blog/${a.slug}.html`, datePublished: a.date })),
  }
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: url },
    ],
  }
  return ldScript(blog) + ldScript(breadcrumb)
}

// ─── Traduction FR du « chrome » Webflow le plus visible (newsletter, footer
// headline, CTA « publier un bien »). On NE touche pas aux colonnes de liens du
// footer ni aux coordonnées factices (info@home.com) : nettoyage site-wide à part.
function chromeFR(h) {
  return h
    .replaceAll('Enter your email address', 'Votre adresse e-mail')
    .replaceAll('value="Subscribe"', 'value="S\'inscrire"')
    .replaceAll('Thanks for joining our newsletter.', 'Merci, votre inscription est confirmée.')
    .replace('Discover exclusive real estate opportunities', 'Le marché immobilier suisse, décrypté')
    .replace(/Lorem ipsum dolor sit amet consectetur\. Egestas[\s\S]*?viverra cras\./, 'Nos analyses et les nouveautés du marché, directement dans votre boîte mail.')
    .replaceAll('Post a free property', 'Publier un bien gratuitement')
    .replaceAll('Post a paid property', 'Publier une annonce premium')
    .replaceAll('Post a <span class="text-no-wrap normal---mbp">free property</span>', 'Publier <span class="text-no-wrap normal---mbp">gratuitement</span>')
    .replaceAll('Post a <span class="text-no-wrap normal---mbp">paid property</span>', 'Publier <span class="text-no-wrap normal---mbp">en premium</span>')
    .replace(/<p>Lorem ipsum dolor sit amet consectetur vitae[\s\S]*?mattis sit\.<\/span>/g, '<p>Confiez votre bien à une équipe MEGGA et touchez des acheteurs qualifiés.')
}

// ─── build d'un article ─────────────────────────────────────────────────────
function buildPost(a) {
  let h = POST_HTML
  h = replaceGrid(h, 'grid-3-columns blog-grid---v1---3-posts w-dyn-items', getRelated(a).map(relatedCard).join(''))
  h = must(h, /<div class="rich-text-v1 mg-bottom--16px w-richtext">[\s\S]*?<section class="section-card-wrapper">/,
    () => `<div class="rich-text-v1 mg-bottom--16px w-richtext">${bodyHTML(a)}</div></div></div></div></section><section class="section-card-wrapper">`, 'rich-text body')
  h = must(h, /<title>[\s\S]*?<\/title>/, () => `<title>${esc(a.title)} - MEGGA</title>`, 'title')
  h = h.replace(/(<meta content=")[^"]*(" name="description"\/>)/, (_m, p, s) => p + esc(a.excerpt) + s)
  h = h.replace(/(<meta content=")[^"]*(" property="og:title"\/>)/, (_m, p, s) => p + esc(a.title) + ' - MEGGA' + s)
  h = h.replace(/(<meta content=")[^"]*(" property="og:description"\/>)/, (_m, p, s) => p + esc(a.excerpt) + s)
  h = h.replace(/(<meta content=")[^"]*(" property="og:image"\/>)/, (_m, p, s) => p + COVER[a.slug] + s)
  h = must(h, /<h1 class="display-9 mid">[\s\S]*?<\/h1>/, () => `<h1 class="display-9 mid">${esc(a.title)}</h1>`, 'h1')
  h = must(h, /<a class="badge post-badge post-badge-link w-inline-block" href="[^"]*">[\s\S]*?<\/a>/, () => badgePost(a), 'badge')
  h = must(h, /(<div class="inner-container _562px _100-tablet">)<p>[\s\S]*?<\/p>/, (_m, p) => `${p}<p>${esc(a.excerpt)}</p>`, 'hero excerpt')
  h = must(h, /<img alt="[^"]*" class="image post---featured-image" loading="eager" src="[^"]*"\/>/,
    () => `<img alt="${esc(a.title)}" class="image post---featured-image" loading="eager" src="${COVER[a.slug]}"/>`, 'featured image')
  h = must(h, /<img alt="" class="avatar-image circle image" loading="eager" src="[^"]*"\/>/,
    () => `<img alt="MEGGA" class="avatar-image circle image" loading="eager" src="${LOGO}" style="object-fit:contain;background:#14161C;padding:12px"/>`, 'avatar')
  h = h.replace(/John Carter/g, () => esc(a.author.name))
  h = h.replace(/@johncarter/g, () => esc(a.author.role || a.author.handle || ''))
  h = h.replace(/Lorem ipsum dolor sit amet consectetur fermentum eget fringilla egestas lorem\./g, () => esc(a.author.bio || ''))
  h = h.replace(/\/agent\/john-carter\.html/g, '/blog-pages/blog-v2.html')
  h = h.replace(/Mar 7, 2024/g, () => formatDateFR(a.date))
  h = h.replace(/Realted posts/g, 'À lire aussi').replace(/Browse all articles/g, 'Tous les articles')
  // Newsletter au milieu de l'article → FR
  h = chromeFR(h)
  h = h.replace('Subscribe to our weekly newsletter', 'Recevez nos analyses immobilières')
  h = h.replace(/<p>Lorem ipsum dolor sit amet consectetur\. Volutpat[\s\S]*?<\/p>/, '<p>Analyses, chiffres et conseils pour acheter, vendre et louer en Suisse romande. Un e-mail par mois, sans spam.</p>')
  h = h.replace('lang="en"', 'lang="fr"') // césure française
  h = h.replace('</head>', BADGE_CSS + READ_CSS + jsonLd(a) + '</head>')
  return h
}

function buildList() {
  let h = LIST_HTML
  h = replaceGrid(h, 'grid-2-columns featured-blog-grid-v2 w-dyn-items', getFeatured().map(featuredCard).join(''))
  h = replaceGrid(h, 'grid-1-column gap-row-medium w-dyn-items', SORTED.map(gridCard).join(''))
  h = must(h, /<title>[\s\S]*?<\/title>/, '<title>Conseils &amp; actualités - MEGGA</title>', 'list title')
  h = must(h, /<h1 class="display-10 mid text-light">[\s\S]*?<\/h1>/,
    '<h1 class="display-10 mid text-light">Conseils <span class="text-no-wrap">&amp; actualités</span></h1>', 'list h1')
  h = h.replace(/<p>Lorem ipsum dolor sit amet consectetur\. Sit ut gravida[\s\S]*?<\/p>/,
    '<p>Le marché immobilier suisse décrypté : financement, fiscalité, conformité et tendances. Des analyses claires et sourcées pour acheter, vendre et louer en toute confiance.</p>')
  // Sidebar (recherche + catégories) → FR
  h = h.replace(/<h2 class="display-8 mid">Latest posts<\/h2>/, '<h2 class="display-8 mid">Derniers articles</h2>')
  h = h.replace(/<p>Lorem ipsum dolor sit amet consectetur\. Id eu mi[\s\S]*?<\/p>/,
    '<p>Nos guides et analyses pour le marché immobilier romand, des taux hypothécaires à la fiscalité.</p>')
  h = h.replace(/Search for articles\.\.\./g, 'Rechercher un article…')
  h = h.replace(/>Categories</g, '>Catégories<')
  h = h.replace(/>All</g, '>Tous<')
  h = h.replace(/>Resources</g, '>Ressources<')
  h = h.replace(/>News</g, '>Actualités<')
  h = h.replace(/>Articles</g, '>Guides<')
  // Catégories cliquables : liens → boutons de filtre (data-filter)
  h = h.replace('href="/blog-category/resources.html"', 'href="#" data-filter="resources"')
  h = h.replace('href="/blog-category/news.html"', 'href="#" data-filter="news"')
  h = h.replace('href="/blog-category/articles.html"', 'href="#" data-filter="articles"')
  h = h.replace('class="category-badge left w-inline-block w--current" href="/blog-pages/blog-v2.html"', 'class="category-badge left w-inline-block w--current" href="#" data-filter="all"')
  h = chromeFR(h)
  h = h.replace('lang="en"', 'lang="fr"')
  h = h.replace('</head>', BADGE_CSS + jsonLdList() + '</head>')
  h = h.replace('</body>', FILTER_JS + '</body>')
  return h
}

// ─── run ────────────────────────────────────────────────────────────────────
let count = 0
for (const a of ARTICLES) {
  if (!COVER[a.slug]) throw new Error(`no cover mapped for ${a.slug}`)
  writeFileSync(resolve(SITE, `blog/${a.slug}.html`), buildPost(a))
  count++
  console.log('post  →', `blog/${a.slug}.html`)
}
writeFileSync(resolve(SITE, 'blog-pages/blog-v2.html'), buildList())
console.log('list  → blog-pages/blog-v2.html')
// NB : on conserve l'article démo du gabarit (first-time-homebuyers…) — le menu
// de navigation du storefront pointe encore dessus via le lien démo « Blog post ».
void existsSync
console.log(`\n✅ ${count} articles générés`)
