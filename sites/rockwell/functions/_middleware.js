// Rockwell Properties — HTTP Basic Auth gate
// Cloudflare Pages middleware : intercepte chaque requête, exige les credentials.
//
// Configuration : définir les variables d'environnement dans le dashboard Cloudflare Pages
//   Settings → Environment variables → Production
//   ROCKWELL_AUTH_USER     (ex: "rockwell")
//   ROCKWELL_AUTH_PASSWORD (ex: générer un mot de passe long)
//
// Si les vars ne sont pas définies, le site reste public (no-op).
// Pour désactiver la protection : supprimer les vars OU supprimer ce fichier.

export const onRequest = async (context) => {
  const { request, env, next } = context;
  const expectedUser = env.ROCKWELL_AUTH_USER;
  const expectedPass = env.ROCKWELL_AUTH_PASSWORD;

  // Pas de credentials configurés → site ouvert (fallback safe).
  if (!expectedUser || !expectedPass) {
    return next();
  }

  const auth = request.headers.get("Authorization");
  if (auth && auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const idx = decoded.indexOf(":");
      const user = idx >= 0 ? decoded.slice(0, idx) : decoded;
      const pass = idx >= 0 ? decoded.slice(idx + 1) : "";
      if (user === expectedUser && timingSafeEqual(pass, expectedPass)) {
        return next();
      }
    } catch {
      // Header malformé → 401 ci-dessous
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Rockwell Properties", charset="UTF-8"',
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};

// Comparaison constante en temps pour limiter le timing attack
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
