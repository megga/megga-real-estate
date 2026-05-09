// Rockwell Properties — Password gate (page custom)
// Cloudflare Pages middleware : intercepte chaque requête, sert une page custom
// "Entrer le mot de passe" si la session n'est pas valide.
//
// Mot de passe hardcodé ci-dessous (DEFAULT_PASSWORD).
// Override possible via la var d'env Cloudflare Pages :
//   Settings → Environment variables → Production → ROCKWELL_AUTH_PASSWORD
// Si la var est définie, elle écrase le default.
// Pour désactiver la protection : supprimer ce fichier.

const DEFAULT_PASSWORD = "rockwell2026";
const COOKIE_NAME = "rockwell_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export const onRequest = async (context) => {
  const { request, env, next } = context;
  const expectedPass = env.ROCKWELL_AUTH_PASSWORD || DEFAULT_PASSWORD;

  const url = new URL(request.url);
  const expectedHash = await sha256(expectedPass);

  // Endpoint POST /__auth pour valider le mot de passe
  if (url.pathname === "/__auth" && request.method === "POST") {
    const form = await request.formData();
    const submitted = String(form.get("password") || "");
    if (submitted === expectedPass) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": `${COOKIE_NAME}=${expectedHash}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
          "Cache-Control": "no-store",
        },
      });
    }
    return gatePage({ error: "Mot de passe incorrect" });
  }

  // Cookie déjà valide → laisse passer
  const cookie = request.headers.get("Cookie") || "";
  const cookieValue = parseCookie(cookie, COOKIE_NAME);
  if (cookieValue && timingSafeEqual(cookieValue, expectedHash)) {
    return next();
  }

  // Sinon → page custom de saisie
  return gatePage({});
};

// ─── Utilitaires ─────────────────────────────────────────────────

function parseCookie(header, name) {
  const parts = header.split(";");
  for (const p of parts) {
    const [k, v] = p.trim().split("=");
    if (k === name) return v;
  }
  return null;
}

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function gatePage({ error }) {
  const errorHtml = error
    ? `<p class="error">${escapeHtml(error)}</p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<title>Rockwell Properties — Accès privé</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    background: #FAFAFA;
    color: #0B0C0E;
    display: grid;
    place-items: center;
    padding: 24px;
    -webkit-font-smoothing: antialiased;
  }
  .gate {
    width: 100%;
    max-width: 380px;
    text-align: center;
  }
  .brand {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.32em;
    color: #0B0C0E;
    text-transform: uppercase;
    margin-bottom: 48px;
  }
  h1 {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.4px;
    margin-bottom: 10px;
  }
  .sub {
    font-size: 13.5px;
    color: #6B6F76;
    line-height: 1.55;
    margin-bottom: 32px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  input[type="password"] {
    height: 52px;
    padding: 0 18px;
    border: 1px solid #E4E4E7;
    border-radius: 10px;
    background: #FFFFFF;
    font-size: 15px;
    font-family: inherit;
    color: #0B0C0E;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input[type="password"]:focus {
    border-color: #0B0C0E;
    box-shadow: 0 0 0 3px rgba(11,12,14,0.08);
  }
  button {
    height: 52px;
    border: 0;
    border-radius: 10px;
    background: #0B0C0E;
    color: #FFFFFF;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.2px;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
  }
  button:hover { opacity: 0.92; transform: translateY(-1px); }
  button:active { transform: translateY(0); }
  .error {
    margin-top: 12px;
    color: #B91C1C;
    font-size: 13px;
    font-weight: 500;
  }
  .footer {
    margin-top: 56px;
    font-size: 11px;
    color: #9CA0AB;
    letter-spacing: 0.04em;
  }
</style>
</head>
<body>
  <main class="gate">
    <div class="brand">Rockwell Properties</div>
    <h1>Accès privé</h1>
    <p class="sub">Cette page est protégée. Entrez le mot de passe pour continuer.</p>
    <form method="POST" action="/__auth" autocomplete="off">
      <input type="password" name="password" placeholder="Mot de passe" autofocus required>
      <button type="submit">Entrer</button>
    </form>
    ${errorHtml}
    <div class="footer">© 2026 Rockwell Properties</div>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
