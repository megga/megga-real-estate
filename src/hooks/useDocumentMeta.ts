// Lightweight head manager — set <title>, <meta name=…>, <meta property=…>
// and <link rel=…> from a single hook, restore initial values on unmount.
//
// Why no react-helmet ? Adding a deps for ~10 meta tags across 1-2 pages
// is overkill. This hook is 60 lines and covers the same surface for
// SEO + Open Graph + canonical + JSON-LD.

import { useEffect } from 'react'

type MetaInput =
  | { name: string; content: string }
  | { property: string; content: string }

interface DocumentMeta {
  title?: string
  meta?: MetaInput[]
  canonical?: string
  // Optional raw <script type="application/ld+json"> body
  jsonLd?: object | null
  // Optional override for <html lang=…>
  htmlLang?: string
}

function setOrCreateTag(selector: string, create: () => HTMLElement): HTMLElement {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  return el
}

export function useDocumentMeta(meta: DocumentMeta) {
  const { title, meta: metaTags, canonical, jsonLd, htmlLang } = meta

  useEffect(() => {
    // Snapshot to restore on unmount — only what we touched.
    const previousTitle = title !== undefined ? document.title : null
    const previousLang = htmlLang ? document.documentElement.lang : null
    const touchedMeta: Array<{ el: HTMLElement; previousContent: string | null }> = []
    let previousCanonical: { el: HTMLElement; href: string } | null = null
    let scriptEl: HTMLScriptElement | null = null

    if (title !== undefined) document.title = title
    if (htmlLang) document.documentElement.lang = htmlLang

    for (const tag of metaTags ?? []) {
      const isProperty = 'property' in tag
      const selector = isProperty
        ? `meta[property="${tag.property}"]`
        : `meta[name="${tag.name}"]`
      const el = setOrCreateTag(selector, () => {
        const node = document.createElement('meta')
        if (isProperty) node.setAttribute('property', tag.property)
        else node.setAttribute('name', tag.name)
        return node
      }) as HTMLMetaElement
      touchedMeta.push({ el, previousContent: el.getAttribute('content') })
      el.setAttribute('content', tag.content)
    }

    if (canonical) {
      const linkEl = setOrCreateTag('link[rel="canonical"]', () => {
        const node = document.createElement('link')
        node.setAttribute('rel', 'canonical')
        return node
      }) as HTMLLinkElement
      previousCanonical = { el: linkEl, href: linkEl.getAttribute('href') ?? '' }
      linkEl.setAttribute('href', canonical)
    }

    if (jsonLd) {
      scriptEl = document.createElement('script')
      scriptEl.setAttribute('type', 'application/ld+json')
      scriptEl.setAttribute('data-document-meta', 'true')
      scriptEl.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(scriptEl)
    }

    return () => {
      if (previousTitle !== null) document.title = previousTitle
      if (previousLang !== null) document.documentElement.lang = previousLang
      for (const { el, previousContent } of touchedMeta) {
        if (previousContent === null) el.remove()
        else el.setAttribute('content', previousContent)
      }
      if (previousCanonical) {
        if (previousCanonical.href === '') previousCanonical.el.remove()
        else previousCanonical.el.setAttribute('href', previousCanonical.href)
      }
      if (scriptEl) scriptEl.remove()
    }
  }, [title, metaTags, canonical, jsonLd, htmlLang])
}
