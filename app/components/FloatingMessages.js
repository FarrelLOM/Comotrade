'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './floating-messages.module.css';

const SEEN_PREFIX = 'comotrade_messages_seen_';
const asset = '/Pictures/asset/floating%20message%20box%20icon.png';

export default function FloatingMessages() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [body, setBody] = useState('');
  const [unread, setUnread] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [returnTo, setReturnTo] = useState(pathname);
  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/messages', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Pesan belum dapat dimuat.');
    const items = data.conversations || [];
    setConversations(items);
    return items;
  }, []);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await response.json();
        if (active && response.ok) setUser(data.user || null);
      } catch {
        if (active) {
          setUser(null);
          setError('Status login belum dapat diperiksa. Coba buka pesan kembali.');
        }
      }
    }
    checkSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setReturnTo(`${pathname}${window.location.search}`);
  }, [pathname]);

  useEffect(() => {
    if (!user) return undefined;
    const storageKey = `${SEEN_PREFIX}${user.id}`;
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, new Date().toISOString());
    let active = true;
    async function checkUnread() {
      const since = localStorage.getItem(storageKey);
      try {
        const response = await fetch(`/api/messages?unreadSince=${encodeURIComponent(since)}`, { cache: 'no-store' });
        const data = await response.json();
        if (response.status === 401) {
          if (active) {
            setUser(null);
            setUnread(false);
          }
          return;
        }
        if (!response.ok) throw new Error(data.error || 'Pemeriksaan pesan baru gagal.');
        if (active) setUnread(data.unread > 0);
      } catch (cause) {
        if (active) setError(cause.message || 'Pemeriksaan pesan baru gagal.');
      }
    }
    checkUnread();
    const interval = window.setInterval(checkUnread, 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, [user]);

  async function toggleChat() {
    if (!user) {
      setOpen((value) => !value);
      return;
    }
    setOpen((value) => !value);
    setError('');
    if (!open) {
      try {
        localStorage.setItem(`${SEEN_PREFIX}${user.id}`, new Date().toISOString());
        setUnread(false);
        const items = await loadConversations();
        if (!selectedId && items[0]) setSelectedId(items[0].id);
      } catch (cause) {
        setError(cause.message);
      }
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!user || !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId || undefined, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Pesan belum dapat dikirim.');
      setBody('');
      setSelectedId(data.message.conversation_id);
      await loadConversations();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  const activeConversation = conversations.find((item) => item.id === selectedId);

  if (user?.role === 'admin') return null;

  return (
    <aside className={styles.widget}>
      {open && (
        <section className={styles.panel} aria-label="Pesan dengan suplier">
          <header className={styles.panelHead}>
            <div><strong>Hubungi suplier</strong><span>Tim Rempah Nusantara siap membantu</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Tutup pesan">×</button>
          </header>
          {!user ? (
            <div className={styles.loginPrompt}>
              <p>Login terlebih dahulu untuk mengirim pesan kepada suplier.</p>
              <Link
                href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  const currentPage = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                  window.location.assign(`/login?returnTo=${encodeURIComponent(currentPage)}`);
                }}
              >Login</Link>
            </div>
          ) : (
            <>
              {conversations.length > 0 && (
                <label className={styles.conversationSelect}>Percakapan
                  <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                    <option value="">Mulai percakapan baru</option>
                    {conversations.map((conversation) => (
                      <option key={conversation.id} value={conversation.id}>{conversation.subject}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className={styles.messages} aria-live="polite">
                {activeConversation?.messages?.length
                  ? activeConversation.messages.map((message) => (
                    <p key={message.id} className={message.sender_id === user.id ? styles.ownMessage : styles.adminMessage}>
                      <strong>{message.sender_id === user.id ? 'Anda' : 'Suplier'}</strong>{message.body}
                    </p>
                  ))
                  : <p className={styles.empty}>Sampaikan pertanyaan Anda kepada suplier.</p>}
              </div>
              <form className={styles.form} onSubmit={sendMessage}>
                <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} placeholder="Tulis pesan..." required />
                <button type="submit" disabled={busy || !body.trim()}>{busy ? 'Mengirim…' : 'Kirim'}</button>
              </form>
            </>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </section>
      )}
      <button className={styles.toggle} type="button" onClick={toggleChat} aria-label={open ? 'Tutup pesan' : 'Buka pesan'}>
        <img src={asset} alt="" />
        {unread && <span className={styles.unread} aria-label="Ada pesan baru" />}
      </button>
    </aside>
  );
}
