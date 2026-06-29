// supabase/functions/_shared/idx-ftp.ts
//
// Upload FTP du feed IDX — ISOLÉ ici (c'est la seule ligne non vérifiable sans
// serveur FTP réel). Utilise basic-ftp (client FTP/FTPS mature) en IMPORT
// DYNAMIQUE via spécificateur-string : convention repo pour les paquets npm en
// edge (cf. c2pa-verify avec npm:c2pa-wasm) → `deno check` (mode node_modules
// manuel en CI) ne tente PAS de résoudre le paquet, qui n'est pas dans package.json.
//
// ⚠ Si le runtime Edge Supabase ne permet pas le canal de DONNÉES FTP (TCP
// passif), basculer CE module vers un runner GitHub Actions (basic-ftp en Node
// pur, garanti) — le reste de idx-syndicate (génération + état) reste inchangé.

import { Readable } from 'node:stream'

export interface FtpTarget {
  host: string
  port: number
  secure: boolean // true = FTPS explicite (AUTH TLS)
  user: string
  password: string
  remoteDir: string
  remoteFilename: string
}

// Surface minimale de basic-ftp réellement utilisée (typée à la main car l'import
// est dynamique — pas de types statiques récupérés).
interface FtpClientLike {
  access(opts: { host: string; port: number; user: string; password: string; secure: boolean }): Promise<unknown>
  ensureDir(path: string): Promise<unknown>
  uploadFrom(source: Readable, toRemotePath: string): Promise<unknown>
  close(): void
}
interface BasicFtpModule {
  Client: new (timeoutMs?: number) => FtpClientLike
}

/** Dépose le CSV à `${remoteDir}/${remoteFilename}` sur le FTP cible.
 *  Lève en cas d'échec (le caller logge + marque l'agence en erreur). */
export async function uploadIdxCsv(target: FtpTarget, csv: string): Promise<void> {
  const ftpSpecifier = 'npm:basic-ftp@5'
  const ftp = (await import(ftpSpecifier)) as unknown as BasicFtpModule
  const client = new ftp.Client(30_000) // timeout 30s
  try {
    await client.access({
      host: target.host,
      port: target.port,
      user: target.user,
      password: target.password,
      secure: target.secure,
    })
    if (target.remoteDir && target.remoteDir !== '/' && target.remoteDir !== '') {
      await client.ensureDir(target.remoteDir)
    }
    await client.uploadFrom(Readable.from([csv]), target.remoteFilename)
  } finally {
    client.close()
  }
}
