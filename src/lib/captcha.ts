// MEGGA Captcha — Cloudflare Turnstile invisible
//
// Spec : handoff-auth/HANDOFF_AUTH_CLAUDE_CODE.md § "Captcha / anti-bot" :
//   « captcha invisible niveau serveur, pas d'UI ».
//
// Pourquoi Turnstile (et pas hCaptcha) :
//   • Gratuit illimité (vs hCaptcha 1M req/mois)
//   • Pas de compte tiers à gérer — déjà dans le dashboard Cloudflare
//   • Mieux observé/intégré à ton hosting Cloudflare Pages
//   • Privacy-first, conforme nLPD/RGPD sans tracking Google-style
//   • Supabase Auth supporte Turnstile en natif (depuis 2023)
//
// Invisible : le SDK monte un widget caché. Si Turnstile détecte un user
// humain (signal cryptographique + heuristiques), il émet un token sans
// aucune friction. Sinon un challenge visuel léger apparaît.
//
// Setup côté projet :
//   1. Dashboard Cloudflare → Turnstile → Add site
//        Hostnames : megga.ch, *.pages.dev, localhost
//        Widget Mode : Invisible
//      → récupérer le « Site Key » (public) et le « Secret Key » (privé).
//   2. Ajouter `VITE_TURNSTILE_SITE_KEY=<sitekey>` dans .env.local +
//      Cloudflare Pages env vars (Production + Preview).
//   3. Supabase Dashboard → Auth → Bot and Abuse Protection :
//        - Enable Captcha protection
//        - Provider: Turnstile
//        - Secret: <le secret Turnstile>
//   4. Supabase rejette désormais les signup/signin/reset/otp sans token.
//
// Mode dev : si `VITE_TURNSTILE_SITE_KEY` est vide, `executeCaptcha()`
// retourne `undefined` et le flow continue (utile pour les tests locaux
// avant d'avoir configuré la clé).
//
// Test key Cloudflare (toujours valide, contourne le challenge) :
//   site key   : 1x00000000000000000000AA
//   secret key : 1x0000000000000000000000000000000AA
// (cf. https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const HIDDEN_CONTAINER_ID = 'megga-turnstile-container'

// ─── Minimal Turnstile API types ──────────────────────────────────────

type TurnstileRenderOptions = {
  sitekey: string
  size?: 'normal' | 'compact' | 'invisible' | 'flexible'
  theme?: 'light' | 'dark' | 'auto'
  callback?: (token: string) => void
  'error-callback'?: (err: string) => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
  appearance?: 'always' | 'execute' | 'interaction-only'
  execution?: 'render' | 'execute'
}

type TurnstileAPI = {
  render: (container: string | HTMLElement, params: TurnstileRenderOptions) => string
  execute: (container?: string | HTMLElement) => void
  reset: (widgetId?: string) => void
  getResponse: (widgetId?: string) => string | undefined
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileAPI
  }
}

// ─── Singleton state ──────────────────────────────────────────────────

let scriptPromise: Promise<void> | null = null
let widgetId: string | null = null
let pendingResolve: ((token: string) => void) | null = null
let pendingReject: ((err: Error) => void) | null = null

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  if (typeof document === 'undefined') {
    scriptPromise = Promise.reject(new Error('no document'))
    return scriptPromise
  }
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile/"]`,
    )
    if (existing) {
      if (window.turnstile) resolve()
      else existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile load failed')))
      return
    }
    const s = document.createElement('script')
    s.src = TURNSTILE_SRC
    s.async = true
    s.defer = true
    s.addEventListener('load', () => {
      const wait = (tries: number) => {
        if (window.turnstile) return resolve()
        if (tries <= 0) return reject(new Error('turnstile api unavailable'))
        setTimeout(() => wait(tries - 1), 50)
      }
      wait(20)
    })
    s.addEventListener('error', () => reject(new Error('turnstile load failed')))
    document.head.appendChild(s)
  })
  return scriptPromise
}

function ensureContainer(): HTMLElement {
  let el = document.getElementById(HIDDEN_CONTAINER_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = HIDDEN_CONTAINER_ID
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    el.style.top = '-9999px'
    el.style.width = '0'
    el.style.height = '0'
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)
  }
  return el
}

async function ensureWidget(): Promise<string> {
  if (widgetId && window.turnstile) return widgetId
  await loadScript()
  if (!window.turnstile) throw new Error('turnstile api missing')
  if (!SITE_KEY) throw new Error('turnstile site key missing')
  widgetId = window.turnstile.render(ensureContainer(), {
    sitekey: SITE_KEY,
    size: 'invisible',
    execution: 'execute', // Don't run automatically — we trigger via execute()
    appearance: 'interaction-only',
    callback: (token: string) => {
      if (pendingResolve) {
        pendingResolve(token)
        pendingResolve = null
        pendingReject = null
      }
    },
    'error-callback': (err: string) => {
      if (pendingReject) {
        pendingReject(new Error(`turnstile error: ${err}`))
        pendingResolve = null
        pendingReject = null
      }
    },
    'timeout-callback': () => {
      if (pendingReject) {
        pendingReject(new Error('turnstile timeout'))
        pendingResolve = null
        pendingReject = null
      }
    },
  })
  return widgetId
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Returns a fresh Turnstile token (string) or `undefined` if the SDK is not
 * configured (mode dev sans site key). Never throws — fail-open by design.
 * Le serveur Supabase rejettera de toute façon les requêtes sans token si
 * captcha activé côté Auth settings.
 */
export async function executeCaptcha(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined
  try {
    const id = await ensureWidget()
    if (!window.turnstile) return undefined
    return await new Promise<string>((resolve, reject) => {
      pendingResolve = resolve
      pendingReject = reject
      window.turnstile!.execute(ensureContainer())
      // Safety timeout in case neither callback fires
      setTimeout(() => {
        if (pendingReject) {
          pendingReject(new Error('turnstile execute timeout'))
          pendingResolve = null
          pendingReject = null
        }
      }, 30_000)
      void id
    })
  } catch {
    return undefined
  }
}

/** Reset the widget after a use (or on form reset). */
export function resetCaptcha(): void {
  try {
    if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
  } catch {
    /* silent */
  }
}

/** Quick check from app code : is captcha actually enabled in this env ? */
export function captchaConfigured(): boolean {
  return Boolean(SITE_KEY)
}
