# MessageFlow — consent-first SMS dashboard

A polished, browser-based proof of concept for a client-facing workflow:

1. Import `.xlsx` or `.csv` files with names and phone numbers.
2. Normalize phone numbers, remove duplicates, flag invalid values, and identify contacts without consent.
3. Search, filter, sort, and paginate the cleaned audience.
4. Compose a compliant campaign from approved-style templates and preview personalised output.
5. Run a simulated, rate-limited campaign queue and inspect its delivery log.
6. Keep transactional OTP requests separate from bulk campaigns.

## Run locally

```powershell
cd "C:\Users\Hitesh\Documents\Codex\2026-11-22\ct-as-a-senior-saas-architect\outputs\messageflow-consent-dashboard"
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`).

## Excel format

The importer recognizes common columns such as `Full name` / `Name`, `Phone` / `Mobile`, and `Consent` / `Opt-in`. Ten-digit values default to the `+91` country code. Use an explicit international number for other countries.

The spreadsheet is processed in the browser for this demo. It intentionally performs **simulated sends only** and does not retain uploaded data after refresh.

## Production path for 10,000 contacts

Do not send bulk SMS from a browser. Use a backend with PostgreSQL, private object storage, a Redis-backed queue (such as BullMQ), and provider adapters (Twilio, MSG91, Vonage, etc.).

```text
Upload → streamed parse / validation → E.164 normalization / dedupe
→ consent & suppression checks → approved campaign → queue batches
→ provider workers with rate limits → delivery webhooks / audit logs
```

Recommended safeguards:

- Store an auditable consent source and timestamp before a contact is eligible.
- Make STOP/unsubscribe events immediately update a suppression list.
- Encrypt phone values at rest and avoid logging full phone numbers.
- Use server-side idempotency, retries with backoff, dead-letter queues, and account-level daily limits.
- Keep OTP strictly transactional: generate, hash, expire, rate-limit, and verify codes on the server; never use an imported contact list for OTP.
- Confirm applicable telecom, sender-ID/template, and privacy requirements with counsel before enabling live sending.
