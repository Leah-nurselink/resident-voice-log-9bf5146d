# Medication / MAR module — inspection report and build proposal

## 1. What already exists

There is **no medication feature** in the app today. What exists is only medication-*flavoured* text elsewhere:

- "Medication" is a care plan area and a risk assessment type (free text: needs, risks, controls).
- The care schedule tab offers preset activity names like "Morning meds", "Lunchtime meds", "PRN review" — a generic activity scheduler, not a MAR.
- Allergies are a free-text field on the resident profile.
- Audit questionnaires and dashboard copy mention medication errors, PRN protocols, fridge temperatures — wording only, no data.
- The Tasks demo list mentions a "Morning medication round" — placeholder text.

So: no medication records, no administration records, no MAR, no PRN tracking, no medication events on the timeline.

## 2. What can be retained (reused, not rebuilt)

- **AI insight engine** — `ai_recommendations` + the approve/reject queue already does observation-with-evidence, human decides. PRN/refusal patterns plug straight into it.
- **Tasks** — `communication_tasks` + `TaskBoard` already handles "someone owns this action".
- **Timeline** — `ResidentTimeline` already merges dated events by day; medication becomes another event kind.
- **Audit trail** — `record_audit` triggers can be attached to the new tables with one line each.
- **Permissions** — `can_write(uid, perm)` already exists; medication gets its own permission keys.
- **Resident tabs** — the resident page tab strip takes a new "Meds" tab with no restructuring.
- **Pain, Voice & Interactions, Care Plans, Communications** — untouched; medication links to them.

## 3. What needs changing

- Resident page: add a **Meds** tab.
- Sidebar: add a **Medication round** page (today's MAR across residents).
- Timeline: add medication administration events.
- Reviews Due: include medication review dates.
- Handover/Reports: include doses given/refused/omitted counts.
- Nothing is removed. Resident Voice is not touched.

## 4. Existing database structures relevant here

`residents` (allergies, id), `care_plans` (medication domain), `risk_assessments` (medication type), `care_schedules`, `ai_recommendations`, `communication_tasks`, `record_audit`, `pain_assessments`, `user_permissions` / `can_write()`.

## 5. New database structures required

**`medications`** — one row per prescribed item
`resident_id`, `name`, `form`, `dose`, `route`, `frequency_text`, `times[]` (scheduled clock times), `days_of_week[]`, `is_prn`, `prn_indication`, `prn_min_interval_minutes`, `prn_max_doses_24h`, `indication`, `instructions`, `start_date`, `end_date`, `review_date`, `prescriber`, `notes`, `status` (active/suspended/stopped), `created_by`, timestamps.

**`medication_administrations`** — one row per dose event
`medication_id`, `resident_id`, `scheduled_date`, `scheduled_time` (null for PRN), `status` (given / refused / omitted / not_available / other), `reason`, `action_taken`, `administered_by`, `administered_at`, `dose_given`, `effectiveness` + `effectiveness_at` (PRN follow-up), `notes`, timestamps.
Unique index on (medication_id, scheduled_date, scheduled_time) so a scheduled dose can't be double-recorded.

Both tables: GRANTs, RLS (all staff read; write gated by `can_write(uid,'administer_medication')` / `'manage_medications'` with admin/manager fallback), `updated_at` triggers, and `record_audit` triggers.

No table is dropped or altered destructively; `medication` is added as an allowed `communication_tasks.kind`.

## 6. Files affected

New:
- `src/components/MedicationsTab.tsx` — resident medication list + add/edit medication record
- `src/components/MedicationAdministration.tsx` — tap-to-record Given/Refused/Omitted/Not available/Other with reason
- `src/components/MedicationHistory.tsx` — chronological administration history
- `src/routes/_authenticated/medication-round.tsx` — today's MAR across residents
- `src/lib/medications.ts` — schedule expansion (due doses for a day), PRN interval checks, allergy cross-check
- `src/lib/medication-insights.ts` — PRN-increase / repeated-refusal / repeated-omission pattern detection feeding `ai_recommendations`

Modified:
- `src/routes/_authenticated/residents/$id.tsx` — new Meds tab
- `src/components/ResidentTimeline.tsx` — medication events
- `src/components/AppSidebar.tsx` — Medication round link
- `src/routes/_authenticated/reviews.tsx` — medication review dates
- `src/routes/_authenticated/reports.tsx` — medication figures
- `roadmap.md`

Untouched: `VoiceRecorder.tsx`, `SessionRecorder.tsx`, `carer.capture.tsx`, `PainTab.tsx`, all BLE/beacon code.

## 7. Suggested build order

1. Medication record + resident Meds tab
2. Today's MAR + tap-to-record administration
3. PRN handling (last given, interval, effectiveness)
4. History, timeline, reviews, reports
5. AI pattern flags (observations only, staff review — never a diagnosis)

Nothing has been changed yet. Approve to start with step 1.
