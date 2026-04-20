# CleanSchedule — Project Decisions

## Stack
- **Framework**: Next.js 14, App Router, TypeScript
- **Database & Auth**: Supabase (PostgreSQL + RLS + Magic Link Auth)
- **Styling**: Tailwind CSS v3, mobile-first
- **Calendar UI**: FullCalendar v6 (`@fullcalendar/react`)
- **Email**: Resend (`resend` package)
- **Deployment**: Vercel
- **Forms**: react-hook-form + zod + @hookform/resolvers
- **Recurrence**: `rrule` library
- **Utilities**: date-fns, clsx, tailwind-merge

## Auth & Roles
- Auth: Supabase magic link (signInWithOtp)
- Employee onboarding: admin invites via email → `supabase.auth.admin.inviteUserByEmail` (requires service role key)
- Roles: stored in `public.profiles.role` — values: `admin` | `employee`
- First admin: created manually via Supabase dashboard then updated with SQL
- Auth callback: `/auth/callback` exchanges code for session → middleware routes by role
- Middleware: `middleware.ts` at root enforces role-based routing for `/admin/*` and `/employee/*`

## Route Structure
```
app/(auth)/login         → public login page
app/auth/callback        → Supabase auth callback
app/(admin)/admin        → admin calendar dashboard
app/(admin)/admin/clients   → client management
app/(admin)/admin/employees → employee management
app/(employee)/employee  → employee schedule
```

## Data Model
- `profiles`: extends auth.users (id, full_name, phone, role, is_active)
- `clients`: id, full_name, email, phone, address, notes
- `appointments`: id, client_id, title, start_time, end_time, status, notes, recurrence_series_id, recurrence_rule, is_master
- `appointment_employees`: appointment_id + employee_id (join table)

## Recurring Appointments
- Strategy: materialize individual appointment rows sharing `recurrence_series_id`
- Master record: `is_master=true` + `recurrence_rule` (RRULE string) + `recurrence_series_id`
- Instances: `is_master=false`, same `recurrence_series_id`
- Horizon: 52 weeks (max 104)
- Series edit: `edit_scope=single|series` in PATCH body
- Series delete: `?scope=series` query param

## Email Notifications
- Provider: Resend
- Trigger: fire-and-forget after appointment create/update/delete
- Recipients: assigned employees (fetched via Supabase Admin `getUserById`)
- Templates: `lib/email/templates.ts`
- Notifications: `lib/email/notifications.ts`
- From address: `RESEND_FROM_EMAIL` env var

## Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY        (server-only, never expose to client)
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_APP_URL
```

## Key Patterns
- Supabase SSR: use `lib/supabase/server.ts` for server components and API routes
- Supabase browser: use `lib/supabase/client.ts` for client components
- Admin API (service role): create with `createClient(url, serviceRoleKey)` from `@supabase/supabase-js`
- API auth guard: `lib/api/auth.ts` → `getSessionAndRole(request)` → check role before any DB op
- Appointment details query: `lib/api/appointments.ts` → `getAppointmentWithDetails(supabase, id)`
- Response helpers: `forbidden()`, `badRequest()`, `notFound()`, `serverError()` from `lib/api/auth.ts`

## Migrations
Run in this order in Supabase SQL editor:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

## Mobile Strategy
- Mobile-first: all layouts start single-column, enhanced with `sm:` and `lg:` breakpoints
- Admin sidebar: hidden on mobile, slide-out drawer via hamburger in `MobileHeader`
- FullCalendar: `listWeek` on mobile, `timeGridWeek` on desktop (detect via `window.innerWidth < 1024`)
- Drag-and-drop: disabled on mobile
- Touch targets: 44px minimum height/width on all interactive elements
- Modals: full-screen (`fixed inset-0`) on mobile, max-w constrained on desktop

## Set Password Landing State — 2026-04-20

### Facts
- `app/(auth)/set-password/page.tsx` now shows a landing state with two actions before revealing the password form.
- `isCheckingAuth` is handled in a dedicated loading branch, separate from the form render.

### Decision
- Keep authenticated set-password entry split into three explicit UI states: loading, landing, and form.

### Consequences
- The password form is only shown after an explicit user action, while unauthenticated users still redirect through the existing session check.

### Citations
- `app/(auth)/set-password/page.tsx`

### memory_meta
- timestamp: 2026-04-20
- author: GitHub Copilot
