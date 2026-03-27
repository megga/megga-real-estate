import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Markdown message renderer ─────────────────────────────────────────────

export function MessageContent({ content }: { content: string }) {
  return (
    <>
      {content.split('\n').map((line, i) => {
        if (line === '') return <br key={i} />
        const parts = line.split(/(\[([^\]]+)\]\(([^)]+)\)|\*\*[^*]+\*\*|\*[^*]+\*)/)
        return (
          <p key={i} className={cn(i > 0 && 'mt-1')}>
            {parts.map((part, j) => {
              if (!part) return null
              const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
              if (linkMatch) {
                const [, text, url] = linkMatch
                if (url.startsWith('/dashboard')) {
                  return <Link key={j} to={url} className="text-accent hover:underline font-medium">{text}</Link>
                }
                return <span key={j} className="text-accent font-medium">{text}</span>
              }
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-semibold text-theme-primary">{part.slice(2, -2)}</strong>
              }
              if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={j} className="text-theme-muted">{part.slice(1, -1)}</em>
              }
              if (part.startsWith('• ') || part.startsWith('- ')) {
                return <span key={j} className="block ml-2">{'•'} {part.slice(2)}</span>
              }
              return <span key={j}>{part}</span>
            })}
          </p>
        )
      })}
    </>
  )
}

// ─── Email detection ────────────────────────────────────────────────────────

export function isEmailResponse(content: string): boolean {
  return content.includes('**Objet :**') || content.includes('**Objet:**')
}

// ─── Email block with copy button ───────────────────────────────────────────

export function EmailBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const plain = content
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
    await navigator.clipboard.writeText(plain)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="bg-theme-section rounded-lg border border-theme-border p-3 text-sm text-theme-secondary leading-relaxed">
        <MessageContent content={content} />
      </div>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-theme-tertiary hover:text-accent transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copié' : 'Copier l\'email'}
      </button>
    </div>
  )
}
