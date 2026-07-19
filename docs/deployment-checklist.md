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

## SEO / discoverability

- Set `PUBLIC_BASE_URL=https://kseb.akjohn.dev` in production (not `localhost`).
- Confirm `https://kseb.akjohn.dev/robots.txt` allows `/` and lists the production sitemap.
- Confirm `https://kseb.akjohn.dev/sitemap.xml` uses `https://kseb.akjohn.dev/` (not localhost).
- In Google Search Console, add the `kseb.akjohn.dev` property, submit `https://kseb.akjohn.dev/sitemap.xml`, and request indexing for `/`.
- Meta tags and sitemaps help discovery; they do not guarantee rankings without Search Console verification and ongoing crawlability.

## Product verification

- First-time sign-in successfully verifies live KSEB credentials.
- Returning sign-in loads the existing private customer history.
- Uploading a PDF stores and parses the document.
- A new fetched bill appears in the dashboard and notification center.
- Monthly and bi-monthly histories show reasonable normalized 30-day metrics.
- Account export and account deletion work as expected.
