import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export const runtime = 'nodejs';

function parseMessages(messages) {
  return typeof messages === 'string' ? JSON.parse(messages) : messages || [];
}

export async function GET(request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Login diperlukan.' }, { status: 401 });
  try {
    const unreadSince = new URL(request.url).searchParams.get('unreadSince');
    if (unreadSince) {
      if (user.role === 'admin') return NextResponse.json({ unread: 0 });
      const since = new Date(unreadSince);
      if (Number.isNaN(since.getTime())) {
        return NextResponse.json({ error: 'Waktu pemeriksaan pesan tidak valid.' }, { status: 400 });
      }
      const { rows: unreadRows } = await query(
        `SELECT COUNT(*) AS unread_count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.user_id = ? AND m.sender_id <> c.user_id AND m.created_at > ?`,
        [user.id, since],
      );
      return NextResponse.json({ unread: Number(unreadRows[0]?.unread_count || 0) });
    }

    const { rows } = await query(
      `SELECT c.id, c.user_id, c.order_id, c.subject, c.created_at, u.full_name AS customer_name,
              COALESCE((
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                  'id', m.id, 'sender_id', m.sender_id, 'body', m.body, 'created_at', m.created_at
                ))
                FROM messages m WHERE m.conversation_id = c.id
              ), JSON_ARRAY()) AS messages
       FROM conversations c JOIN users u ON u.id = c.user_id
       ${user.role === 'admin' ? '' : 'WHERE c.user_id = ?'}
       ORDER BY c.created_at DESC LIMIT 300`,
      user.role === 'admin' ? [] : [user.id],
    );
    return NextResponse.json({
      conversations: rows.map((conversation) => ({
        ...conversation,
        messages: parseMessages(conversation.messages),
      })),
    });
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
          `SELECT id, user_id, order_id FROM conversations
           WHERE id = ? AND (? = TRUE OR user_id = ?) FOR UPDATE`,
          [conversationId, user.role === 'admin', user.id],
        );
        conversation = rows[0];
        if (!conversation) return null;
      } else {
        if (user.role === 'admin') throw Object.assign(new Error('Admin harus membalas percakapan yang sudah ada.'), { status: 400 });
        if (orderId) {
          const { rowCount } = await client.query(
            'SELECT id FROM orders WHERE id = ? AND user_id = ?',
            [orderId, user.id],
          );
          if (!rowCount) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });
        }
        const id = randomUUID();
        await client.query(
          'INSERT INTO conversations (id, user_id, order_id, subject) VALUES (?, ?, ?, ?)',
          [id, user.id, orderId, String(input.subject || (orderId ? 'Pertanyaan pesanan' : 'Customer support')).slice(0, 200)],
        );
        conversation = { id, user_id: user.id, order_id: orderId };
      }
      const message = {
        id: randomUUID(),
        conversation_id: conversation.id,
        sender_id: user.id,
        body,
      };
      await client.query(
        `INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)`,
        [message.id, message.conversation_id, message.sender_id, message.body],
      );
      return message;
    });
    if (!result) return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ message: result }, { status: 201 });
  } catch (error) {
    console.error('Message creation failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Pesan belum dapat dikirim.' }, { status: error?.status || 500 });
  }
}
