import { useEffect } from 'react'

interface PageMeta {
  title: string
  description?: string
}

/**
 * Sets document title and meta description for the current page.
 * Restores the default title on unmount.
 */
export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = `${title} | MEGGA Real Estate`

    let metaDesc = document.querySelector('meta[name="description"]')
    const prevDescription = metaDesc?.getAttribute('content') ?? ''

    if (description) {
      if (!metaDesc) {
        metaDesc = document.createElement('meta')
        metaDesc.setAttribute('name', 'description')
        document.head.appendChild(metaDesc)
      }
      metaDesc.setAttribute('content', description)
    }

    return () => {
      document.title = prevTitle
      if (description && metaDesc) {
        metaDesc.setAttribute('content', prevDescription)
      }
    }
  }, [title, description])
}
