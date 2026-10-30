// JINYA review access. Set DASHBOARD_PASSWORD as an encrypted Cloudflare
// Pages secret in BOTH Production and Preview before deploying.
// Username: jinya. No password belongs in this file or in GitHub.
// Also set Settings > Runtime > Fail open / closed to FAIL CLOSED.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const username = 'jinya';

function protectHeaders(headers) {
  headers.set('Cache-Control', 'private, no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('X-Jinya-Auth-Version', '2');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  const vary = headers.get('Vary');
  headers.set('Vary', vary ? vary + ', Authorization' : 'Authorization');
  return headers;
}

function message(text, status, extra = {}) {
  return new Response(text, {
    status,
    headers: protectHeaders(new Headers({
      'Content-Type': 'text/plain; charset=utf-8',
      ...extra,
    })),
  });
}

function readCredentials(request) {
  const header = request.headers.get('Authorization') || '';
  if (header.length > 4096) return null;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]), c => c.charCodeAt(0));
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

async function credentialsMatch(candidate, expected) {
  // Web Crypto verifies the MAC instead of comparing password strings.
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(expected),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(expected));
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(candidate));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:') {
      url.protocol = 'https:';
      return message('Use HTTPS.', 308, { Location: url.href });
    }
    const password = env.DASHBOARD_PASSWORD;
    if (typeof password !== 'string' || password.length === 0) {
      return message('Dashboard setup error: DASHBOARD_PASSWORD is missing from this deployment. Set the secret for the Production environment of this Pages project, save it, and create a new deployment.', 503);
    }
    if (password.length < 16) {
      return message('Dashboard setup error: DASHBOARD_PASSWORD was received, but it is shorter than the required 16 characters. Save a new password of at least 16 characters and create a new deployment.', 503);
    }
    try {
      const credentials = readCredentials(request);
      if (credentials === null || !await credentialsMatch(credentials, username + ':' + password)) {
        return message('Sign in to view the JINYA dashboard.', 401, {
          'WWW-Authenticate': 'Basic realm="JINYA Dashboard", charset="UTF-8"',
        });
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        return message('This dashboard is read-only.', 405, { Allow: 'GET, HEAD' });
      }
      const assetRequest = new Request(request);
      assetRequest.headers.delete('Authorization');
      const asset = await env.ASSETS.fetch(assetRequest);
      return new Response(asset.body, {
        status: asset.status,
        statusText: asset.statusText,
        headers: protectHeaders(new Headers(asset.headers)),
      });
    } catch {
      // Never serve static files when authentication or asset serving fails.
      return message('Dashboard temporarily unavailable. Please try again later.', 503);
    }
  },
};
