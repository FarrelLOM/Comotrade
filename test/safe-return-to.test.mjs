import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnTo } from '../lib/safe-return-to.mjs';

test('returnTo mempertahankan path akun internal', () => {
  assert.equal(safeReturnTo('/account/profile'), '/account/profile');
  assert.equal(safeReturnTo('/checkout?from=cart'), '/checkout?from=cart');
});

test('returnTo menolak URL eksternal dan format path berbahaya', () => {
  assert.equal(safeReturnTo('https://attacker.example'), '/');
  assert.equal(safeReturnTo('//attacker.example'), '/');
  assert.equal(safeReturnTo('/\\attacker.example'), '/');
  assert.equal(safeReturnTo('/\\/attacker.example'), '/');
});
