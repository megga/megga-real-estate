// MEGGA Auth — Cooldown hook (rate limit côté UX)
// Spec : 60s entre 2 envois de magic link / reset request.
// Persisté via sessionStorage pour survivre à la navigation entre les écrans
// (initial → sent, reset → resetsent). Reset au refresh.
import { useEffect, useState } from 'react'

type Tick = { remaining: number; start: (seconds?: number) => void; reset: () => void }

function readUntil(key: string): number {
  if (typeof sessionStorage === 'undefined') return 0
  const v = sessionStorage.getItem(key)
  if (!v) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function writeUntil(key: string, until: number) {
  if (typeof sessionStorage === 'undefined') return
  if (until <= Date.now()) sessionStorage.removeItem(key)
  else sessionStorage.setItem(key, String(until))
}

const STORAGE_PREFIX = 'megga.cooldown.'

export function useCooldown(key: string, defaultSeconds = 60): Tick {
  const storageKey = `${STORAGE_PREFIX}${key}`
  const [until, setUntil] = useState<number>(() => readUntil(storageKey))
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (until <= now) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [until, now])

  const remaining = Math.max(0, Math.ceil((until - now) / 1000))

  const start = (seconds: number = defaultSeconds) => {
    const target = Date.now() + seconds * 1000
    writeUntil(storageKey, target)
    setUntil(target)
    setNow(Date.now())
  }
  const reset = () => {
    writeUntil(storageKey, 0)
    setUntil(0)
  }

  return { remaining, start, reset }
}
