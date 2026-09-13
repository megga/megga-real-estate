/**
 * Stockages en mémoire posés À LA PLACE de `localStorage` / `sessionStorage`.
 *
 * POURQUOI : sous Node 26, le webstorage de Node masque celui de jsdom (il vaut
 * undefined sans `--localstorage-file`), alors que la CI tourne en Node 22 — un
 * test qui se fie au stockage de l'environnement passe à un endroit et casse à
 * l'autre. Posés sur `window` ET sur `globalThis` : le code lit tantôt
 * `window.localStorage`, tantôt `localStorage` nu.
 */
export class StockageMemoire implements Storage {
  private m = new Map<string, string>()
  get length(): number { return this.m.size }
  clear(): void { this.m.clear() }
  getItem(k: string): string | null { return this.m.has(k) ? (this.m.get(k) as string) : null }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null }
  removeItem(k: string): void { this.m.delete(k) }
  setItem(k: string, v: string): void { this.m.set(k, String(v)) }
  /** Toutes les clés présentes, triées. */
  cles(): string[] { return [...this.m.keys()].sort() }
}

/** Pose deux stockages neufs et les rend. */
export function poserStockagesMemoire(): { local: StockageMemoire; session: StockageMemoire } {
  const local = new StockageMemoire()
  const session = new StockageMemoire()
  for (const cible of [window, globalThis]) {
    Object.defineProperty(cible, 'localStorage', { configurable: true, value: local })
    Object.defineProperty(cible, 'sessionStorage', { configurable: true, value: session })
  }
  return { local, session }
}
