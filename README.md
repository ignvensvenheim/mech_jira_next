# Mechanikai Jira Dashboard

Internal Next.js application for viewing Jira tickets, filtering them, exporting to Excel, and managing machine-related cost data from an admin panel.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- NextAuth v5 (credentials auth)
- Prisma + PostgreSQL
- SWR / fetch-based API calls
- XLSX for export

## What This Project Does

### Public page (`/`)

- Fetches Jira tickets through server API (`/api/jira/search`)
- Caches and incrementally refreshes tickets in the browser (`useJiraSearch`)
- Supports filtering by:
  - date range
  - status
  - category/subcategory (parsed from ticket summary)
- Shows paginated ticket cards
- Exports filtered tickets to Excel

### Admin area (`/admin`)

- Protected by auth (`proxy.ts` + NextAuth session)
- Filter issues by category/subcategory/date
- Manage machine hourly rate
- Add/edit/delete manual machine cost entries
- Add/update/delete per-ticket fix costs
- Computes total selected cost as:
  - time-based machine cost
  - + manual entries
  - + ticket fix costs

### Login (`/login`)

- Credentials sign-in via NextAuth
- Uses `useSearchParams` with Suspense boundary for App Router compatibility
- Redirects back to requested admin path via `callbackUrl`

## Project Structure (important parts)

- `app/page.tsx` - public dashboard
- `app/admin/page.tsx` - admin panel
- `app/login/page.tsx` - login page
- `app/api/jira/search/route.ts` - Jira proxy/search endpoint
- `app/api/admin/*` - admin CRUD APIs
- `auth.ts` - NextAuth credentials provider and bootstrap-admin logic
- `auth.config.ts` - NextAuth callbacks/session setup
- `proxy.ts` - route protection for `/admin/*`
- `hooks/useJiraSearch.ts` - Jira fetch/caching/polling logic
- `prisma/schema.prisma` - DB schema
- `lib/prisma.ts` - Prisma client singleton

## Environment Variables

Create `.env.local` for local dev and set:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - secret for auth tokens
- `NEXTAUTH_URL` - app URL (for local: `http://localhost:3000`)
- `ADMIN_EMAIL` - initial admin login email/username value
- `ADMIN_PASSWORD` - initial admin login password
- `JIRA_BASE` - Jira base URL
- `JIRA_EMAIL` - Jira account email
- `JIRA_API_TOKEN` - Jira API token

Notes:

- The first admin user can be auto-created on first successful login if the DB has no matching user and credentials match `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- In production (Vercel), these must be added in Project Settings -> Environment Variables.

## Local Development

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Open:

- `http://localhost:3000` - public dashboard
- `http://localhost:3000/login` - admin login
- `http://localhost:3000/admin` - admin panel

## Prisma Usage

### 1. Generate Prisma client

```bash
npm run prisma:generate
```

Runs automatically on `postinstall`, but you can run manually anytime.

### 2. Apply schema changes to database

Production-safe migration deploy:

```bash
npm run prisma:migrate
```

Equivalent to:

```bash
prisma migrate deploy
```

For quick schema sync without migration history (development utility):

```bash
npm run prisma:push
```

### 3. View and edit data with Prisma Studio

```bash
npx prisma studio
```

Main models currently:

- `User`
- `MachineRate`
- `ManualEntry`
- `TicketFixCost`

### 4. Typical DB flow when changing schema

1. Edit `prisma/schema.prisma`
2. Create/apply migration (or use `db push` in dev)
3. Run `npm run prisma:generate`
4. Verify through Prisma Studio
5. Test affected API routes/UI

## Build and Validation

Type check:

```bash
npx tsc --noEmit
```

Production build:

```bash
npm run build
```

Start production server locally:

```bash
npm run start
```

## Auth and Access Control

- `/admin/*` is protected in `proxy.ts`
- Unauthenticated access redirects to `/login?callbackUrl=<requested-path>`
- Session strategy is JWT (`auth.config.ts`)
- Role is included in JWT/session; admin APIs also call `requireAdmin()`

## Jira Integration Notes

- Jira data is fetched server-side by `/api/jira/search`
- Client hook (`useJiraSearch`) does:
  - initial/full sync
  - incremental sync with overlap watermark
  - periodic polling (visible/hidden tab intervals)
  - localStorage caching
- Public UI disables Excel export while full ticket fetch is in progress

## Common Troubleshooting

### Login shows internal error

Usually caused by missing/incorrect production env vars or DB connectivity. Verify:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### `/login` prerender/Suspense error

`useSearchParams()` must be used inside Suspense for App Router client pages. This is already handled in `app/login/page.tsx`.

### Ticket fix cost insert failure (`23502`)

`updatedAt` is now explicitly set in raw SQL insert (`NOW()`) in `app/api/admin/ticket-costs/route.ts`.

## Deployment Notes (Vercel)

- Set all required env vars in Vercel
- Ensure database schema is deployed (`prisma migrate deploy`)
- Build command: `npm run build`

## Documentation Scope

This README is intended as local project documentation for how the app is structured and operated.
