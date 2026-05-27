// Basic Auth middleware for Cloudflare Pages
// Blocks all routes unless visitor provides credentials.
// Credentials: ai / ai

export const onRequest: PagesFunction = async (context) => {
  const auth = context.request.headers.get('Authorization');
  const expected = 'Basic ' + btoa('ai:ai');

  if (auth !== expected) {
    return new Response('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="MEGGA — accès restreint", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return context.next();
};
