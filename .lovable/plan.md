## Goal

Take the structure, look, and content of **person-first-flow** (a "CareCore" person-centred care app) and merge it into this project, keeping all of this project's existing backend (Lovable Cloud / Supabase auth, residents, daily notes, care plans, risk assessments, wounds, consents, MCA, AI scribe) intact.

The source project is a Vite + react-router-dom app with mock data; this project is TanStack Start with a real database. So this is a UI/structure port, not a copy-paste — the pages are rebuilt as TanStack routes and wired to live data wherever a real table exists.

## What gets ported

**Visual design** (`src/styles.css`)
- CareCore healthcare palette: clinical blue primary `200 95% 35%`, warm secondary, care status tokens (`--care-on-track`, `--care-attention`, `--care-urgent`, `--care-completed`), success/warning/danger, gradient + shadow tokens, navy sidebar tokens.
- Added as semantic tokens (oklch where needed for v4) — components use the tokens, no hardcoded colors.

**Layout / navigation**
- Replace the current top-bar + bottom-tab `AppShell` with a left **collapsible sidebar** layout (CareCore style): logo "CareCore — Person-Centred Care", "Care Management" group (Dashboard, Residents, Care Plans, Tasks, Daily Notes, Calendar) and "System" group (Reports, Settings), plus a top header with bell + user menu and the existing sign-out.

**Routes** (all under `_authenticated/`)
- `/dashboard` — hero banner + metric cards + tasks list + recent activity + today's schedule / communication / performance cards. Metrics pull from live tables (residents count, notes today, alerts).
- `/residents` — search + stats + resident grid cards (avatar, care/risk badges, conditions, NoK, latest note). Live data.
- `/residents/$id` — keep existing tabbed profile (Notes, Care, Risk, Wounds, Consent, MCA) but restyled.
- `/care-plans` — CareCore list view (progress bar, goals, priority/status badges). Live data from `care_plans`.
- `/notes` — daily-notes feed across all residents, with the existing AI voice recorder at the top.
- `/tasks` — placeholder page styled to match (no `tasks` table yet — UI only, marked "coming soon").
- `/calendar` — placeholder page styled to match.
- `/reports` — tabbed Reports & Analytics shell (CQC / Analytics / Compliance), starting as placeholders.
- `/alerts`, `/family` — keep, restyled to the new shell.

**Components carried over (restyled, wired to live data)**
- `dashboard/MetricCard`, `dashboard/RecentActivity`, `dashboard/TasksList`
- `AddResidentDialog`, `CreateCarePlanDialog` — adapted to insert into Supabase instead of local state
- `AppSidebar`, `Layout` → become the new `AppShell`

**Not ported in this pass** (flagged for later)
- `reports/CQCInspectionToolkit`, `EvidenceUpload`, `QualityStatementChecklist`, `AIEvaluation` — large standalone features; ported as a stub tab now, full port is a follow-up.
- Hero image asset (`care-hero.jpg`) — copied from source.

## What is NOT changed

- Lovable Cloud schema (residents, daily_notes, care_plans, risk_assessments, wounds, consents, mca_assessments, history tables, etc.).
- Auth flow, `_authenticated/route.tsx`, Supabase clients, AI gateway server fns (`structureNote`, `transcribeAudio`).
- `VoiceRecorder`, `WoundsTab`, care-domain mapping, risk→domain pull logic.

## Files to add / change

```text
src/styles.css                              (extend tokens)
src/components/AppShell.tsx                 (replace with sidebar layout)
src/components/AppSidebar.tsx               (new, TanStack Link)
src/components/dashboard/MetricCard.tsx     (new)
src/components/dashboard/RecentActivity.tsx (new, live data)
src/components/dashboard/TasksList.tsx      (new, placeholder data)
src/components/AddResidentDialog.tsx        (new, writes to residents)
src/components/CreateCarePlanDialog.tsx     (new, writes to care_plans)
src/assets/care-hero.jpg                    (copied from source)
src/routes/_authenticated/dashboard.tsx     (rewrite)
src/routes/_authenticated/residents/index.tsx (rewrite to grid)
src/routes/_authenticated/care-plans.tsx    (new)
src/routes/_authenticated/notes.tsx         (new)
src/routes/_authenticated/tasks.tsx         (new, placeholder)
src/routes/_authenticated/calendar.tsx      (new, placeholder)
src/routes/_authenticated/reports.tsx      (new, tabs)
```

## Notes for the user

- Tasks and Calendar will show as styled "coming soon" panels — they were placeholders in the source too. Say the word if you want me to design real flows for either.
- CQC Inspection Toolkit is large enough to deserve its own follow-up turn; the Reports tab will be ready to receive it.
- I'll keep your existing resident detail page (with Wounds / Consent / MCA tabs) — the source had nothing equivalent, and yours is more complete.
