const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class JubelioError extends Error {
  constructor(message, { endpoint, code = 'JUBELIO_ERROR', httpStatus, causeCode, outcomeUnknown = false, message: safeMessage } = {}) {
    super(safeMessage || message);
    this.name = 'JubelioError';
    this.endpoint = endpoint;
    this.code = code;
    this.httpStatus = httpStatus;
    this.causeCode = causeCode;
    this.outcomeUnknown = outcomeUnknown;
  }
}

export class JubelioClient {
  constructor({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), wait = sleep } = {}) {
    this.env = env;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.wait = wait;
    this.token = null;
    this.expiresAt = 0;
    this.inflight = null;
    this.timeoutMs = Number(env.JUBELIO_TIMEOUT_MS) || 15000;
    this.baseUrl = (String(env.JUBELIO_BASE_URL || 'https://api-shipment.sandbox.jubelio.com').trim()).replace(/\/+$/, '');
    this.authScheme = String(env.JUBELIO_AUTH_SCHEME || 'bearer').trim().toLowerCase() === 'raw' ? 'raw' : 'bearer';
  }

  invalidateToken() {
    this.token = null;
    this.expiresAt = 0;
  }

  async getToken() {
    if (this.token && this.now() < this.expiresAt - 60_000) return this.token;
    if (!this.inflight) {
      this.inflight = this.refreshToken().finally(() => { this.inflight = null; });
    }
    return this.inflight;
  }

  async refreshToken() {
    const clientId = String(this.env.JUBELIO_CLIENT_ID || '').trim();
    const clientSecret = String(this.env.JUBELIO_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
      throw new JubelioError('Kredensial Jubelio belum dikonfigurasi.', { endpoint: 'POST /auth/generate-token', code: 'JUBELIO_CREDENTIALS_MISSING' });
    }

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/auth/generate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: 'no-store',
      });
    } catch (error) {
      const causeCode = String(error?.cause?.code || error?.code || '').match(/^[A-Z0-9_]+$/)?.[0] || '';
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      const safeReason = timedOut
        ? 'waktu koneksi habis'
        : causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN'
          ? 'alamat host API tidak dapat ditemukan'
          : causeCode
            ? `koneksi gagal (${causeCode})`
            : 'koneksi gagal';
      throw new JubelioError(`Tidak dapat memperoleh token Jubelio: ${safeReason}. Periksa jaringan server dan JUBELIO_BASE_URL.`, {
        endpoint: 'POST /auth/generate-token',
        code: timedOut ? 'JUBELIO_TIMEOUT' : 'JUBELIO_NETWORK',
        causeCode: causeCode || undefined,
      });
    }

    let responseText = '';
    try { responseText = await response.text(); } catch {}
    let body = null;
    try { body = responseText ? JSON.parse(responseText) : null; } catch {}
    if (!response.ok) {
      const providerMessage = String(body?.message || body?.error || `HTTP ${response.status}`)
        .replaceAll(clientSecret, '[redacted]')
        .replaceAll(clientId, '[redacted]')
        .slice(0, 180);
      throw new JubelioError('Jubelio menolak permintaan token.', {
        endpoint: 'POST /auth/generate-token',
        code: 'JUBELIO_TOKEN_REJECTED',
        httpStatus: response.status,
        message: `Jubelio menolak permintaan token (HTTP ${response.status}: ${providerMessage}). Pastikan JUBELIO_BASE_URL sesuai dengan environment kredensial (sandbox atau production).`,
      });
    }
    if (typeof body?.token !== 'string' || !body.token.trim()) {
      throw new JubelioError('Jubelio merespons permintaan token dengan format yang tidak dikenal.', {
        endpoint: 'POST /auth/generate-token',
        code: 'JUBELIO_TOKEN_INVALID_RESPONSE',
        httpStatus: response.status,
      });
    }
    const expiresIn = Number(body.expires_in);
    this.token = body.token.trim();
    this.expiresAt = this.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000;
    return this.token;
  }

  async request(method, path, { body, query = {} } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const isRead = method === 'GET';
    const safeToRetry = isRead || (body !== undefined && (path === '/rates' || path === '/rates/all'));
    let attempt = 0;
    let authRetried = false;

    while (true) {
      const token = await this.getToken();
      let response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: this.authScheme === 'raw' ? token : `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(this.timeoutMs),
          cache: 'no-store',
        });
      } catch (error) {
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        const retryable = safeToRetry && attempt < 2;
        if (retryable) {
          await this.wait(300 * 2 ** attempt++);
          continue;
        }
        throw new JubelioError(timedOut ? 'Permintaan Jubelio timeout.' : 'Tidak dapat terhubung ke Jubelio.', {
          endpoint: `${method} ${path}`,
          code: timedOut ? 'JUBELIO_TIMEOUT' : 'JUBELIO_NETWORK',
          outcomeUnknown: !isRead,
        });
      }

      if (response.status === 401 && !authRetried) {
        authRetried = true;
        this.invalidateToken();
        continue;
      }

      let data;
      try { data = await response.json(); } catch { data = null; }
      if (response.ok) return data;

      if (safeToRetry && response.status >= 500 && attempt < 2) {
        await this.wait(300 * 2 ** attempt++);
        continue;
      }
      const providerMessage = String(data?.message || data?.error || `HTTP ${response.status}`).slice(0, 300);
      throw new JubelioError(`Jubelio: ${providerMessage}`, {
        endpoint: `${method} ${path}`,
        httpStatus: response.status,
        outcomeUnknown: false,
      });
    }
  }

  getRegions(name) { return this.request('GET', '/regions', { query: { name } }); }
  getRates(payload) { return this.request('POST', '/rates/all', { body: payload }); }
  getRatesByCategory(payload) { return this.request('POST', '/rates', { body: payload }); }
  createShipment(payload) { return this.request('POST', '/shipments/create', { body: payload }); }
  cancelShipment({ awbCode, reason }) {
    return this.request('POST', '/shipments/cancel', { body: { awb_code: awbCode, cancel_reason: reason } });
  }
  getShipment(awb) { return this.request('GET', `/shipments/awb/${encodeURIComponent(awb)}`); }
}
