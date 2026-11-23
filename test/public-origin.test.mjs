import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicAppUrl, getPublicCallbackUrl, getPublicOrigin } from '../lib/public-origin.mjs';

function request(url, headers = {}) {
  return { url, headers: new Headers(headers) };
}

test('production memakai APP_URL kanonis dan mengabaikan host proxy yang berbeda', () => {
  const req = request('http://internal-node:3000/api/auth/google', {
    host: 'internal-node:3000',
    'x-forwarded-host': 'attacker.example',
    'x-forwarded-proto': 'http',
  });

  test('production memakai origin HTTPS request jika APP_URL tidak disetel', () => {
    const req = request('https://shop.example.com/api/auth/google');
    assert.equal(getPublicOrigin(req, { NODE_ENV: 'production' }), 'https://shop.example.com');
  });
  assert.equal(getPublicOrigin(req, { NODE_ENV: 'production', APP_URL: 'https://shop.example.com' }), 'https://shop.example.com');
});

test('localhost yang sedang dipakai tidak dialihkan ke APP_URL publik di development', () => {
  const req = request('http://localhost:3000/api/auth/google', { host: 'localhost:3000' });
  assert.equal(getPublicOrigin(req, { NODE_ENV: 'development', APP_URL: 'https://shop.example.com' }), 'http://localhost:3000');
});

test('localhost tetap menjadi origin tujuan saat server lokal memakai mode production', () => {
  const req = request('http://localhost:3001/api/auth/login');
  assert.equal(getPublicOrigin(req, { NODE_ENV: 'production', APP_URL: 'https://shop.example.com' }), 'http://localhost:3001');
});

test('development menggunakan host dan port yang dibuka saat APP_URL lokal', () => {
  const req = request('http://localhost:3001/api/auth/google', { host: 'localhost:3001' });
  assert.equal(getPublicOrigin(req, { NODE_ENV: 'development', APP_URL: 'http://localhost:3000' }), 'http://localhost:3001');
});

test('development memakai origin request bila APP_URL tidak ada', () => {
  const req = request('http://127.0.0.1:3001/api/auth/google');
  assert.equal(getPublicOrigin(req, { NODE_ENV: 'development' }), 'http://127.0.0.1:3001');
});

test('URL selesai login menggunakan domain APP_URL pada production', () => {
  const req = request('http://next-internal:3000/api/auth/login');
  assert.equal(getPublicAppUrl('/', req, { NODE_ENV: 'production', APP_URL: 'https://shop.example.com' }), 'https://shop.example.com/');
});

test('URL selesai login tetap pada host dan port yang dipakai development', () => {
  const req = request('http://localhost:3001/api/auth/login');
  assert.equal(getPublicAppUrl('/', req, { NODE_ENV: 'development', APP_URL: 'http://localhost:3000' }), 'http://localhost:3001/');
});

test('URL tujuan tidak menerima path eksternal', () => {
  const req = request('http://localhost:3000/api/auth/login');
  assert.throws(() => getPublicAppUrl('//attacker.example', req, { NODE_ENV: 'development' }), /Path tujuan/);
});

test('callback Google selalu memakai path callback dan origin publik', () => {
  const req = request('http://internal-node:3000/api/auth/google', {
    host: 'internal-node:3000',
    'x-forwarded-host': 'shop.example.com',
    'x-forwarded-proto': 'https',
  });
  assert.equal(getPublicCallbackUrl({
    configuredUrl: 'https://shop.example.com/api/auth/google/callback',
    pathname: '/api/auth/google/callback',
    request: req,
    env: { NODE_ENV: 'production', APP_URL: 'https://shop.example.com' },
  }), 'https://shop.example.com/api/auth/google/callback');
});

test('production menolak APP_URL localhost meskipun ada forwarded host', () => {
  const req = request('http://localhost:3000/api/auth/google', {
    host: 'localhost:3000',
    'x-forwarded-host': 'shop.example.com',
    'x-forwarded-proto': 'https',
  });
  assert.throws(() => getPublicOrigin(req, { NODE_ENV: 'production', APP_URL: 'http://localhost:3000' }), /APP_URL/);
});

test('production gagal tertutup bila APP_URL publik tidak dikonfigurasi', () => {
  const req = request('http://internal-node:3000/api/auth/google', { 'x-forwarded-host': 'shop.example.com' });
  assert.throws(() => getPublicOrigin(req, { NODE_ENV: 'production' }), /APP_URL/);
});
