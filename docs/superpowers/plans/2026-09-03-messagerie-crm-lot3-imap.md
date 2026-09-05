# Messagerie CRM — Lot 3 : IMAP/SMTP (Infomaniak, Bluewin, autre boîte)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Avant de commencer** : le plan maître [2026-09-03-messagerie-crm.md](2026-09-03-messagerie-crm.md)
> (§3 D5, D6 ; §6.4 logos), le lot 1 livré (les modules `_shared/mail/*` existent), le lot 2
> livré (l'étape IMAP de l'assistant est dessinée, non câblée).
>
> ⛔ **Ce lot commence par un spike (T3.1) et ne continue que s'il passe.** Le runtime
> edge de Supabase annonce le TCP sortant, mais un plan n'est pas une mesure : on
> déploie une sonde et on lit sa réponse. Si la sonde échoue, T3.9 documente l'arrêt
> et la voie de repli (Cloudflare Worker) ; rien d'autre n'est écrit.

**Goal:** Connecter une boîte par IMAP (lecture, drapeaux, archive, corbeille) et SMTP (envoi avec copie dans « Envoyés ») depuis les edge functions, avec les présélections Infomaniak et Bluewin.

**Architecture:** Un client IMAP minimal écrit à la main sur `Deno.connectTls` (LOGIN, LIST, SELECT, UID SEARCH, UID FETCH, UID STORE, UID MOVE/COPY, APPEND, LOGOUT), un client SMTP implicite TLS (465) tout aussi minimal, `postal-mime` pour parser le RFC 822 reçu, un adaptateur `imap.ts` qui expose la même forme que Gmail/Graph (curseur par dossier `uidValidity + lastUid`), le fil reconstruit par `References`/`In-Reply-To`. Mot de passe dans Vault.

**Tech Stack:** Deno `Deno.connectTls`, `npm:postal-mime`, Vitest (fausse connexion scriptée).

---

## Contraintes mesurées (docs Supabase « Edge Functions › Limits », relues le 03.09.2026)

| Contrainte | Conséquence |
|---|---|
| ~~**Ports sortants 25 et 587 interdits**~~ ⛔ **À MOITIÉ FAUX, remesuré le 05.09.2026** : **25 est fermé** (`timeout_connect` à 8002 ms) mais **587 est OUVERT** (`220 … ESMTP ready` en clair, en 60 ms, depuis le même isolat). La ligne venait de la documentation Supabase ; la sonde T3.1 la départage. | SMTP **465 (TLS implicite)** reste la voie par DÉFAUT, parce qu'elle est la seule éprouvée de bout en bout ici. Mais **587 + STARTTLS est possible** : la puce « STARTTLS » de la maquette peut devenir vivante au lieu d'afficher une excuse. ⚠ La sonde prouve que le port répond et annonce ESMTP — elle n'a pas joué `STARTTLS` ni négocié la montée en TLS. C'est à T3.3 de l'éprouver. |
| Temps CPU 2 s par requête | le parsing MIME se fait message par message, jamais en lot dans une même requête ; 20 messages par passe IMAP au plus |
| Wall-clock 400 s (plan payant) | budget de passe 20 s, comme Gmail/Graph |
| Mémoire 256 Mo | un message de plus de 10 Mo est ingéré **sans corps** (`body_truncated=true`, `body_text` = « message trop volumineux ») |

Présélections — ✅ **les quatre hôtes sont désormais MESURÉS depuis la production** (sonde T3.1, 05.09.2026), plus recopiés d'une page d'aide. L'avertissement « à revérifier, elles bougent » a payé : un des quatre était mort.

| Fournisseur | IMAP | SMTP |
|---|---|---|
| Infomaniak | `mail.infomaniak.com:993` ✅ | `mail.infomaniak.com:465` ✅ |
| Bluewin (Swisscom) | ~~`imap.bluewin.ch:993`~~ → **`imaps.bluewin.ch:993`** ⛔ l'hôte du plan n'existe pas (`NXDOMAIN`, mesuré le 05.09.2026) ; le vrai pointe sur `imaps.p.bluenet.ch` | `smtpauths.bluewin.ch:465` ✅ |
| Autre | saisie | saisie |

---

## Fichiers du lot

| Créé | Rôle |
|---|---|
| `supabase/functions/mail-imap-probe/index.ts` | **spike**, retiré à la fin du lot (T3.9) |
| `supabase/functions/_shared/mail/duplex.ts` | abstraction de connexion (`Duplex`) + lecteur de lignes/littéraux |
| `supabase/functions/_shared/mail/imap-client.ts` (+ `.test.ts`) | client IMAP minimal |
| `supabase/functions/_shared/mail/smtp.ts` (+ `.test.ts`) | client SMTP 465 |
| `supabase/functions/_shared/mail/mime-parse.ts` (+ `.test.ts`) | RFC 822 → `NormalizedMessage` (postal-mime) |
| `supabase/functions/_shared/mail/imap.ts` | adaptateur (synchro par dossier, drapeaux, envoi + APPEND) |
| Modifié | |
| `supabase/functions/_shared/mail/sync.ts` | branche `imap` |
| `supabase/functions/mail-oauth/index.ts` | action `connect_imap` |
| `supabase/functions/mail-actions/index.ts`, `mail-send/index.ts`, `mail-attachment/index.ts` | branche `imap` |
| `src/components/crm/messagerie/MailAddAccountModal.tsx` | câblage de l'étape IMAP + présélections |
| `vitest.config.ts` | alias `npm:postal-mime` + 3 specs |
| `package.json` | `postal-mime` en devDependencies (tests) |

---

### Task 3.1 : Spike — l'edge peut-elle ouvrir un TLS sortant vers 993 et 465 ?

**Files:**
- Create: `supabase/functions/mail-imap-probe/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1 : Écrire la sonde (service-secret, aucune donnée, aucun identifiant)**

```ts
// supabase/functions/mail-imap-probe/index.ts
// SPIKE (lot 3, T3.1) — mesure, ne fait rien d'autre : ouvre un TLS sortant vers un
// hôte IMAP (993) et un hôte SMTP (465), lit la bannière, envoie une commande
// sans identifiant (CAPABILITY / EHLO), ferme. À RETIRER en T3.9.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

async function probe(hostname: string, port: number, command: string, expect: RegExp): Promise<Record<string, unknown>> {
  const t0 = Date.now()
  try {
    const conn = await Deno.connectTls({ hostname, port })
    const buf = new Uint8Array(4096)
    const n = await conn.read(buf)
    const banner = new TextDecoder().decode(buf.subarray(0, n ?? 0))
    await conn.write(new TextEncoder().encode(command + '\r\n'))
    const m = await conn.read(buf)
    const reply = new TextDecoder().decode(buf.subarray(0, m ?? 0))
    conn.close()
    return { hostname, port, ok: expect.test(reply), banner: banner.slice(0, 120), reply: reply.slice(0, 200), ms: Date.now() - t0 }
  } catch (e) {
    return { hostname, port, ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), ms: Date.now() - t0 }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  if (!(await isServiceSecret(admin, req))) return json({ error: 'unauthorized' }, 401)
  const results = [
    await probe('mail.infomaniak.com', 993, 'a1 CAPABILITY', /^\* CAPABILITY/m),
    await probe('mail.infomaniak.com', 465, 'EHLO megga.ch', /^250/m),
    await probe('imap.bluewin.ch', 993, 'a1 CAPABILITY', /^\* CAPABILITY/m),
    await probe('smtpauths.bluewin.ch', 465, 'EHLO megga.ch', /^250/m),
    // Témoin négatif attendu : 587 est bloqué par la plateforme.
    await probe('mail.infomaniak.com', 587, 'EHLO megga.ch', /^250/m),
  ]
  return json({ results })
})
```
`supabase/config.toml` :
```toml
[functions.mail-imap-probe]
verify_jwt = false
```

- [x] **Step 2 : Déployer et mesurer (⚠ EN PROD, c'est le but : le réseau local ne prouve rien)**

```bash
node scripts/check-edge-roster.mjs --write
npm run lint:edge-auth
supabase functions deploy mail-imap-probe --no-verify-jwt --project-ref eayczugyrvmtqnnmvjod
```
(exige `supabase login` sur la machine ; sinon merger ce seul commit sur `main` et laisser `deploy.yml` déployer). Puis, avec la clé service lue dans le dashboard (Project Settings → API) :
```bash
curl -s -X POST https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/mail-imap-probe \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'Content-Type: application/json' -d '{}' | python3 -m json.tool
```

- [x] **Step 3 : Consigner le résultat ICI, dans ce fichier, sous ce titre**

#### Résultat du spike — PASSE 1, mesurée en production le 05.09.2026 à 20:19 UTC

Déclenchée par `net.http_post` depuis SQL (la clé service lue sur place dans
`app_config`, jamais sortie de la base), réponse relue dans `net._http_response`.

| Hôte:port | ok | bannière / erreur | ms |
|---|---|---|---|
| mail.infomaniak.com:993 | ✅ | `* OK IMAP4 ready` → `* CAPABILITY IMAP4rev1 UIDPLUS IDLE LITERAL+ QUOTA AUTH=PLAIN AUTH=LOGIN` | 327 |
| mail.infomaniak.com:465 | ✅ | `220 mail.infomaniak.com ESMTP ready` → `250-PIPELINING … 250 AUTH PLAIN LOGIN` | 227 |
| imap.bluewin.ch:993 | ❌ | `failed to lookup address information: Name or service not known` | 28 |
| smtpauths.bluewin.ch:465 | ✅ | `220 bluewin.ch mailout-002.p.bluenet.ch Swisscom AG ESMTP server ready` → `250-AUTH LOGIN PLAIN … 250 OK` | 227 |
| mail.infomaniak.com:587 (témoin) | ❌ | `InvalidData: received corrupt message of type InvalidContentType` | 59 |

**Verdict : ☑ 993 et 465 passent → continuer en T3.2.** Le runtime edge ouvre bien
un TLS sortant vers les deux ports, chez deux fournisseurs différents, en moins de
350 ms. C'est la question que le spike posait, et elle a une réponse.

⛔ **Mais deux faits de ce plan sont FAUX, et la sonde les a trouvés.**

1. **`imap.bluewin.ch` N'EXISTE PAS.** L'échec est un `NXDOMAIN` en 28 ms — une
   résolution DNS, pas un blocage réseau : le même runtime avait résolu et joint
   `mail.infomaniak.com` la seconde d'avant, et il joint `smtpauths.bluewin.ch`
   la seconde d'après. Le tableau des présélections donnait un hôte mort. L'hôte
   réel est **`imaps.bluewin.ch`** (→ `imaps.p.bluenet.ch`), vérifié par
   résolution directe. ⚠ Le plan AVERTISSAIT lui-même que ces hôtes « bougent, à
   revérifier au moment de coder » : l'avertissement était juste, et il aurait
   coûté une session de débogage sur un client IMAP tout neuf si la sonde ne
   l'avait pas payé d'abord.
2. **« Ports sortants 25 et 587 interdits » n'est PAS ce que la sonde mesure.**
   L'erreur sur 587 est `InvalidContentType` en 59 ms — c'est-à-dire que des
   octets sont REVENUS et qu'ils n'étaient pas du TLS. Une connexion TCP qui
   aboutit et un serveur qui répond en clair, donc : ce témoin prouve seulement
   que **le TLS implicite** échoue sur 587, ce qui est le comportement normal
   d'un port STARTTLS. Il ne prouve rien sur l'ouverture du port. Un port
   réellement filtré aurait rendu `timeout_connect` au bout de 8 s, pas une
   erreur de handshake en 59 ms.

#### Résultat du spike — PASSE 2, mesurée en production le 05.09.2026 à 20:52 UTC

| Hôte:port | ok | bannière / réponse | ms |
|---|---|---|---|
| mail.infomaniak.com:993 (TLS) | ✅ | `* OK IMAP4 ready` → `* CAPABILITY IMAP4rev1 UIDPLUS IDLE LITERAL+ QUOTA AUTH=PLAIN AUTH=LOGIN` | 296 |
| mail.infomaniak.com:465 (TLS) | ✅ | `220 … ESMTP ready` → `250 AUTH PLAIN LOGIN` | 223 |
| **imaps.bluewin.ch:993 (TLS)** | ✅ | `* OK [CAPABILITY IMAP4rev1 SASL-IR LOGIN-REFERRALS ID ENABLE IDLE LITERAL+ AUTH=PLAIN AUTH=OAUTHBEARER AUTH=XOAUTH2]` | **181** |
| smtpauths.bluewin.ch:465 (TLS) | ✅ | `220 bluewin.ch mailout-002.p.bluenet.ch Swisscom AG ESMTP server ready` | 197 |
| mail.infomaniak.com:587 (TLS implicite) | ❌ | `InvalidData: received corrupt message of type InvalidContentType` | 63 |
| **mail.infomaniak.com:587 (CLAIR)** | ✅ | `220 mail.infomaniak.com ESMTP ready` | **60** |
| **mail.infomaniak.com:25 (CLAIR)** | ❌ | `Error: timeout_connect` | **8002** |

**Verdict : ☑ 993 et 465 passent, chez les DEUX fournisseurs. T3.2 peut commencer.**

##### Les deux dernières lignes sont la mesure la plus utile de ce spike

Elles sortent du MÊME isolat, à la MÊME seconde, et elles ne se ressemblent pas :

- **25 → `timeout_connect` à 8002 ms.** Un port filtré : rien ne revient, jamais.
  Le plan avait raison sur 25.
- **587 → bannière `220 … ESMTP ready` à 60 ms.** Un port OUVERT, qui parle en
  clair. Le plan avait tort sur 587.

⛔ **« Ports sortants 25 et 587 interdits » est donc à MOITIÉ FAUX**, et la moitié
fausse était celle qui gouvernait une décision d'interface. La contrainte venait
de la documentation Supabase ; c'est la sonde en clair qui la départage. Un
échec de handshake TLS en 63 ms et un timeout de connexion en 8002 ms se
ressemblent dans un journal et ne veulent pas dire la même chose : le premier
dit « ce port ne fait pas de TLS implicite », le second dit « ce port est fermé ».

**Conséquences, à porter dans le tableau des contraintes en tête de ce plan :**

1. **SMTP 587 + STARTTLS est POSSIBLE depuis l'edge.** La puce « STARTTLS » de la
   maquette n'a plus à échouer avec un message d'excuse : elle peut devenir
   vivante. ⚠ Ce que la sonde prouve est que le port répond et annonce ESMTP —
   elle n'a PAS joué `STARTTLS` ni négocié la montée en TLS. C'est mesuré à
   l'ouverture du port, pas à la poignée de main. Le client SMTP (T3.3) devra
   l'éprouver, et 465 reste la voie par défaut parce qu'elle est éprouvée ici.
2. **25 reste fermé**, et il n'y a rien à faire : c'est le port du relais
   serveur-à-serveur, dont on n'a pas besoin.

##### Ce que les bannières apprennent, et qui n'était pas dans le plan

- **Les deux fournisseurs n'annoncent pas les mêmes capacités.** Infomaniak :
  `UIDPLUS IDLE LITERAL+ QUOTA AUTH=PLAIN AUTH=LOGIN`. Bluewin : `SASL-IR
  LOGIN-REFERRALS ID ENABLE IDLE LITERAL+ AUTH=PLAIN AUTH=OAUTHBEARER
  AUTH=XOAUTH2` — **pas de `UIDPLUS`**.
  ⚠ L'architecture de ce plan repose sur `UID MOVE` et sur l'`APPENDUID` que
  rend `APPEND` : ce sont DEUX extensions de `UIDPLUS`. Sans elle, il faut le
  repli historique — `UID COPY` + `UID STORE +FLAGS \\Deleted` + `EXPUNGE` pour
  déplacer, et pas de moyen de connaître l'UID du message qu'on vient de classer
  dans « Envoyés ».
  ⚠⚠ **MAIS CETTE LISTE EST PRÉ-LOGIN, et Bluewin le DIT** : sa réponse se termine
  par « post-login capabilities have more ». `UIDPLUS` peut apparaître après
  authentification. **À vérifier en T3.2 sur une vraie boîte** — ne pas écrire le
  repli sur la foi d'une bannière pré-login, ni l'omettre sur la foi d'une
  supposition.
- **Ni l'un ni l'autre n'annonce `LOGINDISABLED`** : la commande `LOGIN` (celle
  d'IMAP4rev1, à ne pas confondre avec le mécanisme SASL `AUTH=LOGIN`) est
  permise sur les deux. C'est ce que T3.2 prévoit d'utiliser.
- **Bluewin annonce `SASL-IR`**, Infomaniak non : l'argument initial de
  `AUTHENTICATE` ne peut pas être envoyé sur la même ligne chez Infomaniak.

- [x] **Step 4 : Commit**

```bash
git add supabase/functions/mail-imap-probe/index.ts supabase/config.toml src/lib/edgeFunctionRoster.ts docs/superpowers/plans/2026-09-03-messagerie-crm-lot3-imap.md
git commit -m "spike(messagerie): sonde TLS sortant IMAP 993 / SMTP 465 depuis l'edge"
```

---

### Task 3.2 : Connexion abstraite + lecteur IMAP — `_shared/mail/duplex.ts`, `imap-client.ts`

**Files:**
- Create: `supabase/functions/_shared/mail/duplex.ts`
- Create: `supabase/functions/_shared/mail/imap-client.ts`
- Test: `supabase/functions/_shared/mail/imap-client.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1 : `duplex.ts`**

```ts
// supabase/functions/_shared/mail/duplex.ts
// Une connexion = lire des octets, écrire des octets, fermer. L'implémentation
// Deno (connectTls) vit dans une fonction séparée pour que les clients IMAP/SMTP
// se testent sous Node avec une fausse connexion scriptée.
export interface Duplex {
  read(): Promise<Uint8Array | null>
  write(bytes: Uint8Array): Promise<void>
  close(): void
}

export async function denoTlsDuplex(hostname: string, port: number): Promise<Duplex> {
  // `Deno` n'existe pas sous Node : référencé dynamiquement, jamais au corps du module.
  const D = (globalThis as unknown as { Deno: { connectTls(o: { hostname: string; port: number }): Promise<{ read(b: Uint8Array): Promise<number | null>; write(b: Uint8Array): Promise<number>; close(): void }> } }).Deno
  const conn = await D.connectTls({ hostname, port })
  return {
    async read() {
      const buf = new Uint8Array(16 * 1024)
      const n = await conn.read(buf)
      return n === null ? null : buf.subarray(0, n)
    },
    async write(bytes) {
      let off = 0
      while (off < bytes.length) off += await conn.write(bytes.subarray(off))
    },
    close() { try { conn.close() } catch { /* déjà fermée */ } },
  }
}

/** Lecteur de lignes CRLF avec prise en charge des littéraux IMAP `{n}\r\n<n octets>`. */
export class LineReader {
  private buf = new Uint8Array(0)
  private eof = false
  constructor(private conn: Duplex) {}

  private async fill(): Promise<boolean> {
    if (this.eof) return false
    const chunk = await this.conn.read()
    if (chunk === null) { this.eof = true; return false }
    const next = new Uint8Array(this.buf.length + chunk.length)
    next.set(this.buf); next.set(chunk, this.buf.length)
    this.buf = next
    return true
  }

  /** Une ligne sans son CRLF, ou null à la fin du flux. */
  async line(): Promise<string | null> {
    for (;;) {
      const i = indexOfCrlf(this.buf)
      if (i >= 0) {
        const s = new TextDecoder().decode(this.buf.subarray(0, i))
        this.buf = this.buf.subarray(i + 2)
        return s
      }
      if (!(await this.fill())) {
        if (this.buf.length === 0) return null
        const s = new TextDecoder().decode(this.buf); this.buf = new Uint8Array(0); return s
      }
    }
  }

  /** Exactement n octets (littéral). */
  async bytes(n: number): Promise<Uint8Array> {
    while (this.buf.length < n) if (!(await this.fill())) break
    const out = this.buf.subarray(0, n)
    this.buf = this.buf.subarray(n)
    return out
  }
}

function indexOfCrlf(b: Uint8Array): number {
  for (let i = 0; i + 1 < b.length; i++) if (b[i] === 13 && b[i + 1] === 10) return i
  return -1
}
```

- [ ] **Step 2 : Test du client (rouge) avec une connexion scriptée**

```ts
// supabase/functions/_shared/mail/imap-client.test.ts
import { describe, it, expect } from 'vitest'
import { ImapClient } from './imap-client.ts'
import type { Duplex } from './duplex.ts'

/** Fausse connexion : pour chaque commande reçue (par tag), une réponse scriptée. */
function fake(script: Record<string, string>, greeting = '* OK IMAP4rev1 ready\r\n') {
  const enc = new TextEncoder()
  const queue: Uint8Array[] = [enc.encode(greeting)]
  const sent: string[] = []
  const conn: Duplex = {
    async read() { return queue.shift() ?? null },
    async write(bytes) {
      const cmd = new TextDecoder().decode(bytes).replace(/\r\n$/, '')
      sent.push(cmd)
      const tag = cmd.split(' ')[0]
      const verb = cmd.split(' ').slice(1).join(' ')
      const key = Object.keys(script).find((k) => verb.startsWith(k))
      if (!key) throw new Error(`unscripted: ${cmd}`)
      queue.push(enc.encode(script[key].replace(/\$TAG/g, tag)))
    },
    close() {},
  }
  return { conn, sent }
}

describe('ImapClient', () => {
  it('login + select lit UIDVALIDITY / UIDNEXT', async () => {
    const { conn, sent } = fake({
      'LOGIN': '$TAG OK LOGIN done\r\n',
      'SELECT': '* 3 EXISTS\r\n* OK [UIDVALIDITY 42] UIDs valid\r\n* OK [UIDNEXT 100] Predicted next UID\r\n$TAG OK [READ-WRITE] SELECT completed\r\n',
    })
    const c = new ImapClient(conn)
    await c.connect()
    await c.login('u@ex.ch', 'p"w')
    expect(sent[0]).toBe('a1 LOGIN "u@ex.ch" "p\\"w"')
    const sel = await c.select('INBOX')
    expect(sel).toEqual({ exists: 3, uidValidity: 42, uidNext: 100 })
  })
  it('uidSearchSince rend les UID ; uidFetchFlags lit les drapeaux', async () => {
    const { conn } = fake({
      'LOGIN': '$TAG OK\r\n',
      'SELECT': '* OK [UIDVALIDITY 1]\r\n* OK [UIDNEXT 10]\r\n$TAG OK\r\n',
      'UID SEARCH': '* SEARCH 7 8 9\r\n$TAG OK SEARCH completed\r\n',
      'UID FETCH 7:9 (FLAGS)': '* 1 FETCH (UID 7 FLAGS (\\Seen))\r\n* 2 FETCH (UID 8 FLAGS ())\r\n* 3 FETCH (UID 9 FLAGS (\\Seen \\Flagged))\r\n$TAG OK\r\n',
    })
    const c = new ImapClient(conn)
    await c.connect(); await c.login('u', 'p'); await c.select('INBOX')
    expect(await c.uidSearchSince(new Date('2026-06-05T00:00:00Z'))).toEqual([7, 8, 9])
    expect(await c.uidFetchFlags('7:9')).toEqual([{ uid: 7, flags: ['\\Seen'] }, { uid: 8, flags: [] }, { uid: 9, flags: ['\\Seen', '\\Flagged'] }])
  })
  it('uidFetchRaw lit un littéral exactement', async () => {
    const raw = 'From: a@b\r\nSubject: hi\r\n\r\nBody'
    const { conn } = fake({
      'LOGIN': '$TAG OK\r\n', 'SELECT': '* OK [UIDVALIDITY 1]\r\n* OK [UIDNEXT 2]\r\n$TAG OK\r\n',
      'UID FETCH 7 (BODY.PEEK[])': `* 1 FETCH (UID 7 BODY[] {${raw.length}}\r\n${raw})\r\n$TAG OK\r\n`,
    })
    const c = new ImapClient(conn)
    await c.connect(); await c.login('u', 'p'); await c.select('INBOX')
    expect(new TextDecoder().decode(await c.uidFetchRaw(7))).toBe(raw)
  })
  it('list expose les usages spéciaux ; un NO lève', async () => {
    const { conn } = fake({
      'LOGIN': '$TAG OK\r\n',
      'LIST': '* LIST (\\HasNoChildren) "." INBOX\r\n* LIST (\\HasNoChildren \\Sent) "." "Sent Messages"\r\n* LIST (\\Trash) "." Trash\r\n$TAG OK\r\n',
      'SELECT': '$TAG NO Mailbox does not exist\r\n',
    })
    const c = new ImapClient(conn)
    await c.connect(); await c.login('u', 'p')
    expect(await c.list()).toEqual([
      { name: 'INBOX', attributes: ['\\HasNoChildren'] },
      { name: 'Sent Messages', attributes: ['\\HasNoChildren', '\\Sent'] },
      { name: 'Trash', attributes: ['\\Trash'] },
    ])
    await expect(c.select('Nope')).rejects.toThrow(/NO Mailbox/)
  })
})
```

Ajouter `'supabase/functions/_shared/mail/imap-client.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [ ] **Step 3 : `imap-client.ts`**

```ts
// supabase/functions/_shared/mail/imap-client.ts
// Client IMAP4rev1 MINIMAL : ce que la synchro et les gestes exigent, rien de plus.
// Pas de IDLE, pas de compression, pas de multi-commandes en vol. Chaque commande
// attend sa réponse taguée ; les réponses non taguées (`* …`) sont collectées.
import { LineReader, type Duplex } from './duplex.ts'

export interface ImapFolder { name: string; attributes: string[] }
export interface ImapSelect { exists: number; uidValidity: number; uidNext: number }
export interface ImapFlags { uid: number; flags: string[] }

const quote = (s: string) => `"${s.replace(/[\\"]/g, (c) => '\\' + c)}"`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function imapDate(d: Date): string {
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`
}

export class ImapClient {
  private reader: LineReader
  private n = 0
  constructor(private conn: Duplex) { this.reader = new LineReader(conn) }

  async connect(): Promise<void> {
    const greeting = await this.reader.line()
    if (!greeting || !greeting.startsWith('* OK')) throw new Error(`imap: bad greeting ${greeting ?? '(eof)'}`)
  }

  /** Envoie une commande, rend les lignes non taguées et la ligne taguée. Lève sur NO/BAD. */
  private async cmd(command: string): Promise<{ untagged: string[]; literals: Uint8Array[]; tagged: string }> {
    const tag = `a${++this.n}`
    await this.conn.write(new TextEncoder().encode(`${tag} ${command}\r\n`))
    const untagged: string[] = []
    const literals: Uint8Array[] = []
    for (;;) {
      let line = await this.reader.line()
      if (line === null) throw new Error('imap: connection closed')
      // Littéral en fin de ligne : on lit n octets, puis la suite de la ligne.
      let lit = line.match(/\{(\d+)\}$/)
      while (lit) {
        literals.push(await this.reader.bytes(Number(lit[1])))
        const rest = await this.reader.line()
        line = `${line.slice(0, -lit[0].length)}<literal ${literals.length - 1}>${rest ?? ''}`
        lit = line.match(/\{(\d+)\}$/)
      }
      if (line.startsWith(`${tag} `)) {
        if (!line.startsWith(`${tag} OK`)) throw new Error(`imap: ${line}`)
        return { untagged, literals, tagged: line }
      }
      untagged.push(line)
    }
  }

  async login(user: string, password: string): Promise<void> {
    await this.cmd(`LOGIN ${quote(user)} ${quote(password)}`)
  }

  async list(): Promise<ImapFolder[]> {
    const { untagged } = await this.cmd('LIST "" "*"')
    return untagged.filter((l) => l.startsWith('* LIST ')).map((l) => {
      const m = l.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (?:"([^"]*)"|(\S+))$/)
      return { name: m ? (m[2] ?? m[3]) : '', attributes: m && m[1] ? m[1].split(' ') : [] }
    }).filter((f) => f.name)
  }

  async select(folder: string): Promise<ImapSelect> {
    const { untagged } = await this.cmd(`SELECT ${quote(folder)}`)
    const num = (re: RegExp) => { const l = untagged.map((u) => u.match(re)).find(Boolean); return l ? Number(l[1]) : 0 }
    return { exists: num(/^\* (\d+) EXISTS/), uidValidity: num(/\[UIDVALIDITY (\d+)\]/), uidNext: num(/\[UIDNEXT (\d+)\]/) }
  }

  async uidSearchSince(since: Date): Promise<number[]> {
    const { untagged } = await this.cmd(`UID SEARCH SINCE ${imapDate(since)}`)
    const l = untagged.find((u) => u.startsWith('* SEARCH'))
    return l ? l.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean).map(Number) : []
  }

  async uidSearchRange(fromUid: number): Promise<number[]> {
    const { untagged } = await this.cmd(`UID SEARCH UID ${fromUid}:*`)
    const l = untagged.find((u) => u.startsWith('* SEARCH'))
    return l ? l.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean).map(Number) : []
  }

  async uidFetchFlags(set: string): Promise<ImapFlags[]> {
    const { untagged } = await this.cmd(`UID FETCH ${set} (FLAGS)`)
    return untagged.map((l) => l.match(/UID (\d+) FLAGS \(([^)]*)\)/)).filter(Boolean)
      .map((m) => ({ uid: Number(m![1]), flags: m![2].split(' ').filter(Boolean) }))
  }

  async uidFetchRaw(uid: number): Promise<Uint8Array> {
    const { literals } = await this.cmd(`UID FETCH ${uid} (BODY.PEEK[])`)
    if (!literals[0]) throw new Error(`imap: no body for uid ${uid}`)
    return literals[0]
  }

  async uidStore(uid: number, flags: string[], mode: 'add' | 'remove'): Promise<void> {
    await this.cmd(`UID STORE ${uid} ${mode === 'add' ? '+' : '-'}FLAGS.SILENT (${flags.join(' ')})`)
  }

  /** MOVE si le serveur l'annonce, sinon COPY + \Deleted + EXPUNGE. */
  async uidMove(uid: number, folder: string, hasMove: boolean): Promise<void> {
    if (hasMove) { await this.cmd(`UID MOVE ${uid} ${quote(folder)}`); return }
    await this.cmd(`UID COPY ${uid} ${quote(folder)}`)
    await this.uidStore(uid, ['\\Deleted'], 'add')
    await this.cmd('EXPUNGE')
  }

  async capability(): Promise<string[]> {
    const { untagged } = await this.cmd('CAPABILITY')
    const l = untagged.find((u) => u.startsWith('* CAPABILITY'))
    return l ? l.replace('* CAPABILITY', '').trim().split(/\s+/) : []
  }

  /** Dépose un message (copie « Envoyés » après un envoi SMTP). */
  async append(folder: string, raw: Uint8Array, flags = ['\\Seen']): Promise<void> {
    const tag = `a${++this.n}`
    await this.conn.write(new TextEncoder().encode(`${tag} APPEND ${quote(folder)} (${flags.join(' ')}) {${raw.length}}\r\n`))
    const cont = await this.reader.line()
    if (!cont || !cont.startsWith('+')) throw new Error(`imap: append refused ${cont ?? '(eof)'}`)
    await this.conn.write(raw)
    await this.conn.write(new TextEncoder().encode('\r\n'))
    for (;;) {
      const line = await this.reader.line()
      if (line === null) throw new Error('imap: connection closed')
      if (line.startsWith(`${tag} `)) { if (!line.startsWith(`${tag} OK`)) throw new Error(`imap: ${line}`); return }
    }
  }

  async logout(): Promise<void> {
    try { await this.cmd('LOGOUT') } catch { /* le serveur ferme parfois avant le OK */ }
    this.conn.close()
  }
}
```

- [ ] **Step 4 : Vert, `deno check`, commit**

```bash
npx vitest run supabase/functions/_shared/mail/imap-client.test.ts
deno check supabase/functions/_shared/mail/imap-client.ts supabase/functions/_shared/mail/duplex.ts
git add supabase/functions/_shared/mail/duplex.ts supabase/functions/_shared/mail/imap-client.ts supabase/functions/_shared/mail/imap-client.test.ts vitest.config.ts
git commit -m "feat(messagerie): client IMAP minimal (login, list, select, search, fetch, store, move, append)"
```
Attendu : 4 tests PASS.

---

### Task 3.3 : Client SMTP 465 — `_shared/mail/smtp.ts`

**Files:**
- Create: `supabase/functions/_shared/mail/smtp.ts`
- Test: `supabase/functions/_shared/mail/smtp.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1 : Test (rouge)**

```ts
// supabase/functions/_shared/mail/smtp.test.ts
import { describe, it, expect } from 'vitest'
import { smtpSend } from './smtp.ts'
import type { Duplex } from './duplex.ts'

function fake(script: [RegExp, string][]) {
  const enc = new TextEncoder()
  const queue: Uint8Array[] = [enc.encode('220 mail.infomaniak.com ESMTP\r\n')]
  const sent: string[] = []
  const conn: Duplex = {
    async read() { return queue.shift() ?? null },
    async write(bytes) {
      const cmd = new TextDecoder().decode(bytes)
      sent.push(cmd)
      const hit = script.find(([re]) => re.test(cmd))
      if (!hit) throw new Error(`unscripted: ${cmd.slice(0, 40)}`)
      queue.push(enc.encode(hit[1]))
    },
    close() {},
  }
  return { conn, sent }
}

describe('smtpSend', () => {
  it('EHLO, AUTH PLAIN, MAIL, RCPT ×2, DATA (dot-stuffing), QUIT', async () => {
    const { conn, sent } = fake([
      [/^EHLO /, '250-mail.infomaniak.com\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 52428800\r\n'],
      [/^AUTH PLAIN /, '235 Authentication successful\r\n'],
      [/^MAIL FROM:/, '250 OK\r\n'],
      [/^RCPT TO:/, '250 OK\r\n'],
      [/^DATA/, '354 End data with <CR><LF>.<CR><LF>\r\n'],
      [/\r\n\.\r\n$/, '250 OK queued\r\n'],
      [/^QUIT/, '221 Bye\r\n'],
    ])
    await smtpSend(conn, { user: 'u@ex.ch', password: 'pw', from: 'u@ex.ch', rcpts: ['a@b.ch', 'c@d.ch'], raw: 'Subject: x\r\n\r\n.leading dot\r\nend' })
    expect(sent[0]).toBe('EHLO megga.ch\r\n')
    expect(sent[1]).toBe(`AUTH PLAIN ${btoa('\0u@ex.ch\0pw')}\r\n`)
    expect(sent.filter((s) => s.startsWith('RCPT TO:'))).toEqual(['RCPT TO:<a@b.ch>\r\n', 'RCPT TO:<c@d.ch>\r\n'])
    expect(sent.find((s) => s.includes('leading dot'))).toBe('Subject: x\r\n\r\n..leading dot\r\nend\r\n.\r\n')
  })
  it('un refus 535 lève avec le texte du serveur', async () => {
    const { conn } = fake([[/^EHLO /, '250 ok\r\n'], [/^AUTH PLAIN /, '535 5.7.8 Authentication credentials invalid\r\n']])
    await expect(smtpSend(conn, { user: 'u', password: 'x', from: 'u@ex.ch', rcpts: ['a@b.ch'], raw: 'x' })).rejects.toThrow(/535/)
  })
})
```

Ajouter `'supabase/functions/_shared/mail/smtp.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [ ] **Step 2 : Implémentation**

```ts
// supabase/functions/_shared/mail/smtp.ts
// SMTP sur TLS implicite (465). Pas de STARTTLS : le port 587 est bloqué par la
// plateforme edge (docs « Limits »). AUTH PLAIN seulement (les deux fournisseurs
// présélectionnés l'annoncent ; LOGIN serait un ajout de 6 lignes le jour venu).
import { LineReader, type Duplex } from './duplex.ts'

export interface SmtpSendInput { user: string; password: string; from: string; rcpts: string[]; raw: string }

export class SmtpError extends Error {}

export async function smtpSend(conn: Duplex, a: SmtpSendInput): Promise<void> {
  const reader = new LineReader(conn)
  const enc = new TextEncoder()
  /** Lit une réponse (multi-ligne `250-…` jusqu'à `250 …`) et vérifie le code. */
  const expect = async (codes: number[]): Promise<string> => {
    const lines: string[] = []
    for (;;) {
      const l = await reader.line()
      if (l === null) throw new SmtpError('smtp: connection closed')
      lines.push(l)
      if (/^\d{3} /.test(l) || !/^\d{3}-/.test(l)) break
    }
    const code = Number(lines[lines.length - 1].slice(0, 3))
    if (!codes.includes(code)) throw new SmtpError(`smtp: ${lines.join(' | ')}`)
    return lines.join('\n')
  }
  const send = async (cmd: string) => { await conn.write(enc.encode(cmd + '\r\n')) }

  await expect([220])
  await send('EHLO megga.ch'); await expect([250])
  await send(`AUTH PLAIN ${btoa(`\0${a.user}\0${a.password}`)}`); await expect([235])
  await send(`MAIL FROM:<${a.from}>`); await expect([250])
  for (const r of a.rcpts) { await send(`RCPT TO:<${r}>`); await expect([250, 251]) }
  await send('DATA'); await expect([354])
  // Dot-stuffing (RFC 5321 §4.5.2) puis terminateur.
  const stuffed = a.raw.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..')
  await conn.write(enc.encode(stuffed + '\r\n.\r\n')); await expect([250])
  await send('QUIT')
  try { await expect([221]) } catch { /* certains serveurs ferment sans 221 */ }
  conn.close()
}
```

- [ ] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/smtp.test.ts
git add supabase/functions/_shared/mail/smtp.ts supabase/functions/_shared/mail/smtp.test.ts vitest.config.ts
git commit -m "feat(messagerie): client SMTP 465 (EHLO, AUTH PLAIN, DATA avec dot-stuffing)"
```
Attendu : 2 tests PASS.

---

### Task 3.4 : RFC 822 → message normalisé — `_shared/mail/mime-parse.ts` (postal-mime)

**Files:**
- Create: `supabase/functions/_shared/mail/mime-parse.ts`
- Test: `supabase/functions/_shared/mail/mime-parse.test.ts`
- Modify: `package.json` (devDependency), `vitest.config.ts` (alias + spec)

- [ ] **Step 1 : Dépendance de test + alias**

```bash
npm install --save-dev postal-mime@2.4.3
```
(vérifier la dernière 2.x sur npm et l'épingler à l'identique dans le `npm:` de l'edge.)

Dans `vitest.config.ts`, sous `resolve.alias`, ajouter :
```ts
'npm:postal-mime@2.4.3': 'postal-mime',
```

- [ ] **Step 2 : Test (rouge)**

```ts
// supabase/functions/_shared/mail/mime-parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseRfc822 } from './mime-parse.ts'

const RAW = [
  'From: =?UTF-8?B?Wm/DqSBSb2NoYXQ=?= <zoe@ex.ch>',
  'To: Gregory <g@agence.ch>',
  'Subject: Visite',
  'Message-ID: <abc@ex.ch>',
  'In-Reply-To: <root@agence.ch>',
  'References: <root@agence.ch> <mid@ex.ch>',
  'Date: Thu, 03 Sep 2026 10:00:00 +0200',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="B"',
  '',
  '--B',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Bonjour & bienvenue',
  '--B',
  'Content-Type: application/pdf; name="plan.pdf"',
  'Content-Disposition: attachment; filename="plan.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0=',
  '--B--',
  '',
].join('\r\n')

describe('parseRfc822', () => {
  it('produit un NormalizedMessage complet', async () => {
    const n = await parseRfc822(new TextEncoder().encode(RAW), { providerMessageId: 'INBOX:42:7', direction: 'inbound', isRead: false, isStarred: false, inInbox: true })
    expect(n.providerMessageId).toBe('INBOX:42:7')
    expect(n.from).toEqual({ name: 'Zoé Rochat', email: 'zoe@ex.ch' })
    expect(n.to).toEqual([{ name: 'Gregory', email: 'g@agence.ch' }])
    expect(n.rfc822MessageId).toBe('<abc@ex.ch>')
    expect(n.inReplyTo).toBe('<root@agence.ch>')
    expect(n.references).toEqual(['<root@agence.ch>', '<mid@ex.ch>'])
    expect(n.bodyText).toBe('Bonjour & bienvenue')
    expect(n.sentAt).toBe('2026-09-03T08:00:00.000Z')
    expect(n.attachments).toEqual([{ providerAttachmentId: '0', filename: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 5, isInline: false, contentId: null }])
    // providerThreadId provisoire = Message-ID ; l'adaptateur le remplace par le fil trouvé via References.
    expect(n.providerThreadId).toBe('<abc@ex.ch>')
  })
})
```

Ajouter `'supabase/functions/_shared/mail/mime-parse.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [ ] **Step 3 : Implémentation**

```ts
// supabase/functions/_shared/mail/mime-parse.ts
// RFC 822 brut → NormalizedMessage, par postal-mime (pur JS, sans Node natif, donc
// edge-compatible). Le fil (providerThreadId) est PROVISOIRE ici : Message-ID ;
// l'adaptateur IMAP le résout par References/In-Reply-To contre la base.
import PostalMime from 'npm:postal-mime@2.4.3'
import type { NormalizedAttachment, NormalizedMessage } from './types.ts'
import { htmlToText, snippetOf } from './mime.ts'

export interface ParseCtx {
  providerMessageId: string
  direction: 'inbound' | 'outbound'
  isRead: boolean
  isStarred: boolean
  inInbox: boolean
}

interface PmAddress { name?: string; address?: string }
interface PmAttachment { filename?: string; mimeType?: string; disposition?: string; contentId?: string; content?: ArrayBuffer | string }
interface PmEmail {
  from?: PmAddress; to?: PmAddress[]; cc?: PmAddress[]; bcc?: PmAddress[]; replyTo?: PmAddress[]
  subject?: string; messageId?: string; inReplyTo?: string; references?: string; date?: string
  text?: string; html?: string; attachments?: PmAttachment[]
}

const addr = (a?: PmAddress) => (a?.address ? { name: a.name?.trim() || null, email: a.address.toLowerCase() } : null)
const addrs = (as?: PmAddress[]) => (as ?? []).map(addr).filter((x): x is { name: string | null; email: string } => !!x)

export async function parseRfc822(raw: Uint8Array, ctx: ParseCtx): Promise<NormalizedMessage> {
  const parser = new PostalMime()
  const e = (await parser.parse(raw)) as PmEmail
  const from = addr(e.from) ?? { name: null, email: '' }
  const attachments: NormalizedAttachment[] = (e.attachments ?? []).map((a, i) => ({
    providerAttachmentId: String(i),
    filename: a.filename || `piece-${i + 1}`,
    mimeType: a.mimeType || 'application/octet-stream',
    sizeBytes: typeof a.content === 'string' ? a.content.length : (a.content?.byteLength ?? 0),
    isInline: a.disposition === 'inline' || !!a.contentId,
    contentId: a.contentId ?? null,
  }))
  const text = e.text ?? (e.html ? htmlToText(e.html) : null)
  return {
    providerMessageId: ctx.providerMessageId,
    providerThreadId: e.messageId ?? ctx.providerMessageId,
    rfc822MessageId: e.messageId ?? null,
    inReplyTo: e.inReplyTo ?? null,
    references: (e.references ?? '').split(/\s+/).filter(Boolean),
    direction: ctx.direction,
    from,
    to: addrs(e.to), cc: addrs(e.cc), bcc: addrs(e.bcc),
    replyTo: addr(e.replyTo?.[0])?.email ?? null,
    subject: e.subject ?? '',
    snippet: snippetOf(text ?? ''),
    bodyText: text,
    bodyHtml: e.html ?? null,
    sentAt: new Date(e.date ?? Date.now()).toISOString(),
    isRead: ctx.isRead, isStarred: ctx.isStarred, inInbox: ctx.inInbox, isTrashed: false, isDraft: false,
    providerLabels: [],
    attachments,
  }
}

/** Octets d'une pièce (index = providerAttachmentId) d'un message brut. */
export async function attachmentBytesFromRaw(raw: Uint8Array, index: number): Promise<{ bytes: Uint8Array; mimeType: string; filename: string } | null> {
  const parser = new PostalMime()
  const e = (await parser.parse(raw)) as PmEmail
  const a = e.attachments?.[index]
  if (!a || a.content === undefined) return null
  const bytes = typeof a.content === 'string' ? new TextEncoder().encode(a.content) : new Uint8Array(a.content)
  return { bytes, mimeType: a.mimeType || 'application/octet-stream', filename: a.filename || `piece-${index + 1}` }
}
```

- [ ] **Step 4 : Vert, `deno check`, commit**

```bash
npx vitest run supabase/functions/_shared/mail/mime-parse.test.ts
deno check supabase/functions/_shared/mail/mime-parse.ts
git add supabase/functions/_shared/mail/mime-parse.ts supabase/functions/_shared/mail/mime-parse.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat(messagerie): parseur RFC 822 (postal-mime) vers message normalisé"
```

---

### Task 3.5 : Adaptateur IMAP — `_shared/mail/imap.ts`

**Files:**
- Create: `supabase/functions/_shared/mail/imap.ts`

Pas de test unitaire dédié (assemblage de 3.2-3.4 + base) ; éprouvé par l'épreuve de bout en bout (T3.8).

- [ ] **Step 1 : Implémentation**

```ts
// supabase/functions/_shared/mail/imap.ts
// Adaptateur IMAP : même forme que gmail.ts/graph.ts vue depuis sync.ts.
// Curseur par dossier {uidValidity, lastUid} ; première passe = UID SEARCH SINCE 90 j ;
// ensuite UID SEARCH UID lastUid+1:*. Drapeaux resynchronisés sur les 200 derniers
// UID connus. ⚠ v1 : une suppression faite dans le client mail n'est PAS détectée
// (elle exigerait de comparer les UID existants ; à mesurer avant d'écrire).
// provider_message_id = `<dossier>:<uidValidity>:<uid>` — donc l'action retrouve dossier et UID.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ImapConfig, ImapCursor, ImapSecret, MailAccountRow, NormalizedMessage } from './types.ts'
import { ImapClient, type ImapFolder } from './imap-client.ts'
import { denoTlsDuplex, type Duplex } from './duplex.ts'
import { parseRfc822 } from './mime-parse.ts'
import { readAccountSecret } from './secrets.ts'
import { applyRemoteChanges, ingestMessages } from './ingest.ts'
import { smtpSend } from './smtp.ts'

export interface ImapDeps { duplex?: (host: string, port: number) => Promise<Duplex>; now?: () => number }
const BATCH = 20
const MAX_RAW_BYTES = 10 * 1024 * 1024

export interface ImapFolders { inbox: string; sent: string | null; archive: string | null; trash: string | null }

/** Usage spécial (RFC 6154) d'abord, puis noms usuels (Infomaniak, Bluewin, Apple, Gmail-IMAP). */
export function resolveFolders(list: ImapFolder[]): ImapFolders {
  const byAttr = (a: string) => list.find((f) => f.attributes.some((x) => x.toLowerCase() === a.toLowerCase()))?.name ?? null
  const byName = (names: string[]) => list.find((f) => names.some((n) => f.name.toLowerCase() === n.toLowerCase() || f.name.toLowerCase().endsWith(`.${n.toLowerCase()}`) || f.name.toLowerCase().endsWith(`/${n.toLowerCase()}`)))?.name ?? null
  return {
    inbox: 'INBOX',
    sent: byAttr('\\Sent') ?? byName(['Sent', 'Sent Messages', 'Sent Items', 'Envoyés', 'Envoyes', 'Gesendet', 'Inviati']),
    archive: byAttr('\\Archive') ?? byName(['Archive', 'Archives', 'Archiv', 'Archivio']),
    trash: byAttr('\\Trash') ?? byName(['Trash', 'Deleted Messages', 'Deleted Items', 'Corbeille', 'Papierkorb', 'Cestino']),
  }
}

export async function imapOpen(cfg: ImapConfig, password: string, deps: ImapDeps = {}): Promise<{ client: ImapClient; folders: ImapFolders; hasMove: boolean }> {
  const dial = deps.duplex ?? denoTlsDuplex
  const client = new ImapClient(await dial(cfg.imapHost, cfg.imapPort))
  await client.connect()
  await client.login(cfg.user, password)
  const caps = await client.capability()
  const folders = resolveFolders(await client.list())
  return { client, folders, hasMove: caps.includes('MOVE') }
}

async function password(admin: SupabaseClient, account: MailAccountRow): Promise<string> {
  if (!account.vault_secret_id) throw new Error('no_secret')
  const s = await readAccountSecret<ImapSecret>(admin, account.vault_secret_id)
  if (!s || !('password' in s)) throw new Error('no_secret')
  return s.password
}

/** Trouve le fil par References/In-Reply-To ; sinon le Message-ID devient l'id de fil. */
async function threadIdFor(admin: SupabaseClient, account: MailAccountRow, m: NormalizedMessage): Promise<string> {
  const ids = [...m.references, ...(m.inReplyTo ? [m.inReplyTo] : [])].filter(Boolean)
  if (ids.length) {
    const { data } = await admin.from('mail_messages').select('thread_id').eq('account_id', account.id).in('rfc822_message_id', ids).limit(1).maybeSingle()
    if (data) {
      const { data: t } = await admin.from('mail_threads').select('provider_thread_id').eq('id', data.thread_id).single()
      if (t) return t.provider_thread_id
    }
  }
  return m.rfc822MessageId ?? m.providerMessageId
}

export async function imapSyncPass(admin: SupabaseClient, account: MailAccountRow, cursorIn: ImapCursor | null, budgetMs: number, deps: ImapDeps = {}): Promise<{ cursor: ImapCursor; inserted: number; updated: number; changes: number; done: boolean }> {
  const now = deps.now ?? Date.now
  const start = now()
  const cfg = account.imap_config!
  const { client, folders } = await imapOpen(cfg, await password(admin, account), deps)
  const cursor: ImapCursor = cursorIn?.kind === 'imap' ? cursorIn : { kind: 'imap', folders: {}, initialDone: false }
  let inserted = 0, updated = 0, changes = 0, done = true
  try {
    for (const [name, direction] of [[folders.inbox, 'inbound'], [folders.sent, 'outbound']] as [string | null, 'inbound' | 'outbound'][]) {
      if (!name) continue
      if (now() - start > budgetMs) { done = false; break }
      const sel = await client.select(name)
      const st = cursor.folders[name] ?? { uidValidity: sel.uidValidity, lastUid: 0 }
      if (st.uidValidity !== sel.uidValidity) { st.uidValidity = sel.uidValidity; st.lastUid = 0 }
      const uids = st.lastUid === 0
        ? await client.uidSearchSince(new Date(now() - 90 * 86_400_000))
        : (await client.uidSearchRange(st.lastUid + 1)).filter((u) => u > st.lastUid)
      const batch = uids.sort((a, b) => a - b).slice(0, BATCH)
      const msgs: NormalizedMessage[] = []
      for (const uid of batch) {
        if (now() - start > budgetMs) break
        const raw = await client.uidFetchRaw(uid)
        const flags = (await client.uidFetchFlags(String(uid)))[0]?.flags ?? []
        const pid = `${name}:${sel.uidValidity}:${uid}`
        let m: NormalizedMessage
        if (raw.byteLength > MAX_RAW_BYTES) {
          m = await parseRfc822(raw.subarray(0, 64 * 1024), { providerMessageId: pid, direction, isRead: flags.includes('\\Seen'), isStarred: flags.includes('\\Flagged'), inInbox: direction === 'inbound' })
          m.bodyHtml = null; m.bodyText = '(message trop volumineux pour être affiché ici)'
        } else {
          m = await parseRfc822(raw, { providerMessageId: pid, direction, isRead: flags.includes('\\Seen'), isStarred: flags.includes('\\Flagged'), inInbox: direction === 'inbound' })
        }
        m.providerThreadId = await threadIdFor(admin, account, m)
        msgs.push(m)
        st.lastUid = Math.max(st.lastUid, uid)
      }
      const r = await ingestMessages(admin, account, msgs)
      inserted += r.inserted; updated += r.updated
      cursor.folders[name] = st
      if (uids.length > batch.length) done = false

      // Drapeaux des 200 derniers messages connus de ce dossier (lu / étoile faits ailleurs).
      if (direction === 'inbound' && st.lastUid > 0) {
        const from = Math.max(1, st.lastUid - 200)
        const remote = await client.uidFetchFlags(`${from}:${st.lastUid}`)
        const { data: local } = await admin.from('mail_messages').select('provider_message_id, is_read')
          .eq('account_id', account.id).like('provider_message_id', `${name}:${sel.uidValidity}:%`)
        const localById = new Map((local ?? []).map((r: { provider_message_id: string; is_read: boolean }) => [r.provider_message_id, r.is_read]))
        const diffs = remote.flatMap((f) => {
          const pid = `${name}:${sel.uidValidity}:${f.uid}`
          if (!localById.has(pid)) return []
          const isRead = f.flags.includes('\\Seen')
          return isRead === localById.get(pid) ? [] : [{ kind: 'flags' as const, providerMessageId: pid, isRead, isStarred: f.flags.includes('\\Flagged') }]
        })
        changes += await applyRemoteChanges(admin, account, diffs)
      }
    }
    if (done) cursor.initialDone = true
  } finally {
    await client.logout()
  }
  return { cursor, inserted, updated, changes, done }
}

/** Décompose `<dossier>:<uidValidity>:<uid>`. */
export function splitProviderId(pid: string): { folder: string; uid: number } | null {
  const m = pid.match(/^(.*):(\d+):(\d+)$/)
  return m ? { folder: m[1], uid: Number(m[3]) } : null
}

export type ImapAction = 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'trash' | 'untrash'

export async function imapApply(admin: SupabaseClient, account: MailAccountRow, action: ImapAction, providerMessageIds: string[], deps: ImapDeps = {}): Promise<Record<string, string>> {
  const { client, folders, hasMove } = await imapOpen(account.imap_config!, await password(admin, account), deps)
  const renamed: Record<string, string> = {}
  try {
    for (const pid of providerMessageIds) {
      const p = splitProviderId(pid)
      if (!p) continue
      const sel = await client.select(p.folder)
      if (action === 'mark_read' || action === 'mark_unread') await client.uidStore(p.uid, ['\\Seen'], action === 'mark_read' ? 'add' : 'remove')
      else if (action === 'star' || action === 'unstar') await client.uidStore(p.uid, ['\\Flagged'], action === 'star' ? 'add' : 'remove')
      else {
        const dest = action === 'archive' ? folders.archive : action === 'trash' ? folders.trash : folders.inbox
        if (!dest) throw new Error(`imap: no ${action} folder on this server`)
        // Après un MOVE l'UID change : on ne peut pas le connaître sans re-chercher.
        // On le retrouve par Message-ID dans le dossier cible.
        const { data: row } = await admin.from('mail_messages').select('rfc822_message_id').eq('account_id', account.id).eq('provider_message_id', pid).single()
        await client.uidMove(p.uid, dest, hasMove)
        const dsel = await client.select(dest)
        const found = row?.rfc822_message_id ? await client.uidSearchHeaderMessageId(row.rfc822_message_id) : []
        if (found.length) renamed[pid] = `${dest}:${dsel.uidValidity}:${found[found.length - 1]}`
        void sel
      }
    }
  } finally {
    await client.logout()
  }
  return renamed
}

/** Envoi SMTP puis copie dans « Envoyés » (le serveur ne le fait pas seul). */
export async function imapSend(admin: SupabaseClient, account: MailAccountRow, raw: string, rcpts: string[], deps: ImapDeps = {}): Promise<{ providerMessageId: string | null }> {
  const cfg = account.imap_config!
  const pw = await password(admin, account)
  const dial = deps.duplex ?? denoTlsDuplex
  await smtpSend(await dial(cfg.smtpHost, cfg.smtpPort), { user: cfg.user, password: pw, from: account.email, rcpts, raw })
  const { client, folders } = await imapOpen(cfg, pw, deps)
  try {
    if (!folders.sent) return { providerMessageId: null }
    const bytes = new TextEncoder().encode(raw)
    await client.append(folders.sent, bytes)
    const sel = await client.select(folders.sent)
    const mid = raw.match(/^Message-ID:\s*(<[^>]+>)/mi)?.[1]
    const found = mid ? await client.uidSearchHeaderMessageId(mid) : []
    return { providerMessageId: found.length ? `${folders.sent}:${sel.uidValidity}:${found[found.length - 1]}` : null }
  } finally {
    await client.logout()
  }
}

/** Octets d'une pièce : on relit le message brut et on extrait l'index. */
export async function imapAttachment(admin: SupabaseClient, account: MailAccountRow, providerMessageId: string, index: number, deps: ImapDeps = {}): Promise<Uint8Array> {
  const p = splitProviderId(providerMessageId)
  if (!p) throw new Error('bad provider id')
  const { client } = await imapOpen(account.imap_config!, await password(admin, account), deps)
  try {
    await client.select(p.folder)
    const raw = await client.uidFetchRaw(p.uid)
    const { attachmentBytesFromRaw } = await import('./mime-parse.ts')
    const a = await attachmentBytesFromRaw(raw, index)
    if (!a) throw new Error('attachment not found')
    return a.bytes
  } finally {
    await client.logout()
  }
}
```

Ajouter à `imap-client.ts` (T3.2) la recherche par en-tête, utilisée deux fois ci-dessus :
```ts
  async uidSearchHeaderMessageId(messageId: string): Promise<number[]> {
    const { untagged } = await this.cmd(`UID SEARCH HEADER Message-ID ${quote(messageId)}`)
    const l = untagged.find((u) => u.startsWith('* SEARCH'))
    return l ? l.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean).map(Number) : []
  }
```

- [ ] **Step 2 : `deno check`, commit**

```bash
deno check supabase/functions/_shared/mail/imap.ts
git add supabase/functions/_shared/mail/imap.ts supabase/functions/_shared/mail/imap-client.ts
git commit -m "feat(messagerie): adaptateur IMAP (synchro par dossier, drapeaux, move, envoi + APPEND, pièces)"
```

---

### Task 3.6 : Câblage — `connect_imap`, branche `imap` dans sync / actions / send / attachment

**Files:**
- Modify: `supabase/functions/mail-oauth/index.ts`, `supabase/functions/_shared/mail/sync.ts`, `supabase/functions/mail-actions/index.ts`, `supabase/functions/mail-send/index.ts`, `supabase/functions/mail-attachment/index.ts`

- [ ] **Step 1 : `mail-oauth` — action `connect_imap`**

Ajouter, avant `return json({ error: 'unknown_action' }, 400)` :
```ts
  if (action === 'connect_imap') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const cfgImap: ImapConfig = {
      imapHost: String(body.imap_host ?? '').trim(), imapPort: Number(body.imap_port ?? 993),
      smtpHost: String(body.smtp_host ?? '').trim(), smtpPort: Number(body.smtp_port ?? 465),
      user: String(body.user ?? email).trim(), encryption: body.encryption === 'starttls' ? 'starttls' : 'ssl',
    }
    const pw = String(body.password ?? '')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !cfgImap.imapHost || !cfgImap.smtpHost || !pw) return json({ error: 'invalid_input' }, 400)
    // Ports 25 et 587 interdits par la plateforme edge : on le dit, on ne laisse pas échouer en silence.
    if (cfgImap.encryption === 'starttls' || cfgImap.smtpPort === 587 || cfgImap.smtpPort === 25) return json({ error: 'starttls_unsupported', hint: 'smtp_465' }, 400)
    try {
      const { client } = await imapOpen(cfgImap, pw)
      await client.logout()
      // SMTP : EHLO + AUTH seulement (pas d'envoi) — même code que smtpSend jusqu'à AUTH.
      await smtpProbe(await denoTlsDuplex(cfgImap.smtpHost, cfgImap.smtpPort), cfgImap.user, pw)
    } catch (e) {
      return json({ error: 'connection_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
    }
    const visibility = body.visibility === 'agency' ? 'agency' : 'owner'
    const { data: existing } = await admin.from('mail_accounts').select('id, vault_secret_id').eq('agency_id', profile.agency_id).eq('provider', 'imap').ilike('email', email).maybeSingle()
    if (existing?.vault_secret_id) await deleteAccountSecret(admin, existing.vault_secret_id).catch(() => undefined)
    const vaultId = await storeAccountSecret(admin, `mail:imap:${email}`, { password: pw })
    const patch = { owner_id: user.id, visibility, status: 'active', last_error: null, vault_secret_id: vaultId, imap_config: cfgImap, next_sync_at: new Date().toISOString(), sync_cursor: {} }
    let accountId: string
    if (existing) { await admin.from('mail_accounts').update(patch).eq('id', existing.id); accountId = existing.id }
    else {
      const { data: ins, error } = await admin.from('mail_accounts').insert({ agency_id: profile.agency_id, provider: 'imap', email, display_name: email, ...patch }).select('id').single()
      if (error) { await deleteAccountSecret(admin, vaultId).catch(() => undefined); return json({ error: 'account_insert_failed', detail: error.message }, 500) }
      accountId = ins.id
    }
    const { count } = await admin.from('mail_labels').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id)
    if ((count ?? 0) === 0) {
      const { data: p } = await admin.from('profiles').select('language').eq('id', user.id).maybeSingle()
      const lang = (['fr', 'de', 'en', 'it'] as const).find((l) => l === p?.language) ?? 'fr'
      await admin.from('mail_labels').insert(SEED_LABELS[lang].map((name, i) => ({ agency_id: profile.agency_id, name, color: SEED_COLORS[i], position: i, is_default: true })))
    }
    const { data: account } = await admin.from('mail_accounts').select('*').eq('id', accountId).single()
    EdgeRuntime.waitUntil(syncAccount(admin, account as MailAccountRow, cfg, 45_000))
    const { data: pub } = await admin.from('mail_accounts').select(PUBLIC_COLS).eq('id', accountId).single()
    return json({ account: pub })
  }
```
Imports à ajouter en tête de `mail-oauth/index.ts` :
```ts
import { imapOpen } from '../_shared/mail/imap.ts'
import { denoTlsDuplex } from '../_shared/mail/duplex.ts'
import { smtpProbe } from '../_shared/mail/smtp.ts'
import type { ImapConfig } from '../_shared/mail/types.ts'
```
Et dans `smtp.ts`, extraire la sonde (EHLO + AUTH + QUIT) :
```ts
export async function smtpProbe(conn: Duplex, user: string, password: string): Promise<void> {
  const reader = new LineReader(conn)
  const enc = new TextEncoder()
  const expect = async (codes: number[]) => {
    const lines: string[] = []
    for (;;) { const l = await reader.line(); if (l === null) throw new SmtpError('smtp: connection closed'); lines.push(l); if (/^\d{3} /.test(l)) break }
    const code = Number(lines[lines.length - 1].slice(0, 3))
    if (!codes.includes(code)) throw new SmtpError(`smtp: ${lines.join(' | ')}`)
  }
  await expect([220])
  await conn.write(enc.encode('EHLO megga.ch\r\n')); await expect([250])
  await conn.write(enc.encode(`AUTH PLAIN ${btoa(`\0${user}\0${password}`)}\r\n`)); await expect([235])
  await conn.write(enc.encode('QUIT\r\n'))
  conn.close()
}
```

- [ ] **Step 2 : `sync.ts` — branche `imap`**

Remplacer `else throw new Error(\`provider ${account.provider} not supported by this build\`)` par :
```ts
    else if (account.provider === 'imap') {
      const r = await imapSyncPass(admin, account, (account.sync_cursor as ImapCursor)?.kind === 'imap' ? (account.sync_cursor as ImapCursor) : null, budgetMs, deps)
      out.inserted += r.inserted; out.updated += r.updated; out.changes += r.changes; out.done = r.done
      cursor = r.cursor
    } else throw new Error(`provider ${account.provider} unknown`)
```
avec `import { imapSyncPass } from './imap.ts'` et `ImapCursor` ajouté à l'import des types.

- [ ] **Step 3 : `mail-actions` — branche `imap` dans `pushToProvider`**

Remplacer le `else { throw new Error(…not supported…) }` par :
```ts
    } else if (account.provider === 'imap') {
      Object.assign(renamed, await imapApply(admin, account, action, msgs.map((x) => x.provider_message_id)))
      break // imapApply traite tout le lot en une connexion
    }
```
(`pushToProvider` reçoit désormais `admin` en premier paramètre ; adapter l'appel et l'import `imapApply`). Le `getValidAccessToken` ne s'applique pas à `imap` : l'entourer de `if (account.provider !== 'imap')` et passer `''` comme token.

- [ ] **Step 4 : `mail-send` — branche `imap`**

Avant `else { return json({ error: 'provider_not_supported' }, 501) }` :
```ts
    } else if (account.provider === 'imap') {
      const raw = buildMime(outgoing)
      const r = await imapSend(admin, account, raw, [...to, ...cc, ...bcc].map((a) => a.email))
      if (!threadId) {
        const { data: t } = await admin.from('mail_threads').insert({
          account_id: account.id, agency_id: account.agency_id, provider_thread_id: messageId, subject, snippet: text.slice(0, 160),
          participants: to, from_name: outgoing.from.name, from_email: account.email, last_message_at: new Date().toISOString(),
          last_outbound_at: new Date().toISOString(), message_count: 0, is_read: true,
        }).select('id').single()
        threadId = t!.id
      }
      const { data: m } = await admin.from('mail_messages').insert({
        thread_id: threadId, account_id: account.id, agency_id: account.agency_id,
        provider_message_id: r.providerMessageId ?? `pending:${messageId}`, rfc822_message_id: messageId, in_reply_to: outgoing.inReplyTo,
        direction: 'outbound', from_name: outgoing.from.name, from_email: account.email, to, cc, bcc, subject,
        snippet: text.slice(0, 160), body_text: fullText, body_html: fullHtml, sent_at: new Date().toISOString(), is_read: true, has_attachments: outAtts.length > 0,
      }).select('id').single()
      localMessageId = m?.id ?? null
      await recomputeThread(admin, threadId)
    }
```
Le `getValidAccessToken` du haut de la fonction devient conditionnel (`if (account.provider !== 'imap')`).

- [ ] **Step 5 : `mail-attachment` — branche `imap` dans `fetchBytes`**

```ts
  if (a.account.provider === 'imap') return imapAttachment(admin, a.account, a.providerMessageId, Number(a.att.provider_attachment_id))
```
(avant la lecture du jeton OAuth, qui n'existe pas pour `imap`).

- [ ] **Step 6 : Vérifier et committer**

```bash
deno check supabase/functions/mail-oauth/index.ts supabase/functions/mail-sync/index.ts supabase/functions/mail-actions/index.ts supabase/functions/mail-send/index.ts supabase/functions/mail-attachment/index.ts
npm run lint:edge-auth
git add -A supabase/functions
git commit -m "feat(messagerie): connexion IMAP (connect_imap) et branche imap dans sync, actions, envoi, pièces"
```

---

### Task 3.7 : Front — l'étape IMAP devient vivante

**Files:**
- Modify: `src/components/crm/messagerie/MailAddAccountModal.tsx` (lot 2)
- Modify: `src/hooks/useMailAccounts.ts` (lot 2)
- Modify: `src/i18n/locales/{fr,de,en,it}/messages.json`

- [ ] **Step 1 : Retirer le verrou « bientôt » posé au lot 2**

Dans `MailAddAccountModal.tsx`, l'étape IMAP appelait déjà `connectImap(form)` et affichait `t('mail.add.imap.unavailable')` sur l'erreur `unknown_action`. Retirer ce cas particulier : l'erreur affichée devient celle du serveur, traduite par clé :

```ts
const IMAP_ERRORS: Record<string, string> = {
  invalid_input: 'mail.add.imap.err.invalid',
  starttls_unsupported: 'mail.add.imap.err.starttls',
  connection_failed: 'mail.add.imap.err.connection',
}
// …
setError(t(IMAP_ERRORS[res.error] ?? 'mail.add.imap.err.generic'))
```

- [ ] **Step 2 : Clés i18n (4 langues, sans tiret cadratin)**

`fr/messages.json` → `mail.add.imap.err` :
```json
"err": {
  "invalid": "Adresse, serveurs et mot de passe sont requis.",
  "starttls": "STARTTLS (port 587) n'est pas disponible depuis nos serveurs. Utilisez SSL/TLS sur le port 465.",
  "connection": "Connexion refusée : vérifiez l'identifiant, le mot de passe (ou mot de passe d'application) et les serveurs.",
  "generic": "La connexion a échoué. Réessayez dans un instant."
}
```
`en` : "Address, servers and password are required." · "STARTTLS (port 587) is not available from our servers. Use SSL/TLS on port 465." · "Connection refused: check the login, the password (or app password) and the servers." · "The connection failed. Try again in a moment."
`de` : "Adresse, Server und Passwort sind erforderlich." · "STARTTLS (Port 587) ist von unseren Servern aus nicht verfügbar. Verwenden Sie SSL/TLS auf Port 465." · "Verbindung abgelehnt: Prüfen Sie Benutzername, Passwort (oder App-Passwort) und Server." · "Die Verbindung ist fehlgeschlagen. Versuchen Sie es gleich noch einmal."
`it` : "Indirizzo, server e password sono obbligatori." · "STARTTLS (porta 587) non è disponibile dai nostri server. Usa SSL/TLS sulla porta 465." · "Connessione rifiutata: verifica utente, password (o password per app) e server." · "La connessione non è riuscita. Riprova tra un istante."

- [ ] **Step 3 : Portes et commit**

```bash
npm run lint:i18n && npm run i18n:parity:ci && npm run lint:prose && npm run build
git add -A
git commit -m "feat(messagerie): l'étape IMAP de l'assistant se connecte (Infomaniak, Bluewin, autre boîte)"
```

---

### Task 3.8 : Épreuve de bout en bout IMAP

- [ ] Sur une boîte Infomaniak de test (jamais une boîte cliente) : ajouter en IMAP → « Boîte connectée » → 90 jours importés en ≤ 3 ticks → s'envoyer un mail → visible < 2 min → répondre depuis le CRM → la réponse est dans « Envoyés » du webmail Infomaniak (APPEND) et chez le destinataire avec `In-Reply-To` → marquer lu/étoile dans le webmail → reflété au tick suivant → archiver depuis le CRM → le message est dans « Archive » du webmail.
- [ ] Bluewin : mêmes points 1-3 (les autres suivent la même mécanique).
- [ ] Consigner durées et écarts dans la PR.

---

### Task 3.9 : Retrait du spike, cerveau

**Files:**
- Delete: `supabase/functions/mail-imap-probe/`
- Modify: `supabase/config.toml`, `src/lib/edgeFunctionRoster.ts`, `.claude-flow/knowledge/megga-memory.seed.json`, `docs/system-map.md`

- [ ] **Step 1 : Retirer la sonde du dépôt et de Supabase**

```bash
git rm -r supabase/functions/mail-imap-probe
# retirer le bloc [functions.mail-imap-probe] de supabase/config.toml
node scripts/check-edge-roster.mjs --write
git commit -am "chore(messagerie): retrait de la sonde TLS du lot 3"
```
Après merge, purger la fonction déployée (le déploiement ne supprime jamais, cf. system-map §8) :
```bash
gh workflow run purge-orphan-functions.yml -f slugs="mail-imap-probe" -f confirm=SUPPRIMER
```

- [ ] **Step 2 : Cerveau** — clé `megga/messagerie-imap` : le verdict du spike (avec les ms mesurés), le port 587 bloqué, `postal-mime` et l'alias vitest, le curseur `dossier:uidValidity:uid`, la non-détection des suppressions ; puis `npm run ruflo:seed`.

**Si le spike de T3.1 a ÉCHOUÉ** : ne faire que ce Step 2 avec la clé `megga/messagerie-imap-abandon` (l'erreur exacte de `Deno.connectTls`, la date), retirer la sonde (Step 1), et écrire dans le maître §9 : « IMAP hors edge : voie = Cloudflare Worker `cloudflare:sockets` (TCP + TLS, port 587 autorisé), à planifier à part ». Les lignes Infomaniak / Bluewin / Autre boîte de l'assistant affichent alors `mail.add.imap.unavailable` (déjà présent au lot 2).
