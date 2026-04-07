# CleanSchedule

A web application for scheduling and managing cleaning appointments, built with Next.js, Supabase, and Vercel.

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router, TypeScript)
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Magic Link Auth)
- **Styling**: Tailwind CSS (mobile-first)
- **Calendar**: FullCalendar
- **Email**: Resend
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Resend](https://resend.com) account

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd booking-solutions
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your credentials:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Sender address, e.g. `CleanSchedule <noreply@yourdomain.com>` |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000` locally) |

### 3. Set up Supabase

1. Run the SQL migrations in order in the Supabase SQL editor:
  - `supabase/migrations/001_initial_schema.sql`
  - `supabase/migrations/002_rls_policies.sql`

2. In your Supabase project -> **Authentication -> URL Configuration**:
  - Add `http://localhost:3000/auth/callback` to the **Redirect URLs** list.

### 4. Create the first admin user

Since the admin account must be created manually (employees are invited by the admin):

1. Go to Supabase -> **Authentication -> Users** -> Invite user (or use SQL to insert).
2. After the user signs up, run this in the SQL editor to make them admin:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-id>';
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push the repo to GitHub/GitLab.
2. Import the repo in [Vercel](https://vercel.com).
3. Add all environment variables in Vercel -> Project Settings -> Environment Variables.
4. In Supabase -> **Authentication -> URL Configuration**, add your production URL to Redirect URLs: `https://your-app.vercel.app/auth/callback`.
5. Deploy.

## Roles

| Role | Capabilities |
|---|---|
| `admin` | Full access: manage appointments, clients, employees, view all schedules |
| `employee` | Read-only: view their own assigned appointments |

## Project Structure

```text
app/
  (auth)/          # Login and auth callback pages
  (admin)/         # Admin dashboard (calendar, clients, employees)
  (employee)/      # Employee schedule view
  api/             # API routes
    appointments/
    clients/
    employees/
components/
  admin/           # Admin-specific components
  employee/        # Employee-specific components
  ui/              # Shared UI primitives
lib/
  api/             # API helpers
  calendar/        # Recurrence utilities
  email/           # Resend templates and notification functions
  supabase/        # Supabase clients (browser, server, middleware)
supabase/
  migrations/      # Database schema and RLS policies
types/             # TypeScript types
```
