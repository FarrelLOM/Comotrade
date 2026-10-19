import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const { rows } = await query(
      `SELECT c.id,c.user_id,c.order_id,c.subject,c.created_at,u.full_name AS customer_name,
       COALESCE(json_agg(json_build_object('id',m.id,'sender_id',m.sender_id,'body',m.body,'created_at',m.created_at) ORDER BY m.created_at)
       FILTER (WHERE m.id IS NOT NULL),'[]') AS messages
       FROM conversations c JOIN users u ON u.id=c.user_id LEFT JOIN messages m ON m.conversation_id=c.id
       ${user.role === 'admin' ? '' : 'WHERE c.user_id=$1'}
       GROUP BY c.id,u.full_name ORDER BY c.created_at DESC LIMIT 300`,
      user.role === 'admin' ? [] : [user.id],
    );
    return NextResponse.json({ conversations: rows });
  } catch (error) {
    console.error('Conversation listing failed:', error?.message);
    return NextResponse.json({ error: 'Pesan belum tersedia.' }, { status: 503 });
  }
}

export async function POST(request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const input = await request.json();
    const body = String(input.body || '').trim();
    const conversationId = input.conversationId ? String(input.conversationId) : null;
    const orderId = input.orderId ? String(input.orderId) : null;
    if (!body || body.length > 5000) return NextResponse.json({ error: 'Pesan harus 1–5000 karakter.' }, { status: 400 });

    const result = await withTransaction(async (client) => {
      let conversation;
      if (conversationId) {
        const { rows } = await client.query(
          `SELECT id,user_id,order_id FROM conversations WHERE id=$1 AND ($2::boolean OR user_id=$3) FOR UPDATE`,
          [conversationId, user.role === 'admin', user.id],
        );
        conversation = rows[0];
        if (!conversation) return null;
      } else {
        if (user.role === 'admin') throw Object.assign(new Error('Admin harus membalas percakapan yang sudah ada.'), { status: 400 });
        if (orderId) {
          const { rowCount } = await client.query('SELECT id FROM orders WHERE id=$1 AND user_id=$2', [orderId, user.id]);
          if (!rowCount) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
        }
        const { rows } = await client.query(
          'INSERT INTO conversations (user_id,order_id,subject) VALUES ($1,$2,$3) RETURNING id,user_id,order_id',
          [user.id, orderId, String(input.subject || (orderId ? 'Pertanyaan pesanan' : 'Customer support')).slice(0, 200)],
        );
        conversation = rows[0];
      }
      const { rows } = await client.query(
        'INSERT INTO messages (conversation_id,sender_id,body) VALUES ($1,$2,$3) RETURNING id,conversation_id,sender_id,body,created_at',
        [conversation.id, user.id, body],
      );
      return rows[0];
    });
    if (!result) return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ message: result }, { status: 201 });
  } catch (error) {
    console.error('Message creation failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Pesan belum dapat dikirim.' }, { status: error?.status || 500 });
  }
}
