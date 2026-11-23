import test from 'node:test';
import assert from 'node:assert/strict';
import { JubelioClient } from '../lib/jubelio-client-core.mjs';

const response = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const env = {
  JUBELIO_BASE_URL: 'http://mock.local',
  JUBELIO_CLIENT_ID: 'test-client',
  JUBELIO_CLIENT_SECRET: 'test-secret',
};

test('create shipment POST tidak diulang setelah gangguan jaringan dan outcome ditandai UNKNOWN', async () => {
  let createCalls = 0;
  const client = new JubelioClient({ env, wait: async () => {}, fetchImpl: async (url, init) => {
    if (String(url).endsWith('/auth/generate-token')) return response(200, { token: 'token-1', expires_in: 3600 });
    assert.equal(init.method, 'POST');
    createCalls += 1;
    throw new TypeError('connection reset');
  } });

  await assert.rejects(client.createShipment({ ref_no: 'order-1' }), (error) => error.outcomeUnknown && error.code === 'JUBELIO_NETWORK');
  assert.equal(createCalls, 1);
});

test('GET boleh retry maksimal dua kali dengan backoff', async () => {
  let readCalls = 0;
  const waits = [];
  const client = new JubelioClient({ env, wait: async (duration) => waits.push(duration), fetchImpl: async (url) => {
    if (String(url).endsWith('/auth/generate-token')) return response(200, { token: 'token-1', expires_in: 3600 });
    readCalls += 1;
    if (readCalls < 3) throw new TypeError('temporary network error');
    return response(200, [{ area_id: '3174011001' }]);
  } });

  const regions = await client.getRegions('Tebet');
  assert.equal(regions[0].area_id, '3174011001');
  assert.equal(readCalls, 3);
  assert.deepEqual(waits, [300, 600]);
});

test('401 memperbarui token lalu mengulang satu kali', async () => {
  let tokenCalls = 0;
  let requestCalls = 0;
  const client = new JubelioClient({ env, wait: async () => {}, fetchImpl: async (url) => {
    if (String(url).endsWith('/auth/generate-token')) return response(200, { token: `token-${++tokenCalls}`, expires_in: 3600 });
    requestCalls += 1;
    return requestCalls === 1 ? response(401, { message: 'expired' }) : response(200, []);
  } });

  assert.deepEqual(await client.getRegions('Tebet'), []);
  assert.equal(tokenCalls, 2);
  assert.equal(requestCalls, 2);
});

test('Authorization mendukung format bearer bawaan dan raw dari environment', async () => {
  const headersSeen = [];
  const client = new JubelioClient({
    env: { ...env, JUBELIO_AUTH_SCHEME: 'raw' },
    fetchImpl: async (url, init) => {
      if (String(url).endsWith('/auth/generate-token')) return response(200, { token: 'raw-token', expires_in: 3600 });
      headersSeen.push(init.headers.Authorization);
      return response(200, []);
    },
  });

  await client.getRegions('Tebet');
  assert.deepEqual(headersSeen, ['raw-token']);
});

test('request tarif POST aman diulang untuk gangguan jaringan', async () => {
  let rateCalls = 0;
  const waits = [];
  const client = new JubelioClient({ env, wait: async (duration) => waits.push(duration), fetchImpl: async (url) => {
    if (String(url).endsWith('/auth/generate-token')) return response(200, { token: 'token-1', expires_in: 3600 });
    rateCalls += 1;
    if (rateCalls < 3) throw new TypeError('temporary network error');
    return response(200, []);
  } });

  await client.getRates({ weight: 1000 });
  assert.equal(rateCalls, 3);
  assert.deepEqual(waits, [300, 600]);
});

test('kredensial dengan spasi salinan dibersihkan sebelum meminta token', async () => {
  let tokenBody;
  const client = new JubelioClient({
    env: { ...env, JUBELIO_CLIENT_ID: ' test-client ', JUBELIO_CLIENT_SECRET: ' test-secret ' },
    fetchImpl: async (_url, init) => {
      tokenBody = JSON.parse(init.body);
      return response(200, { token: 'token-1', expires_in: 3600 });
    },
  });
  assert.equal(await client.getToken(), 'token-1');
  assert.deepEqual(tokenBody, { client_id: 'test-client', client_secret: 'test-secret' });
});

test('penolakan token menyertakan alasan provider tanpa membocorkan kredensial', async () => {
  const client = new JubelioClient({
    env,
    fetchImpl: async () => response(401, { message: 'invalid client test-client test-secret' }),
  });
  await assert.rejects(client.getToken(), (error) => {
    assert.equal(error.code, 'JUBELIO_TOKEN_REJECTED');
    assert.equal(error.httpStatus, 401);
    assert.match(error.message, /HTTP 401/);
    assert.match(error.message, /sandbox atau production/);
    assert.doesNotMatch(error.message, /test-client|test-secret/);
    return true;
  });
});

test('gagal DNS token memberi diagnosis aman tanpa menampilkan credential', async () => {
  const client = new JubelioClient({
    env,
    fetchImpl: async () => {
      const error = new TypeError('fetch failed');
      error.cause = Object.assign(new Error('getaddrinfo ENOTFOUND example.invalid'), { code: 'ENOTFOUND' });
      throw error;
    },
  });
  await assert.rejects(client.getToken(), (error) => {
    assert.equal(error.code, 'JUBELIO_NETWORK');
    assert.equal(error.causeCode, 'ENOTFOUND');
    assert.match(error.message, /host API tidak dapat ditemukan/);
    assert.doesNotMatch(error.message, /test-client|test-secret/);
    return true;
  });
});
