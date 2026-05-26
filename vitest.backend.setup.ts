// Vitest setup for backend tests — loads .env.test.local into process.env
// before any test imports the Supabase helpers. Avoids hardcoding secrets
// on the command line.

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.test.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    // Don't override variables already set by the shell (CI etc.)
    if (!process.env[key]) process.env[key] = value
  }
}
