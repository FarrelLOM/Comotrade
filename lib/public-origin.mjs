export function isLoopbackOrigin(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');
  } catch {
    return true;
  }
}

function parseHttpOrigin(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicOrigin(request, env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configuredOrigin = env.APP_URL ? parseHttpOrigin(env.APP_URL) : null;

  let requestOrigin = null;
  try {
    requestOrigin = parseHttpOrigin(new URL(request.url).origin);
  } catch {}

  const forwardedHost = request.headers?.get?.('x-forwarded-host');
  const forwardedProtocol = request.headers?.get?.('x-forwarded-proto');
  const behindProxy = Boolean(forwardedHost && forwardedProtocol);

  if (requestOrigin && isLoopbackOrigin(requestOrigin) && (!production || !behindProxy)) {
    return requestOrigin;
  }

  if (requestOrigin && !isLoopbackOrigin(requestOrigin)) {
    if (production && !requestOrigin.startsWith('https://')) {
      if (!configuredOrigin || !configuredOrigin.startsWith('https://') || isLoopbackOrigin(configuredOrigin)) {
        throw new Error('APP_URL harus berupa origin HTTPS publik pada production.');
      }
    } else {
      return requestOrigin;
    }
  }

  if (configuredOrigin && !isLoopbackOrigin(configuredOrigin)) {
    if (production && !configuredOrigin.startsWith('https://')) {
      throw new Error('APP_URL harus menggunakan HTTPS pada production.');
    }
    return configuredOrigin;
  }

  if (production) {
    throw new Error('APP_URL harus berupa origin HTTPS publik pada production.');
  }

  if (configuredOrigin) return configuredOrigin;
  throw new Error('Origin aplikasi development tidak dapat ditentukan.');
}

export function getPublicAppUrl(pathname, request, env = process.env) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\')) {
    throw new Error('Path tujuan aplikasi tidak valid.');
  }
  return new URL(pathname, getPublicOrigin(request, env)).toString();
}

export function getPublicCallbackUrl({ configuredUrl, pathname, request, env = process.env }) {
  const origin = getPublicOrigin(request, env);
  const configured = configuredUrl ? parseHttpOrigin(configuredUrl) : null;
  const configuredPath = (() => { try { return new URL(configuredUrl).pathname; } catch { return ''; } })();
  if (configured && configured === origin && configuredPath === pathname) return new URL(configuredUrl).toString();
  return new URL(pathname, origin).toString();
}
