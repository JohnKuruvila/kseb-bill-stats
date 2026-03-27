# Deployment Checklist

Use this checklist before exposing the service to the public internet.

## Security

- Set strong values for `APP_SECRET_KEY` and `FIELD_ENCRYPTION_KEY`.
- Enable HTTPS termination in front of the `api` service.
- Set `SESSION_COOKIE_SECURE=true` in production.
- Restrict database network access to application services only.
- Configure a real object store or durable volume backups for uploaded/fetched PDFs.
- Generate and set VAPID keys if browser push notifications are required.

## Operations

- Monitor `/api/health`.
- Keep separate staging and production `.env` files.
- Back up PostgreSQL and object storage on a schedule.
- Verify that `worker` and `scheduler` containers restart automatically.
- Add reverse-proxy request limits and bot mitigation for public traffic.

## Product verification

- First-time sign-in successfully verifies live KSEB credentials.
- Returning sign-in loads the existing private customer history.
- Uploading a PDF stores and parses the document.
- A new fetched bill appears in the dashboard and notification center.
- Monthly and bi-monthly histories show reasonable normalized 30-day metrics.
- Account export and account deletion work as expected.
