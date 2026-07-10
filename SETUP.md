# BizCompliance — Go-Live Setup Guide

Everything in the codebase is built and wired. This file lists **only the steps you must do
manually** (accounts, keys, dashboard clicks). Do them in order — about 45–60 minutes total.

Your live Supabase project: `rkqryhomsjvrmuigtfrj` (the one already in `.env.local`).
Admin login email: `bizcompliance@outlook.com` (auto-promoted to admin on signup).

---

## 1. Database — apply the migrations (~5 min)

1. Open https://supabase.com/dashboard/project/rkqryhomsjvrmuigtfrj/sql/new
   (sign in with the account that owns this project).
2. Open `supabase/migrations/0001_schema.sql` in this repo, copy the **whole file**, paste it
   into the SQL editor, press **Run**. It creates every table, enum, trigger, RLS policy and
   the four private storage buckets (`library`, `evidence`, `deliverables`, `reports`).
3. Do the same with `supabase/migrations/0002_seed_static.sql` — it seeds the 18 compliance
   areas and all 68 SAF interview questions.
4. Do the same with `supabase/migrations/0003_engine.sql` — it adds the audit-engine layer:
   autopilot suggestion columns, 12-month document review cycles, the `engine_runs`
   telemetry table, performance indexes and the `org_health` view.
5. Do the same with `supabase/migrations/0004_engine_saf.sql` — it adds SAF cross-reference
   suggestions, re-audit lineage columns, and the `audit_benchmark` function that lets clients
   see where their score sits against the cohort without exposing anyone else's data.
6. Do the same with `supabase/migrations/0005_website_scanner.sql` — it adds the
   `website_scans` table behind the free public website scanner (leads land here with
   their email, score and domain — readable from your admin account).
7. Sanity check: in Table Editor you should see ~27 tables; `library_areas` has 18 rows and
   `saf_questions` has 68.

## 2. Seed the 139-document library (~3 min)

From the project root (the library must still be at
`~/Downloads/BizCompliance_Domiciliary_Care_Library_COMPLETE` — set `LIBRARY_DIR` if it moves):

```bash
npm run seed:library
```

It uploads all 139 `.docx` files to the private `library` bucket and creates their metadata
rows. Safe to re-run. At the end it prints `library_assets rows in database: 139`.

## 3. Supabase Auth settings (~5 min)

In the Supabase dashboard → **Authentication**:

1. **URL Configuration**
   - Site URL: `https://bizcompliance.co.uk` (or your production domain).
   - Redirect URLs — add all of:
     - `https://bizcompliance.co.uk/auth/callback`
     - `http://localhost:3000/auth/callback`
     - `http://127.0.0.1:3001/auth/callback`
2. **Providers → Email**: leave "Confirm email" **ON** (signup flow expects it).
3. *(Recommended)* **SMTP**: point Supabase's auth emails at Resend
   (Settings → Auth → SMTP: host `smtp.resend.com`, port 465, user `resend`,
   password = your Resend API key, sender = your verified address). Without this,
   Supabase's built-in mailer works but is rate-limited to ~4 emails/hour.

## 4. Create your admin account (~2 min)

1. Run the site (locally `npm run dev`, or after deploy).
2. Go to `/signup` and register with **bizcompliance@outlook.com**.
3. Confirm the email, sign in — you'll be redirected to `/admin` automatically
   (the database trigger promotes this exact email to admin; `ADMIN_EMAILS` in env is the
   second gate and is already set).

## 5. Stripe (~15 min)

1. Create/sign in at https://dashboard.stripe.com — activate the account for live payments
   (business details, bank account).
2. **Products** → create these products with GBP prices:
   | Product | Price | Type |
   |---|---|---|
   | CQC Readiness Audit | £595 | One-off |
   | Website Compliance Report | £8.99 | One-off |
   | Essentials | £49/month | Recurring |
   | Professional | £99/month | Recurring |
   | Partner | £249/month | Recurring — *coming soon; create it now, buyers are blocked in-app until you flip `comingSoon` off in `src/lib/stripe/plans.ts`* |
3. Copy each **price ID** (starts `price_…`) into `.env.local` (and later into Vercel):
   ```
   STRIPE_PRICE_AUDIT_ONEOFF=price_xxx
   STRIPE_PRICE_WEBSITE_REPORT=price_xxx
   STRIPE_PRICE_ESSENTIALS_MONTHLY=price_xxx
   STRIPE_PRICE_ESSENTIALS_ANNUAL=price_xxx
   STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxx
   STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_xxx
   STRIPE_PRICE_PARTNER_MONTHLY=price_xxx
   STRIPE_PRICE_PARTNER_ANNUAL=price_xxx
   ```
4. **Developers → API keys**: copy the secret key into `STRIPE_SECRET_KEY=sk_live_…`
5. If you want the website's one-off audit button to send people straight to your Stripe Payment Link, set:
   `STRIPE_PAYMENT_LINK_AUDIT_ONEOFF=https://buy.stripe.com/8x2cN6eV9dhV4XxbCl0VO0b`
6. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<your-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET=whsec_…`
7. **Settings → Billing → Customer portal**: click **Activate** (the dashboard's
   "Manage billing" button uses it).

When an audit is purchased the webhook automatically: records the purchase → creates the
audit → snapshots the 139-item checklist + 68 SAF questions → creates your admin task →
emails you and the client. Test with a Stripe test-mode purchase first if you like
(use test keys + `stripe listen --forward-to localhost:3000/api/stripe/webhook`).
Monthly plans are gated until an audit purchase exists for that organisation. If the test
email override is used, the dashboard unlocks all plan features for local testing.

## 6. Resend (email) (~10 min)

1. Sign up at https://resend.com → **Domains** → add your sending domain
   (e.g. `bizcompliance.co.uk`) and add the DNS records it shows you (SPF + DKIM).
2. **API Keys** → create one → put it in `RESEND_API_KEY=re_…`
3. Update `RESEND_FROM_EMAIL` to an address on the verified domain
   (e.g. `hello@bizcompliance.co.uk`) — Outlook addresses can't be verified senders.
   Until this is done the app runs fine; emails are skipped and logged, never blocking.

## 7. Deploy to Vercel (~10 min)

1. Push the repo to GitHub, then import it at https://vercel.com/new (framework auto-detects
   Next.js; no special build settings needed — do **not** enable static export).
2. Add every variable from `.env.local` in **Project → Settings → Environment Variables**,
   with these production values:
   - `NEXT_PUBLIC_SITE_URL=https://<your-domain>`
   - all Supabase, Stripe, Resend keys from the steps above
   - `ADMIN_EMAILS=bizcompliance@outlook.com`
   - Skip `MALWARE_SCAN_COMMAND`/`ARGS` on Vercel (no clamscan there — uploads are marked
     "Unscanned" in your review queue and you vet them manually; the strict file-type and
     25MB limits still apply).
3. Add your domain under **Settings → Domains** and point DNS at Vercel.
4. After the first deploy, update the Stripe webhook URL (step 5.5) and the Supabase
   redirect URLs (step 3.1) to the live domain if you used placeholders.
5. **Engine cron**: set `CRON_SECRET` in the Vercel env vars to a long random string
   (e.g. `openssl rand -hex 32`). `vercel.json` already schedules `/api/cron/daily`
   at 06:00 UTC — Vercel calls it with that secret automatically. The cron creates
   document-review calendar events and tasks, flags overdue audits, and emails you a
   daily briefing only when something needs attention.

## 8. First-run checklist (5 min, after deploy)

- [ ] Sign up a **test client** account (any other email), confirm, log in → dashboard shows
      the "Start your readiness audit" welcome.
- [ ] Buy the audit with Stripe **test card 4242 4242 4242 4242** (if testing in test mode)
      → audit appears in `/admin/audits`, task created, emails received.
- [ ] Upload a PDF in the client's **Evidence Vault** (name it like a real policy, e.g.
      "Safeguarding Adults Policy.pdf") → it appears in `/admin/evidence`, and the matching
      checklist item in the workbench already shows an engine suggestion.
- [ ] In the workbench: press **Run engine** → suggestions appear on the checklist; press
      **Accept all & draft findings** → statuses fill in, areas get RAG ratings, findings are
      drafted and the score updates. Adjust anything manually, answer SAF questions,
      **Generate report**, review the PDF, **Publish** → client dashboard shows score, actions
      and the downloadable report.
- [ ] In `/admin/library`: select documents → **Issue documents** → they appear in the client's
      Document Vault with a download that works.
- [ ] Publish an alert in `/admin/alerts` → visible in the client's Alerts page.

## Architecture notes (for future you)

- **Access control**: every table has row-level security; clients can only ever read rows
  belonging to their organisation. Admin access requires the `admin` role in the `profiles`
  table (set only by the database trigger) *and* the `ADMIN_EMAILS` middleware gate. The
  service-role key is used only in server-side code (webhook, file signing, issuing) and is
  never exposed to the browser.
- **Files**: all four storage buckets are private. Downloads go through
  `/api/files/download`, which checks the signed-in user can see the row via RLS before
  minting a 2-minute signed URL. Uploads go through `/api/files/evidence` with type/size
  validation, rate limiting and an optional clamscan hook.
- **Scoring**: documents weight LEGAL=3 / CQC=2 / BEST=1 / OPT=0.5 (60% of the score); SAF
  answers weight priority questions ×2 (40%). Any LEGAL document missing or out-of-date
  suggests a RED area — the same rule as your printed checklist.
- **Library updates**: replace a file in the Downloads library folder and re-run
  `npm run seed:library`; then re-issue to clients (old copies are marked superseded).
- The old `HANDOVER_TO_CODEX.md` is superseded by this file.
