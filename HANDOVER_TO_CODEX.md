# Handover to Codex — BizCompliance Frontend

## 1. Mock Data Status

All UI renders against a mock data layer. The two files `src/lib/mock-data.ts` and `src/lib/mock-api.ts` contain the full mock dataset and API surface. Codex should **delete both files** and replace every `mock-api` import with real Supabase / Stripe / Resend calls.

**Key data shapes to match:**
- `getCurrentUser()` → `supabase.auth.getUser()`
- `getDocuments()` → `supabase.from('documents').select('*')`
- `getCalendarEvents()` → `supabase.from('calendar_events').select('*')`
- `getAlerts()` → `supabase.from('alerts').select('*')`
- `submitRequest()` → `supabase.from('requests').insert(...)`
- `startCheckout()` → Stripe Checkout session creation
- `signIn()` → `supabase.auth.signInWithPassword()`
- `signUp()` → `supabase.auth.signUp()` with email confirmation
- `submitContactForm()` → Resend email send
- `getRequests()` → `supabase.from('requests').select('*')`
- `getAudits()` → `supabase.from('audits').select('*')`
- `getTasks()` → `supabase.from('tasks').select('*')`
- `getCustomers()` → `supabase.from('customers').select('*')`
- `getStats()` → aggregated Supabase queries

## 2. Stripe Price IDs

Stripe price IDs are read from env vars via `getStripePriceId()` in `src/lib/stripe/plans.ts`. Set these in `.env.local`:

```
STRIPE_PRICE_AUDIT_ONEOFF=price_xxx
STRIPE_PRICE_STUDIO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_AGENCY_MONTHLY=price_xxx
```

## 3. Secrets to Add

Create `.env.local` with the following secrets:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@bizcompliance.co.uk
RESEND_FROM_NAME=BizCompliance
NEXT_PUBLIC_SITE_URL=https://bizcompliance.co.uk
ADMIN_EMAILS=tee@bizcompliance.co.uk
```

## 4. `output: 'export'` Do Not Add

This project requires Next.js SSR for API routes and middleware. Do NOT add `output: 'export'` to `next.config.mjs`. The project must be deployed as a full Next.js app (not static HTML export).

## 5. Generated Documents Are Fake

The "View" / "Download" links on the Documents page and Recent Deliverables section are stubs. Wire these to a PDF generation service (e.g., `@react-pdf/renderer` or a server-side PDF generator) connected to real document data.

## 6. File Upload Not Implemented

The file upload area on the Requests page is a visual placeholder. Implement actual file upload using Supabase Storage or a similar service.

## 7. Hero 3D Folio Notes

The 3D folio uses `@react-three/fiber` and `@react-three/drei`. On mobile / touch devices, OrbitControls should be disabled to prevent scroll hijacking (currently autoRotate is already disabled). For `prefers-reduced-motion`, the component falls back to a static SVG illustration.

## 8. Component Inventory

All shadcn/ui components are in `src/components/ui/`:
- `button`, `card`, `badge`, `input`, `label`, `separator`, `avatar`, `skeleton`, `select`, `textarea`, `accordion`, `table`, `toast`, `sheet`, `dialog`, `tabs`, `dropdown-menu`, `progress`

Site-specific components:
- `src/components/site/public-header.tsx` — Public navigation
- `src/components/site/public-footer.tsx` — Public footer
- `src/components/site/hero-folio.tsx` — 3D folio (Three.js)
- `src/components/dashboard/sidebar.tsx` — Dashboard sidebar
- `src/components/admin/sidebar.tsx` — Admin sidebar

## 9. Page Inventory (42 pages)

### Public (marketing) pages:
- `/` — Homepage (7 sections: Hero, Trust Strip, Problem, Practice, Pricing, Founder, CTA)
- `/how-it-works` — 5-step process timeline
- `/services` — Tabbed service categories
- `/pricing` — Pricing cards + comparison table + billing FAQ
- `/sectors` — Sector pack index
- `/sectors/[slug]` — Sector detail (beauty, recruitment, ecommerce, coaches, trades, hospitality)
- `/about` — Founder note, methodology, advisory network
- `/resources` — Article index
- `/resources/[slug]` — Article detail
- `/case-studies` — Case study cards with before/after scores
- `/contact` — Contact form
- `/faq` — FAQ accordion by category
- `/legal/privacy` — Privacy notice
- `/legal/terms` — Terms of service
- `/legal/cookies` — Cookie policy
- `/legal/complaints` — Complaints procedure
- `/legal/accessibility` — Accessibility statement

### Auth pages:
- `/login` — Sign in
- `/signup` — Create account
- `/forgot-password` — Password reset

### Dashboard pages:
- `/dashboard` — Overview (compliance score, open issues, milestones, deliverables, deadlines)
- `/dashboard/documents` — Document vault with filter
- `/dashboard/calendar` — Calendar events list
- `/dashboard/requests` — Submit requests + track history
- `/dashboard/alerts` — Regulatory alerts with read/unread
- `/dashboard/account` — Business, subscription, invoices, profile, notifications (tabs)

### Admin pages:
- `/admin` — Operational overview (MRR, subscriptions, audits, signups)
- `/admin/customers` — Customer table with detail drawer
- `/admin/audits` — Audit management with status filters
- `/admin/tasks` — Task list with checkboxes and filters

### API routes:
- `/api/health` — Health check
- `/api/stripe/webhook` — Stripe webhook handler

## 10. Tech Stack

- **Framework:** Next.js 15 + TypeScript
- **Styling:** Tailwind CSS 3 + shadcn/ui
- **Fonts:** Fraunces (display), Inter (sans), JetBrains Mono (mono)
- **Auth:** Supabase Auth (placeholder)
- **Database:** Supabase (placeholder)
- **Payments:** Stripe (placeholder)
- **Email:** Resend (placeholder)
- **3D:** Three.js + @react-three/fiber + @react-three/drei

## 11. Middleware

`src/middleware.ts` handles:
- Route protection for `/dashboard/*` (redirects to `/login` if unauthenticated)
- Route protection for `/admin/*` (checks `ADMIN_EMAILS` env var)
- Supabase session cookie refresh

## 12. Deploy Notes

This is a Next.js app that requires:
- Node.js runtime for API routes
- Server-side rendering for dynamic routes
- Middleware for auth protection

Deploy to Vercel, or any platform that supports Next.js:
```bash
npm run build
npm start
```

## 13. Known Issues

1. The sign-out button does not actually sign out (needs Supabase `signOut()`)
2. The 3D folio uses a placeholder font path for Text3D (`/fonts/helvetiker_regular.typeface.json`) — this needs to be served from `public/fonts/` or replaced with a different approach
3. The avatar component doesn't use Radix UI (custom implementation to avoid missing dependency)
4. The separator component doesn't use Radix UI (custom implementation)
