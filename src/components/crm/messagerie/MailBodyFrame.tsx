/**
 * Le corps d'un message (D9) : DOMPurify, puis une `<iframe sandbox srcdoc>`
 * dont la CSP interdit script, connexion et image DISTANTE — un `<img>` distant
 * dans un mail est un traqueur d'ouverture, pas une illustration. L'agent les
 * affiche d'un clic.
 *
 * `allow-same-origin` (sans `allow-scripts`) sert UNIQUEMENT à mesurer la
 * hauteur du document rendu : sans lui, `contentDocument` est inaccessible et
 * l'iframe garderait sa hauteur de départ, coupant tous les mails longs.
 *
 * ⚠ Les images `cid:` restent NON RÉSOLUES (maître §9) : elles sont listées
 * comme pièces jointes, pas rendues dans le corps.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildBodySrcdoc, sanitizeMailHtml } from '@/lib/mail/sanitize'
import { PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; html: string | null; text: string | null; truncated: boolean }

/** Hauteur de départ, avant la première mesure ; bornes de sécurité du mesureur. */
const HAUTEUR_INITIALE = 120
const HAUTEUR_MIN = 40
const HAUTEUR_MAX = 20_000
/** Le document ne bouge plus après quelques centaines de ms : on cesse de le mesurer. */
const MESURE_PERIODE = 500
const MESURE_DUREE = 5000

/**
 * La police du CRM, RÉSOLUE côté hôte.
 *
 * ⛔ Passer `var(--crm-font)` ne marche pas, et l'échec est muet : une variable
 * CSS ne franchit pas la frontière d'un document. Dans la `srcdoc`, `--crm-font`
 * n'existe pas, la déclaration `font-family` entière est écartée, et le corps du
 * mail retombe sur le sérif du navigateur — au milieu d'un écran sans serif.
 *
 * ⚠ La police elle-même ne suit pas davantage : chaque document a son propre jeu
 * de polices, et la CSP y interdit `font-src`. Le rendu tombe donc sur
 * `system-ui` (le repli déclaré par `buildBodySrcdoc`), ce qui est le
 * comportement voulu — pas du Times.
 */
function policeHote(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--crm-font').trim()
  return v || 'system-ui'
}

export function MailBodyFrame({ ms, html, text, truncated }: Props) {
  const { t } = useTranslation('messages')
  const [remote, setRemote] = useState(false)
  const [height, setHeight] = useState(HAUTEUR_INITIALE)
  const ref = useRef<HTMLIFrameElement>(null)
  const hasRemote = useMemo(() => !!html && /<img[^>]+src=["']?https?:/i.test(html), [html])
  const doc = useMemo(
    () => (html ? buildBodySrcdoc(sanitizeMailHtml(html, { remoteImages: remote }), { ink: ms.txt2, font: policeHote(), remoteImages: remote }) : null),
    [html, remote, ms.txt2],
  )

  useEffect(() => {
    const el = ref.current
    if (!el || !doc) return
    const measure = () => {
      const h = el.contentDocument?.documentElement?.scrollHeight
      if (h) setHeight(Math.min(Math.max(h + 8, HAUTEUR_MIN), HAUTEUR_MAX))
    }
    el.addEventListener('load', measure)
    const id = window.setInterval(measure, MESURE_PERIODE)
    const stop = window.setTimeout(() => window.clearInterval(id), MESURE_DUREE)
    return () => { el.removeEventListener('load', measure); window.clearInterval(id); window.clearTimeout(stop) }
  }, [doc])

  // Pas d'HTML : la partie texte, en paragraphes, avec la typographie de l'écran.
  if (!doc) {
    return (
      <div style={{ maxWidth: 760 }}>
        {(text ?? '').split(/\n{2,}/).map((para, i) => (
          <p key={i} style={{ fontSize: 'var(--crm-text-md)', lineHeight: 1.75, color: ms.txt2, margin: 'var(--crm-space-2xl) 0 0', whiteSpace: 'pre-wrap' }}>{para}</p>
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760 }}>
      {hasRemote && !remote && (
        <button
          type="button"
          onClick={() => setRemote(true)}
          style={{
            marginTop: 'var(--crm-space-lg)', background: ms.elev, border: `1px solid ${ms.bord}`,
            borderRadius: PILL, padding: 'var(--crm-space-xs) var(--crm-space-lg)',
            fontSize: 'var(--crm-text-xs)', color: ms.txt3, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {t('mail.read.showImages')}
        </button>
      )}
      <iframe
        ref={ref}
        title={t('mail.read.bodyTitle')}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={doc}
        style={{ width: '100%', height, border: 'none', display: 'block', marginTop: 'var(--crm-space-lg)', background: 'transparent', colorScheme: 'normal' }}
      />
      {truncated && <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, marginTop: 'var(--crm-space-md)' }}>{t('mail.read.truncated')}</div>}
    </div>
  )
}
