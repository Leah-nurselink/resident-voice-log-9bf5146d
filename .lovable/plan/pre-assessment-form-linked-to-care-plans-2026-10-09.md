# Pre-Assessment Form linked to Care Plans

## What staff will see
- A new **Pre-assessment** tab on each resident's record (and a "Start pre-assessment" option for someone not yet admitted, created as a resident with status "Pre-admission").
- A step-by-step form with your 17 sections: Resident details, Reason for admission, Medical history, Cognition & mental health, Personal care, Mobility, Nutrition, Skin, Continence, Clinical/complex needs, Communication, Wellbeing & social, Risk assessments required, Safeguarding & legal, Staffing & equipment, Documents to request, Admission decision.
- Each question uses a simple answer type: yes/no, choice (e.g. level of help: independent / 1 carer / 2 carers), or short notes. Mobile-friendly, saves as you go, can be finished later.
- Details already on the resident record (name, date of birth, GP, next of kin, allergies, language) are filled in automatically, not retyped.
- Documents section is a tick list (requested / received).
- Admission decision: Accepted / Accepted with conditions / Further assessment / Declined, with reasons, assessor name and date, then a **manager or clinical lead sign-off** step. Once signed off it is locked (changes create a new version), and it is recorded in the audit trail and timeline.

## Link to care plans
- Every section is tagged to the matching care area (e.g. Mobility to "Mobility & moving and handling", Skin to "Skin integrity").
- When staff open or write a care plan, a **"From pre-assessment"** panel shows the relevant answers for that care area.
- **CareCore AI draft** for a care plan will also read the signed-off pre-assessment answers for that area, alongside risk assessments and approved notes. It still never invents facts, and staff still review and approve.
- "Risk assessments required" ticks become prompts on the Risk tab (e.g. "Falls assessment flagged at pre-assessment, not yet completed").

## Not included
- No changes to BLE, voice or rota.
- No automatic writing of care plans — the AI only suggests drafts.

## Technical details
- New table `pre_assessments` (resident_id, version, status draft/submitted/approved, answers JSONB keyed by question id, decision, assessor, approver, timestamps) with RLS matching existing clinical tables and an audit trigger.
- Question definitions in `src/lib/pre-assessment.ts` (section → questions → linked `CarePlanDomain` / `RiskType`).
- New `PreAssessmentTab` component added to `residents/$id.tsx`.
- `draftCarePlan` extended to load the latest approved pre-assessment and include that domain's answers in the prompt input.
