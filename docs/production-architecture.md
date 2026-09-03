# Production Architecture

This application is now structured as a multi-process, multi-tenant system:

- `api`: FastAPI service in `app/main.py` serving authenticated APIs and the web app.
- `worker`: background processor in `app/worker.py` that executes scheduled sync jobs.
- `scheduler`: recurring job enqueuer in `app/scheduler.py` that keeps enrolled customers up to date.
- `postgres`: primary relational store for customers, sessions, bills, uploads, notifications, and audit events.
- `object storage`: local filesystem by default via `LOCAL_STORAGE_ROOT`, with optional S3-compatible storage through `STORAGE_BACKEND=s3`.

## Tenancy

Every public user is isolated by `customer_id`.

- Session cookies map to `app_sessions`.
- Bills, uploaded documents, push subscriptions, jobs, and audit events are all scoped to the owning customer.
- Consumer and mobile numbers are stored as encrypted ciphertext plus keyed lookup hashes.

## Sync Model

1. First sign-in verifies the consumer/mobile combination and creates a customer row.
2. The scheduler looks for customers whose `next_sync_check_at` is due.
3. The worker fetches the latest KSEB PDF, stores it, parses it, dedupes it, and emits notifications.
4. Billing periods are inferred from the ordered bill timeline so monthly and bi-monthly users are both supported.

## Security Controls

- HTTP-only same-site session cookie.
- At-rest encryption for reusable customer identifiers.
- Lookup hash indexing to avoid plaintext searches.
- Audit logging for login, upload, and sync events.
- Request throttling on login attempts.
- Uploaded and fetched PDFs are kept outside any public static directory.

## Deployment Notes

- `docker-compose.yml` runs `api`, `worker`, `scheduler`, and `postgres`.
- Put TLS termination in front of the API container when exposing this on the public internet.
- Set real secrets for `APP_SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, and web push keys before production.
