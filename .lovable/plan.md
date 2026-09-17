# Workforce: staff profiles and shift rota

Two new pages under Workforce: **Staff** (profiles) and **Rota** (active shifts). Nothing outside the Workforce area changes.

## Staff profile

One record per staff member, extending the existing account:

- Name, role, employment status (employed, bank, agency, student, left)
- Contracted hours, start date, leaving date
- Weekly availability (per day, from/to, or unavailable)
- Qualifications (title, level, awarded date, expiry)
- Competencies (skill, level, signed off by, date)
- Training (course, completed date, renewal due) — renewals appear on Reviews Due
- Restrictions (e.g. no lone working, no manual handling) — free text plus a tick list

Screen: a searchable staff list; opening a person shows tabs for Details, Availability, Qualifications & training, Restrictions. Only admins and managers can edit; everyone else sees read-only.

## Rota — Active Shifts

Main table, deliberately simple: **Date · Start · End · Location · Staff · Role · Status**.

Status is calculated from the shift and the current time, never stored as a label:

- Unfilled (no staff assigned)
- Cover Required (flagged by a manager)
- Staff Absent (marked absent)
- Upcoming / Active / Completed (by time)
- Late (started, no clock-in)

Clicking a row opens a side panel with the full detail: times, location, staff, role, clock in/out, break, residents allocated, handover status, notes and any linked incidents.

Top actions: **+ Add Shift**, **Find Cover**, and quick views **Today's Shifts**, **Unfilled**, **Active Now**, plus **Filters** (date, location, staff, role, status).

Managers can create and edit shifts, assign and reassign staff, mark a shift as needing cover, find available staff for cover, mark staff absent, and view shift history and completed shifts.

## Staffing and skill mismatch flags

When a shift is assigned, the system checks the staff member against the shift and shows a flag for a person to review — it never blocks or reassigns by itself:

- Person is unavailable that day or outside their stated hours
- Role on the shift doesn't match the person's role or competencies
- A required qualification or training has expired
- A restriction conflicts with the shift
- Overlapping shift, or unfilled shift within 24 hours

Flags appear on the shift panel and as a short list above the rota.

## Technical notes

- New tables: `staff_profiles`, `staff_availability`, `staff_qualifications`, `staff_training`, `staff_competencies`, `shifts`, `shift_absences`; plus `locations` reused from existing rooms where sensible.
- All staff can read; writes limited to a new `manage_rota` permission (default on for admin, manager, nurse) with the existing admin/manager fallback.
- Change history via the existing audit trigger; standard created/updated timestamps.
- Status and mismatch flags computed in `src/lib/rota.ts`, not stored.
- New routes `/staff` and `/rota` added to the Workforce group in the sidebar alongside Calendar.
