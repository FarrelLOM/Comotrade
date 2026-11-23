import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { buildCloudinarySignature } from '@/lib/cloudinary.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = String(formData.get('folder') || 'comotrade/products').trim() || 'comotrade/products';

    if (!(file instanceof Blob) || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Pilih file gambar yang valid terlebih dahulu.' }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary belum dikonfigurasi pada server.' }, { status: 500 });
    }

    const originalName = (file.name || 'product-image').replace(/\.[^/.]+$/, '');
    const publicId = `${Date.now()}-${randomUUID().slice(0, 8)}-${originalName}`
      .replace(/[^a-zA-Z0-9-_./]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 200);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = buildCloudinarySignature({ timestamp, folder, publicId, apiSecret });

    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('api_key', apiKey);
    uploadData.append('timestamp', String(timestamp));
    uploadData.append('signature', signature);
    uploadData.append('folder', folder);
    uploadData.append('public_id', publicId);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: uploadData,
    });
    const payload = await response.json();
    if (!response.ok || !payload?.secure_url) {
      console.error('Cloudinary upload failed:', payload);
      return NextResponse.json({ error: payload?.error?.message || 'Upload media ke Cloudinary gagal.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      url: payload.secure_url || payload.url,
      publicId,
      format: payload.format,
    });
  } catch (error) {
    console.error('Media upload failed:', error?.message);
    return NextResponse.json({ error: 'Media produk belum dapat diunggah.' }, { status: 500 });
  }
}
