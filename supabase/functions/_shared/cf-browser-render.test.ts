import { describe, it, expect } from 'vitest'
import { buildCfPdfRequestBody, parseBasicAuthPair, redactCfRenderError } from './cf-browser-render.ts'

describe('buildCfPdfRequestBody', () => {
  it('construit un corps A4 avec auth Basic + attente SPA', () => {
    const body = buildCfPdfRequestBody({
      url: 'https://megga.ch/kyc-report/TOKEN',
      basicUser: 'ai',
      basicPass: 'ai',
    })
    expect(body.url).toBe('https://megga.ch/kyc-report/TOKEN')
    expect(body.authenticate).toEqual({ username: 'ai', password: 'ai' })
    expect(body.gotoOptions).toMatchObject({ waitUntil: 'networkidle0' })
    expect(body.waitForSelector).toMatchObject({ selector: '#pdf-ready' })
    expect(body.pdfOptions).toMatchObject({ format: 'a4', printBackground: true, preferCSSPageSize: true })
  })

  it('omet authenticate si pas de creds', () => {
    const body = buildCfPdfRequestBody({ url: 'https://x/y' })
    expect(body.authenticate).toBeUndefined()
  })
})

describe('redactCfRenderError', () => {
  // Jeton réaliste (_shared/magic-link-token.ts) : payload base64url + signature HMAC de 43 car.
  const PAYLOAD = 'eyJpZCI6IjNmMmE5YzFlLTc3YjQtNGQyMS05YTU1LTBlMWIyYzNkNGU1ZiIsImV4cCI6MTg5MzQ1NjAwMH0'
  const SIG = 'CzBVep_E6Q4zWH2ix-wRNluApcrvFDleg6jN8hc8YYY'
  const TOKEN = `${PAYLOAD}.${SIG}`
  // Hôte volontairement FAUX (le CRM est sur app.megga.ch) : c'est la panne de configuration
  // qu'on veut voir survivre au caviardage, puisque c'est elle qui a déjà coûté du temps.
  const RENDER_URL = `https://kyc.megga.ch/kyc-report/${TOKEN}`

  it('garde l’hôte et le chemin, ne retire que le jeton', () => {
    const out = redactCfRenderError(`page.goto: net::ERR_NAME_NOT_RESOLVED at ${RENDER_URL}`, RENDER_URL)
    // L'assertion qui compte : le journal désigne encore l'hôte à corriger.
    expect(out).toBe('page.goto: net::ERR_NAME_NOT_RESOLVED at https://kyc.megga.ch/kyc-report/[REDACTED:TOKEN]')
    expect(out).not.toContain(PAYLOAD)
    expect(out).not.toContain(SIG)
  })

  it('caviarde un jeton percent-encodé — mais c\'est le catalogue qui conclut', () => {
    // Un intermédiaire qui ré-encode l'URL rend le point en « %2E » : la substitution littérale
    // ne reconnaît plus l'URL qu'on a construite, et c'est l'ancrage de chemin du catalogue qui
    // prend le relais. Lui emporte « /kyc-report/ » avec la valeur — on perd la route, on garde
    // l'hôte, et le jeton tombe. C'est le contrat réel : on l'assère plutôt que de le souhaiter.
    const out = redactCfRenderError(
      `net::ERR_ABORTED at https://kyc.megga.ch/kyc-report/${PAYLOAD}%2E${SIG}`,
      RENDER_URL,
    )
    expect(out).not.toContain(SIG)
    expect(out).not.toContain(PAYLOAD)
    expect(out, "l'hôte fautif doit rester nommé").toContain('kyc.megga.ch')
  })

  it("LIMITE ASSUMÉE : un fragment tronqué dans du JSON échappé survit", () => {
    // Les « / » y sont échappés en « \\/ », donc l'URL littérale ne matche pas et l'ancrage de
    // chemin du catalogue non plus ; tronqué, le fragment n'a plus la forme <b64url>.<b64url>.
    // ACCEPTÉ, et ce n'est pas de la résignation : un fragment n'est PAS une capacité —
    // `verifyMagicLinkToken` exige exactement deux tranches jointes par un point ET une
    // signature HMAC valide sur la première, donc une moitié n'ouvre aucun droit. Une version
    // ancrée sur un préfixe rattrapait ce cas, au prix de quatre modes de panne pour protéger
    // ce qui n'ouvre rien ; elle a été retirée. Ce test EXISTE pour que le jour où quelqu'un
    // croira le contraire, il trouve la mesure plutôt que l'illusion.
    const tronque = PAYLOAD.slice(0, 60)
    const body = `{"success":false,"errors":[{"code":10000,"message":"Navigation timeout at https:\\/\\/kyc.megga.ch\\/kyc-report\\/${tronque}…"}]}`
    const out = redactCfRenderError(body, RENDER_URL)
    expect(out).toContain(tronque)
    expect(out, 'le jeton COMPLET, lui, ne doit jamais survivre').not.toContain(`${PAYLOAD}.${SIG}`)
  })

  it('caviarde aussi un secret que l’URL rendue ne porte pas', () => {
    // La ceinture ne connaît QUE le jeton qu'on vient de signer ; le catalogue partagé reste
    // branché derrière pour ce qui arrive d'ailleurs — redirection vers une autre route, JWT
    // d'un intermédiaire. Lui non plus n'a pas à emporter l'hôte.
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const out = redactCfRenderError(`net::ERR_ABORTED at https://kyc.megga.ch/r/${jwt}`, RENDER_URL)
    expect(out).toBe('net::ERR_ABORTED at https://kyc.megga.ch/r/[REDACTED:TOKEN]')
  })

  it('laisse intact un corps d’erreur sans jeton', () => {
    const body = 'waitForSelector: #pdf-ready timeout 20000ms exceeded'
    expect(redactCfRenderError(body, RENDER_URL)).toBe(body)
  })

  it('ne caviarde rien quand l’URL rendue ne porte pas de jeton', () => {
    // Garde-fou du plancher de longueur : une amorce vide vaudrait motif vide, donc effacerait
    // le corps entier — un caviardage qui détruit tout est le défaut qu'on corrige, pas un repli.
    const body = 'net::ERR_CONNECTION_REFUSED at https://kyc.megga.ch/'
    expect(redactCfRenderError(body, 'https://kyc.megga.ch/')).toBe(body)
  })

  it('tolère un corps vide (cfRes.text() peut échouer)', () => {
    expect(redactCfRenderError('', RENDER_URL)).toBe('')
  })
})

describe('parseBasicAuthPair', () => {
  it('découpe user:pass simple', () => {
    expect(parseBasicAuthPair('ai:ai')).toEqual({ user: 'ai', pass: 'ai' })
  })

  it('retourne {} si undefined', () => {
    expect(parseBasicAuthPair(undefined)).toEqual({})
  })

  it('tolère un pass contenant des ":"', () => {
    expect(parseBasicAuthPair('a:b:c')).toEqual({ user: 'a', pass: 'b:c' })
  })
})
