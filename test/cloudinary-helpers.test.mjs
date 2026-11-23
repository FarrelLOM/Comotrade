import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCloudinarySignature, isValidCloudinaryOrLocalUrl } from '../lib/cloudinary.mjs';

test('Cloudinary signature menandatangani folder, public_id, dan timestamp dalam urutan yang konsisten', () => {
  const signature = buildCloudinarySignature({
    timestamp: 1718800000,
    folder: 'comotrade/products',
    publicId: 'slug-abc',
    apiSecret: 'secret-test',
  });

  assert.equal(signature, '13f832d6eba09e307d9458b75d049f261f13ee4f');
});

test('URL gambar lokal dan Cloudinary diizinkan untuk produk', () => {
  assert.equal(isValidCloudinaryOrLocalUrl('/Pictures/asset/example.png'), true);
  assert.equal(isValidCloudinaryOrLocalUrl('https://res.cloudinary.com/demo/image/upload/v123/folder/image.jpg'), true);
  assert.equal(isValidCloudinaryOrLocalUrl('ftp://example.com/image.jpg'), false);
});
