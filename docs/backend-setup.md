# Backend MVP setup

## Security first

- A database password was exposed in the chat attachment. Rotate it in the database provider and update only the local `.env`; never paste the new value into chat or commit it.
- `.env` is ignored by Git. Keep database credentials, `AUTH_SECRET`, and future OAuth/payment secrets server-side; never prefix them with `NEXT_PUBLIC_`.
- Verify the PostgreSQL instance is dedicated to this marketplace before running the migration. Do not apply the schema to another application's database.

## Configure local environment

Copy `.env.example` to `.env` and fill in the rotated database credentials plus a cryptographically random `AUTH_SECRET` of at least 32 characters. `DB_NAME` defaults to `defaultdb` in code but should be set explicitly. The PostgreSQL pool requires TLS by default; set `DB_SSL=false` only for a trusted local database.

## Initialize the schema

Review `db/migrations/001_marketplace.sql`, take a provider-side backup, then apply that SQL to the confirmed marketplace database using the provider console or your approved migration runner. This project does not automatically execute migrations at startup. Do not run it against production or an unrelated database.

The migration creates users, products, orders, order items, payments, shipments, reviews, conversations, and messages. New registrations are assigned `users.role = 'user'`; admin access is checked server-side against this column. Promote the administrator manually in the database only after creating that account.

## Implemented in this first pass

- Email/password registration and login use bcrypt password hashes and a signed, HTTP-only session cookie.
- Product catalog and detail endpoints read from PostgreSQL; the landing page retains its original static catalog as a fallback and overlays database-managed products.
- Admin-only product creation; authenticated order creation, order history, status/tracking administration, payment-reference submission, reviews after delivery, and customer/admin messaging endpoints.
- Order creation validates stock and reserves it within a database transaction. Cancelling eligible unshipped orders restores reserved stock.

## Not yet connected

- Google OAuth: no OAuth client credentials/callback configuration have been supplied; the UI marks this option as unavailable.
- Payment gateway: provider is undecided. Payment submission currently records a reference for admin review; it does not collect money, verify webhooks, or process refunds through a gateway.
- Payment proof uploads and product image uploads: the schema has fields for references/URLs, but a trusted object-storage provider and upload validation are still needed.
- Courier API and real-time chat: shipment tracking is an admin-entered carrier/tracking URL and messaging is database-backed polling-on-refresh, not WebSocket/live notifications.
- Cart is currently browser-local; the final checkout is validated and persisted server-side.

Before production, add CSRF/origin protections, rate limiting and login throttling, email verification/password reset, audit logging, automated migrations, provider webhooks with signature verification and idempotency, secure object storage, and integration tests.
